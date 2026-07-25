import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/components/Text'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Step0Start } from './steps/Step0Start'
import { Step1Training } from './steps/Step1Training'
import { Step2Food } from './steps/Step2Food'
import { Step3Macros } from './steps/Step3Macros'
import { activityFromTrainingDays } from './options'
import { LoadingOverlay } from '../shared/LoadingOverlay'
import { ErrorPanel } from '../shared/ErrorPanel'
import { usePlan } from '../../state/PlanContext'
import { useAccount } from '../../state/AccountContext'
import { ApiError, postClaude } from '../../lib/client'
import { WEEK_DAYS, assemblePlanFromLibrary, getLibraryPools } from '../../lib/planAssembly'
import { buildPrepAndShoppingRequest } from '../../lib/prepAndShoppingPrompt'
import { resolveProfileMacros } from '../../lib/macros'
import type { Plan, PrepTask, ShoppingCategory } from '../../types/plan'
import { useThemeColors } from '../../lib/themeColors'
import { friendlyErrorMessage } from '../../lib/errorMessage'

const TOTAL_STEPS = 4

interface SurveyFlowProps {
  onGenerated: () => void
  onBuyPlans: () => void
  canCancel: boolean
  onCancel: () => void
}

/**
 * The 4-step onboarding/regeneration wizard — replaces the Fuel tab's
 * normal view whenever there's no plan yet or `surveyMode` is on. Owns the
 * step index and the actual generate-request call; each step component is
 * a controlled view over `PlanContext`'s `profile`.
 */
export function SurveyFlow({ onGenerated, onBuyPlans, canCancel, onCancel }: SurveyFlowProps) {
  const c = useThemeColors()
  const { profile, setProfile, setPlan } = usePlan()
  const { refreshRemaining } = useAccount()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ message: string; isOutOfPlans: boolean } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const patch = (p: Partial<typeof profile>) => setProfile(p)

  function toggleCuisine(value: string) {
    const exists = profile.cuisines.includes(value)
    setProfile({ cuisines: exists ? profile.cuisines.filter((v) => v !== value) : [...profile.cuisines, value] })
  }

  /**
   * Resolves macros, assembles the week algorithmically from the shared
   * recipe library (no AI — see planAssembly.ts), then makes one small AI
   * call to turn those already-decided meals into batch-cook steps + a
   * merged shopping list. Replaces the old single 16k-token full-plan
   * generation entirely (see issue #25) — "Generate My Plan" still costs
   * one generation credit (the credit decrement lives in /api/claude,
   * still called here for the prep+shopping step), it just no longer
   * spends tokens inventing the meals themselves.
   */
  async function handleGenerate() {
    const macros = resolveProfileMacros(profile)
    if (!macros) {
      setError({ message: 'Please fill in all macro / stat fields.', isOutOfPlans: false })
      setStep(3)
      return
    }

    setLoading(true)
    setError(null)
    abortRef.current = new AbortController()

    try {
      const pools = await getLibraryPools()
      const days = assemblePlanFromLibrary(macros, profile, pools)

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
      onGenerated()
    } catch (err) {
      setLoading(false)
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof ApiError) {
        setError({ message: err.message, isOutOfPlans: err.status === 402 })
      } else {
        setError({ message: friendlyErrorMessage(err), isOutOfPlans: false })
      }
    }
  }

  /**
   * Skips both the algorithm and the AI entirely — a blank 7-day plan at
   * the resolved macro targets, meals added one at a time from the Fuel
   * tab's empty-day state (reuses the same "Add to Plan" flow the library
   * detail screen already has). Free — no generation credit spent.
   */
  function handleBuildManually() {
    const macros = resolveProfileMacros(profile)
    if (!macros) {
      setError({ message: 'Please fill in all macro / stat fields.', isOutOfPlans: false })
      setStep(3)
      return
    }
    const plan: Plan = {
      summary: macros,
      prep_tasks: [],
      days: WEEK_DAYS.map((day) => ({ day, kcal: 0, protein: 0, carbs: 0, fat: 0, meals: [] })),
      shopping_list: [],
    }
    setPlan(plan, profile.name.trim() || 'Your')
    onGenerated()
  }

  /** Aborts the in-flight generation request and dismisses the loading overlay. */
  function handleCancelLoading() {
    abortRef.current?.abort()
    setLoading(false)
  }

  /** Advances to the next step, or triggers generation from the final step. */
  function next() {
    if (step === TOTAL_STEPS - 1) {
      handleGenerate()
      return
    }
    setStep((s) => s + 1)
  }

  /** Goes back a step, or exits the survey (if cancellable) from the first step. */
  function prev() {
    if (step === 0) {
      if (canCancel) onCancel()
      return
    }
    setStep((s) => s - 1)
  }

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="px-5 pt-6" keyboardShouldPersistTaps="handled" className="flex-1">
          <View className="mb-6 flex-row items-center gap-3">
            <View className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: c.border }}>
              <View className="h-full rounded-full bg-lime" style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }} />
            </View>
            <Text className="text-xs font-semibold" style={{ color: c.muted }}>{step + 1}/4</Text>
          </View>

          {step === 0 && <Step0Start name={profile.name} onNameChange={(name) => patch({ name })} />}
          {step === 1 && (
            <Step1Training
              trainingDays={profile.trainingDays}
              onTrainingDays={(trainingDays) => patch({ trainingDays, activity: activityFromTrainingDays(trainingDays) })}
              trainingStyle={profile.trainingStyle}
              onTrainingStyle={(trainingStyle) => patch({ trainingStyle })}
            />
          )}
          {step === 2 && (
            <Step2Food
              dietPref={profile.dietPref}
              onDietPref={(dietPref) => patch({ dietPref })}
              dislikedFoods={profile.dislikedFoods}
              onDislikedFoods={(dislikedFoods) => patch({ dislikedFoods })}
              cuisines={profile.cuisines}
              onToggleCuisine={toggleCuisine}
              variety={profile.variety}
              onVariety={(variety) => patch({ variety })}
              cookingSkill={profile.cookingSkill}
              onCookingSkill={(cookingSkill) => patch({ cookingSkill })}
              prepTime={profile.prepTime}
              onPrepTime={(prepTime) => patch({ prepTime })}
            />
          )}
          {step === 3 && <Step3Macros profile={profile} onChange={patch} />}
          {step === 3 && (
            <Pressable onPress={handleBuildManually} className="mb-2 mt-1 items-center py-2">
              <Text className="text-xs font-semibold underline" style={{ color: c.muted }}>
                Or build it myself, meal by meal →
              </Text>
            </Pressable>
          )}
        </ScrollView>

        <View className="flex-row gap-3 border-t px-5 py-3" style={{ borderColor: c.border, backgroundColor: c.bg }}>
          {(step > 0 || canCancel) && (
            <Pressable onPress={prev} className="rounded-xl border px-4 py-3" style={{ borderColor: c.border }}>
              <Text className="text-sm font-semibold" style={{ color: c.muted }}>Back</Text>
            </Pressable>
          )}
          <Pressable onPress={next} className="flex-1 items-center rounded-xl bg-lime py-3">
            <Text className="text-sm font-extrabold text-bg">{step === TOTAL_STEPS - 1 ? 'Generate My Plan' : 'Continue'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {loading && <LoadingOverlay onCancel={handleCancelLoading} />}
      {error && (
        <ErrorPanel
          message={error.message}
          isOutOfPlans={error.isOutOfPlans}
          onRetry={() => {
            setError(null)
            handleGenerate()
          }}
          onDismiss={() => setError(null)}
          onTopUp={onBuyPlans}
        />
      )}
    </SafeAreaView>
  )
}
