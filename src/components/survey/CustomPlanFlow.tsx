import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native'
import { Text } from '@/components/Text'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { Step3Macros } from './steps/Step3Macros'
import { DayMacroBar } from '../fuel/DayMacroBar'
import { LoadingOverlay } from '../shared/LoadingOverlay'
import { ErrorPanel } from '../shared/ErrorPanel'
import { usePlan } from '../../state/PlanContext'
import { useAccount } from '../../state/AccountContext'
import { resolveProfileMacros } from '../../lib/macros'
import { WEEK_DAYS } from '../../lib/planAssembly'
import { buildPrepAndShoppingRequest } from '../../lib/prepAndShoppingPrompt'
import { ApiError, getRecipeLibrary, postClaude } from '../../lib/client'
import { perServingMacros } from '../../lib/recipeMacros'
import { useThemeColors } from '../../lib/themeColors'
import { friendlyErrorMessage } from '../../lib/errorMessage'
import type { Plan, DayPlan, Meal, Macros, PrepTask, ShoppingCategory } from '../../types/plan'
import type { LibraryRecipe } from '../../types/recipeLibrary'

/** Mean per-serving macros across a slot's current selections — 0s if nothing picked yet. */
function averageMacros(recipes: LibraryRecipe[]): Macros {
  if (recipes.length === 0) return { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  const sums = recipes.reduce(
    (acc, r) => {
      const per = perServingMacros(r)
      return { kcal: acc.kcal + per.kcal, protein: acc.protein + per.protein, carbs: acc.carbs + per.carbs, fat: acc.fat + per.fat }
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )
  return {
    kcal: Math.round(sums.kcal / recipes.length),
    protein: Math.round(sums.protein / recipes.length),
    carbs: Math.round(sums.carbs / recipes.length),
    fat: Math.round(sums.fat / recipes.length),
  }
}

interface CustomPlanFlowProps {
  onCreated: () => void
  onBuyPlans: () => void
  canCancel: boolean
  onCancel: () => void
}

type SlotKey = 'breakfast' | 'lunch' | 'snack' | 'dinner'

const SLOTS: { key: SlotKey; label: string; time: string }[] = [
  { key: 'breakfast', label: 'breakfasts', time: 'Breakfast 7:00' },
  { key: 'lunch', label: 'lunches', time: 'Lunch 13:00' },
  { key: 'snack', label: 'snacks', time: 'Snack 16:00' },
  { key: 'dinner', label: 'dinners', time: 'Dinner 19:30' },
]

/**
 * Lightweight sibling to SurveyFlow, for the "Create Custom Plan" path.
 * Skips name/training/food-preference questions entirely (none of that
 * matters when nothing gets AI/algorithm-picked) but still walks the user
 * through actually filling the week, category by category — set macro
 * targets, then pick breakfasts, then lunches, then snacks, then dinners
 * (not day-by-day; picking "what am I doing for breakfast this week" once
 * matches how people actually meal-prep). Picking more than one recipe for
 * a slot rotates them round-robin across the 7 days; picking none just
 * skips that slot everywhere — the Fuel tab's existing per-day "Add a
 * meal"/replace flows still cover anything left blank or wanted later.
 *
 * Once meals are picked, this makes the exact same small AI call
 * SurveyFlow's Generate path does (buildPrepAndShoppingRequest) to turn the
 * already-decided week into Sunday batch-cook steps + a shopping list — so
 * Prep/Haul aren't empty just because the meals came from the user instead
 * of the algorithm. That call still costs one generation credit, same as
 * Generate (the credit pays for that AI call, not for picking meals).
 */
export function CustomPlanFlow({ onCreated, onBuyPlans, canCancel, onCancel }: CustomPlanFlowProps) {
  const c = useThemeColors()
  const { profile, setProfile, setPlan } = usePlan()
  const { refreshRemaining } = useAccount()
  const [step, setStep] = useState(0) // 0 = macros, 1..4 = SLOTS[step-1]
  const [error, setError] = useState('')
  const [genError, setGenError] = useState<{ message: string; isOutOfPlans: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const [selections, setSelections] = useState<Record<SlotKey, LibraryRecipe[]>>({ breakfast: [], lunch: [], snack: [], dinner: [] })
  const [options, setOptions] = useState<LibraryRecipe[] | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const slot = step >= 1 ? SLOTS[step - 1] : null
  const target = resolveProfileMacros(profile)

  // Running "typical day" estimate from whatever's picked so far (including
  // the slot currently being edited) — averages a slot's selections if more
  // than one, so it's directly comparable to a real per-day total even
  // before the week's actual rotation is decided.
  const runningTotals = SLOTS.reduce(
    (acc, s) => {
      const avg = averageMacros(selections[s.key])
      return { kcal: acc.kcal + avg.kcal, protein: acc.protein + avg.protein, carbs: acc.carbs + avg.carbs, fat: acc.fat + avg.fat }
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!slot) return
    setOptions(null)
    getRecipeLibrary({ category: slot.key, search: debouncedSearch || undefined })
      .then((res) => setOptions(res.recipes))
      .catch(() => setOptions([]))
  }, [slot?.key, debouncedSearch])

  function toggleSelected(recipe: LibraryRecipe) {
    if (!slot) return
    setSelections((prev) => {
      const current = prev[slot.key]
      const exists = current.some((r) => r.id === recipe.id)
      return { ...prev, [slot.key]: exists ? current.filter((r) => r.id !== recipe.id) : [...current, recipe] }
    })
  }

  function handleMacrosNext() {
    if (!target) {
      setError('Please fill in all macro / stat fields.')
      return
    }
    setError('')
    setSearch('')
    setStep(1)
  }

  async function handleCreate() {
    const macros = resolveProfileMacros(profile)
    if (!macros) {
      setError('Please fill in all macro / stat fields.')
      setStep(0)
      return
    }

    const days: DayPlan[] = WEEK_DAYS.map((day, dayIndex) => {
      const meals: Meal[] = []
      for (const s of SLOTS) {
        const picks = selections[s.key]
        if (picks.length === 0) continue
        const recipe = picks[dayIndex % picks.length]
        const per = perServingMacros(recipe)
        meals.push({
          time: s.time,
          name: recipe.name,
          protein: per.protein,
          carbs: per.carbs,
          fat: per.fat,
          kcal: per.kcal,
          ingredients: recipe.ingredients.map((i) => (i.qty ? `${i.qty} ${i.name}` : i.name)).join(', '),
        })
      }
      const totals = meals.reduce(
        (acc, m) => ({ kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      )
      return { day, ...totals, meals }
    })

    const hasAnyMeals = days.some((d) => d.meals.length > 0)
    if (!hasAnyMeals) {
      // Nothing picked at all — skip the AI call entirely, no point paying
      // a credit for prep/shopping steps covering zero meals.
      const plan: Plan = { summary: macros, prep_tasks: [], days, shopping_list: [] }
      setPlan(plan, profile.name.trim() || 'Your')
      onCreated()
      return
    }

    setLoading(true)
    setGenError(null)
    abortRef.current = new AbortController()

    try {
      const { system, messages, model, max_tokens } = buildPrepAndShoppingRequest(days)
      const response = await postClaude({ model, max_tokens, system, messages }, abortRef.current.signal)
      const rawText = response.content[0]?.text || ''
      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()

      let extra: { prep_tasks?: PrepTask[]; shopping_list?: ShoppingCategory[] }
      try {
        extra = JSON.parse(cleaned)
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Got invalid JSON back. Please try again.')
        extra = JSON.parse(match[0])
      }

      const plan: Plan = { summary: macros, prep_tasks: extra.prep_tasks || [], days, shopping_list: extra.shopping_list || [] }
      setPlan(plan, profile.name.trim() || 'Your')
      setLoading(false)
      refreshRemaining()
      onCreated()
    } catch (err) {
      setLoading(false)
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof ApiError) {
        setGenError({ message: err.message, isOutOfPlans: err.status === 402 })
      } else {
        setGenError({ message: friendlyErrorMessage(err), isOutOfPlans: false })
      }
    }
  }

  function handleCancelLoading() {
    abortRef.current?.abort()
    setLoading(false)
  }

  function handleBack() {
    if (step === 0) {
      onCancel()
      return
    }
    setStep((s) => s - 1)
  }

  function handleContinue() {
    if (step === 0) {
      handleMacrosNext()
      return
    }
    setSearch('')
    if (step === SLOTS.length) {
      handleCreate()
    } else {
      setStep((s) => s + 1)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="px-5 pt-4">
          <View className="flex-row items-center gap-3">
            <View className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: c.border }}>
              <View className="h-full rounded-full bg-lime" style={{ width: `${(step / SLOTS.length) * 100}%` }} />
            </View>
            <Text className="text-xs font-semibold" style={{ color: c.muted }}>{step + 1}/{SLOTS.length + 1}</Text>
          </View>
        </View>

        {step === 0 ? (
          <ScrollView contentContainerClassName="px-5 pt-4" keyboardShouldPersistTaps="handled" className="flex-1">
            <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-lime">Custom Plan</Text>
            <Text className="mb-2 font-display text-3xl leading-tight text-light-text dark:text-text">Set your{'\n'}targets</Text>
            <Text className="mb-6 text-sm text-light-muted dark:text-muted">
              You'll pick your own meals next — just set your daily macro targets first so we can track progress.
            </Text>
            <Step3Macros profile={profile} onChange={(p) => setProfile(p)} hideStepLabel />
            {error ? <Text className="mt-3 text-sm" style={{ color: c.red }}>{error}</Text> : null}
          </ScrollView>
        ) : (
          <>
            <View className="px-5 pt-4">
              <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-lime">Custom Plan</Text>
              <Text className="mb-1 font-display text-2xl leading-tight text-light-text dark:text-text">Pick your {slot!.label}</Text>
              <Text className="mb-3 text-xs text-light-muted dark:text-muted">
                {selections[slot!.key].length === 0
                  ? `Tap any recipe to add it — pick more than one and they'll rotate across the week. Or skip if you don't want ${slot!.label} planned yet.`
                  : `${selections[slot!.key].length} selected — rotating across the 7 days.`}
              </Text>
              {target && (
                <View className="mb-3 overflow-hidden rounded-xl border" style={{ borderColor: c.border }}>
                  <DayMacroBar day={{ day: 'so far', meals: [], ...runningTotals }} target={target} />
                </View>
              )}
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={`Search ${slot!.label}…`}
                placeholderTextColor={c.muted}
                className="mb-3 rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
              />
            </View>
            <ScrollView contentContainerClassName="gap-2.5 px-5 pb-4" className="flex-1">
              {options === null && (
                <View className="items-center py-10">
                  <ActivityIndicator color={c.lime} />
                </View>
              )}
              {options?.length === 0 && <Text className="text-sm" style={{ color: c.muted }}>No recipes match.</Text>}
              {options?.map((recipe) => {
                const per = perServingMacros(recipe)
                const selected = selections[slot!.key].some((r) => r.id === recipe.id)
                return (
                  <Pressable
                    key={recipe.id}
                    onPress={() => toggleSelected(recipe)}
                    className="flex-row items-center gap-3 rounded-xl border p-3"
                    style={{ borderColor: selected ? c.lime : c.border, backgroundColor: selected ? 'rgba(200,245,66,0.1)' : c.bg2 }}
                  >
                    <View
                      className="h-5 w-5 items-center justify-center rounded-full border"
                      style={{ borderColor: selected ? c.lime : c.border, backgroundColor: selected ? c.lime : 'transparent' }}
                    >
                      {selected && (
                        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#0e0f11" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M20 6 9 17l-5-5" />
                        </Svg>
                      )}
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="mb-0.5 text-sm font-semibold" numberOfLines={1} style={{ color: c.text }}>{recipe.name}</Text>
                      <Text className="text-xs" style={{ color: c.muted }}>
                        {per.kcal} kcal · {per.protein}g protein · {per.carbs}g carbs · {per.fat}g fat
                      </Text>
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>
          </>
        )}

        <View className="flex-row gap-3 border-t px-5 py-3" style={{ borderColor: c.border, backgroundColor: c.bg }}>
          {(step > 0 || canCancel) && (
            <Pressable onPress={handleBack} className="rounded-xl border px-4 py-3" style={{ borderColor: c.border }}>
              <Text className="text-sm font-semibold" style={{ color: c.muted }}>Back</Text>
            </Pressable>
          )}
          <Pressable onPress={handleContinue} className="flex-1 items-center rounded-xl bg-lime py-3">
            <Text className="text-sm font-extrabold text-bg">
              {step === 0 ? 'Continue' : step === SLOTS.length ? 'Create Plan' : selections[slot!.key].length === 0 ? 'Skip →' : 'Continue'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {loading && <LoadingOverlay onCancel={handleCancelLoading} />}
      {genError && (
        <ErrorPanel
          message={genError.message}
          isOutOfPlans={genError.isOutOfPlans}
          onRetry={() => {
            setGenError(null)
            handleCreate()
          }}
          onDismiss={() => setGenError(null)}
          onTopUp={onBuyPlans}
        />
      )}
    </SafeAreaView>
  )
}
