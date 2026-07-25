import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/components/Text'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import { useThemeColors } from '../../../lib/themeColors'
import { addLibraryRecipeToMine, toggleLibraryFavorite } from '../../../lib/client'
import { perServingMacros } from '../../../lib/recipeMacros'
import { usePlan } from '../../../state/PlanContext'
import { PillGroup } from '../../../components/survey/Chips'
import { DifficultyBadge } from '../../../components/shared/DifficultyBadge'
import type { LibraryRecipe } from '../../../types/recipeLibrary'

const TIME_SLOTS = [
  { value: 'Breakfast 7:00', label: 'Breakfast' },
  { value: 'Lunch 13:00', label: 'Lunch' },
  { value: 'Snack 16:00', label: 'Snack' },
  { value: 'Dinner 19:30', label: 'Dinner' },
]

/**
 * Detail view for a shared-library recipe — read-only (nobody edits the
 * shared catalog directly), with two actions: copy it into the user's
 * personal recipe box, or add a serving of it straight to a plan day
 * without going through the personal box first. Always has the full
 * object via the route param (the library screen already has it in
 * memory) — no id-only deep-link fallback needed like the personal
 * recipe detail screen, since there's no share-intent/notification path
 * that would land here with just an id.
 */
export default function LibraryRecipeDetailScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string; recipe: string }>()
  const { plan, addMealToDay } = usePlan()

  const [recipe] = useState<LibraryRecipe | null>(() => {
    try {
      return JSON.parse(params.recipe) as LibraryRecipe
    } catch {
      return null
    }
  })

  const [favorited, setFavorited] = useState(!!recipe?.favorited)

  function handleToggleFavorite() {
    if (!recipe) return
    const next = !favorited
    setFavorited(next)
    toggleLibraryFavorite(recipe.id, next).catch(() => setFavorited(!next))
  }

  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [addError, setAddError] = useState('')

  const [planOpen, setPlanOpen] = useState(false)
  const [planDay, setPlanDay] = useState('')
  const [planSlot, setPlanSlot] = useState(TIME_SLOTS[0].value)
  const [planDone, setPlanDone] = useState(false)

  async function handleAddToMyRecipes() {
    if (!recipe) return
    setAdding(true)
    setAddError('')
    try {
      await addLibraryRecipeToMine(recipe.id)
      setAdded(true)
    } catch {
      setAddError("Couldn't add it to your recipes — try again.")
    } finally {
      setAdding(false)
    }
  }

  function handleAddToPlan() {
    if (!recipe || !planDay) return
    const per = perServingMacros(recipe)
    addMealToDay(planDay, {
      time: planSlot,
      name: recipe.name,
      protein: per.protein,
      carbs: per.carbs,
      fat: per.fat,
      kcal: per.kcal,
      ingredients: recipe.ingredients.map((i) => (i.qty ? `${i.qty} ${i.name}` : i.name)).join(', '),
    })
    setPlanDone(true)
  }

  if (!recipe) {
    return (
      <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: c.bg }}>
        <Text className="text-sm" style={{ color: c.muted }}>Recipe not found.</Text>
      </View>
    )
  }

  const serving = perServingMacros(recipe)

  return (
    <ScrollView contentContainerClassName="p-4" style={{ backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: recipe.name }} />

      <View className="mb-1 flex-row items-start justify-between gap-2">
        <Text className="flex-1 font-display text-xl" style={{ color: c.text }}>{recipe.name}</Text>
        <Pressable onPress={handleToggleFavorite} hitSlop={8} className="mt-1 p-1">
          <Svg width={24} height={24} viewBox="0 0 24 24" fill={favorited ? c.red : 'none'} stroke={favorited ? c.red : c.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </Svg>
        </Pressable>
      </View>
      <View className="mb-4 flex-row flex-wrap items-center gap-1.5">
        <Text className="text-xs" style={{ color: c.muted }}>{recipe.cuisine} · {recipe.category}</Text>
        <DifficultyBadge difficulty={recipe.difficulty} />
      </View>

      <View className="mb-2 flex-row flex-wrap gap-1.5">
        {recipe.tags.map((tag) => (
          <View key={tag} className="rounded-full px-2.5 py-1" style={{ backgroundColor: c.bg2 }}>
            <Text className="text-[11px]" style={{ color: c.muted }}>{tag}</Text>
          </View>
        ))}
      </View>

      <Text className="mb-2 mt-3 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>
        Per serving{recipe.servings > 1 ? ` · serves ${recipe.servings}` : ''}
      </Text>
      <View className="mb-5 flex-row gap-2">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((key) => (
          <View key={key} className="flex-1 items-center rounded-xl border py-2.5" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
            <Text className="text-sm font-bold" style={{ color: c.text }}>{serving[key]}</Text>
            <Text className="text-[10px] uppercase" style={{ color: c.muted }}>{key}</Text>
          </View>
        ))}
      </View>

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>Ingredients</Text>
      <View className="mb-5 gap-1.5">
        {recipe.ingredients.map((ing, i) => (
          <Text key={i} className="text-sm" style={{ color: c.text }}>• {ing.name}{ing.qty ? ` — ${ing.qty}` : ''}</Text>
        ))}
      </View>

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>Steps</Text>
      <View className="mb-5 gap-2">
        {recipe.steps.map((step, i) => (
          <Text key={i} className="text-sm" style={{ color: c.text }}>{i + 1}. {step}</Text>
        ))}
      </View>

      {/* Add to My Recipes */}
      <View className="mb-3 rounded-xl border p-3.5" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
        <Pressable onPress={handleAddToMyRecipes} disabled={adding || added} className="flex-row items-center gap-2">
          {adding && <ActivityIndicator size="small" color={c.lime} />}
          <Text className="text-sm font-bold" style={{ color: c.lime }}>
            {added ? '✓ Added to Your Recipes' : 'Add to My Recipes'}
          </Text>
        </Pressable>
        {addError ? <Text className="mt-2 text-xs" style={{ color: c.red }}>{addError}</Text> : null}
      </View>

      {/* Add to Plan */}
      <View className="mb-3 rounded-xl border p-3.5" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
        <Pressable onPress={() => { setPlanOpen((v) => !v); setPlanDone(false) }}>
          <Text className="text-sm font-bold" style={{ color: c.orange }}>Add to Plan</Text>
        </Pressable>
        {planOpen && (
          <View className="mt-3 gap-3">
            {planDone ? (
              <Text className="text-xs" style={{ color: c.muted }}>
                Added to {planDay}. Note: the Haul shopping list wasn't updated automatically — add anything missing by hand.
              </Text>
            ) : (
              <>
                <Text className="text-xs font-semibold" style={{ color: c.muted }}>Day</Text>
                <PillGroup options={(plan?.days ?? []).map((d) => ({ value: d.day, label: d.day }))} value={planDay} onChange={setPlanDay} />
                <Text className="text-xs font-semibold" style={{ color: c.muted }}>When</Text>
                <PillGroup options={TIME_SLOTS} value={planSlot} onChange={setPlanSlot} />
                <Text className="text-xs" style={{ color: c.muted }}>
                  Adds 1 serving — {serving.kcal} kcal, {serving.protein}g protein, {serving.carbs}g carbs, {serving.fat}g fat.
                </Text>
                <Pressable
                  onPress={handleAddToPlan}
                  disabled={!planDay}
                  className="items-center rounded-xl bg-lime py-2.5"
                  style={{ opacity: planDay ? 1 : 0.5 }}
                >
                  <Text className="text-sm font-extrabold text-bg">Confirm</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
