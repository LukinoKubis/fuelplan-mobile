import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { Text } from '@/components/Text'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useThemeColors } from '../../../lib/themeColors'
import { ApiError, deleteRecipe, getRecipeList, postClaude, saveRecipe } from '../../../lib/client'
import { buildImproveForMacrosRequest } from '../../../lib/recipePrompt'
import { friendlyErrorMessage } from '../../../lib/errorMessage'
import { usePlan } from '../../../state/PlanContext'
import { PillGroup } from '../../../components/survey/Chips'
import { RecipePhotoPicker } from '../../../components/shared/RecipePhotoPicker'
import type { Recipe } from '../../../types/recipe'

const TIME_SLOTS = [
  { value: 'Breakfast 7:00', label: 'Breakfast' },
  { value: 'Lunch 13:00', label: 'Lunch' },
  { value: 'Snack 16:00', label: 'Snack' },
  { value: 'Dinner 19:30', label: 'Dinner' },
]

// Someone cutting and someone bulking want opposite things from "improve
// this recipe" — a single free-text box makes people who don't already
// know the right nutrition vocabulary guess. These fill the instruction
// field (still editable, still reviewed before sending) rather than
// firing immediately, so it stays transparent what's being asked for.
const GOAL_PRESETS = [
  { label: 'Cutting', instruction: 'I’m cutting — increase the protein-to-calorie ratio and reduce total calories where you can, without shrinking the portion or making it feel like less food.' },
  { label: 'Bulking', instruction: 'I’m bulking — increase total calories while keeping protein high, favoring energy-dense additions (healthy fats, more carbs) over just more volume.' },
  { label: 'Higher Protein', instruction: 'Increase protein as much as reasonably possible while keeping calories about the same as they are now.' },
  { label: 'Lower Carb', instruction: 'Reduce carbohydrates, swapping starchy ingredients for lower-carb alternatives, while keeping protein and calories similar to now.' },
]

/** Recipe.macros is always the WHOLE recipe as extracted — divide by servings (default 1) to get what one portion actually looks like. */
function perServingMacros(recipe: Pick<Recipe, 'macros' | 'servings'>) {
  const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1
  return {
    kcal: Math.round(recipe.macros.kcal / servings),
    protein: Math.round(recipe.macros.protein / servings),
    carbs: Math.round(recipe.macros.carbs / servings),
    fat: Math.round(recipe.macros.fat / servings),
  }
}

/**
 * Recipe detail — read-only view of a saved recipe plus Add to Plan,
 * Improve for Macros, and Delete. Prefers the recipe passed as a route
 * param (the list screen already has the full object in memory) and only
 * falls back to fetching the list and finding it by id for a cold/deep
 * link where no param arrived.
 */
export default function RecipeDetailScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string; recipe?: string }>()
  const { plan, addMealToDay } = usePlan()

  const [recipe, setRecipe] = useState<Recipe | null>(() => {
    if (!params.recipe) return null
    try {
      return JSON.parse(params.recipe) as Recipe
    } catch {
      return null
    }
  })
  const [notFound, setNotFound] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false)
  const [savingPhoto, setSavingPhoto] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addDay, setAddDay] = useState('')
  const [addSlot, setAddSlot] = useState(TIME_SLOTS[0].value)
  const [addDone, setAddDone] = useState(false)

  const [improveOpen, setImproveOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [improving, setImproving] = useState(false)
  const [improveError, setImproveError] = useState('')
  const [improvedDraft, setImprovedDraft] = useState<Recipe | null>(null)
  const [savingImproved, setSavingImproved] = useState(false)

  useEffect(() => {
    if (recipe || !params.id) return
    const id = Number(params.id)
    getRecipeList()
      .then((res) => {
        const match = res.recipes.find((r) => r.id === id)
        if (match) setRecipe(match)
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
  }, [recipe, params.id])

  async function handleImprove() {
    if (!recipe || !instruction.trim()) return
    setImproveError('')
    setImproving(true)
    try {
      const { system, messages, model, max_tokens } = buildImproveForMacrosRequest({ recipe, instruction })
      const response = await postClaude({ model, max_tokens, system, messages })
      const text = response.content[0]?.text || ''
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      let parsed: Partial<Recipe>
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Got invalid JSON back. Please try again.')
        parsed = JSON.parse(match[0])
      }
      setImprovedDraft({
        ...recipe,
        name: parsed.name || recipe.name,
        ingredients: parsed.ingredients || recipe.ingredients,
        steps: parsed.steps || recipe.steps,
        macros: parsed.macros || recipe.macros,
        servings: parsed.servings ?? recipe.servings,
      })
    } catch (err) {
      setImproveError(err instanceof ApiError ? err.message : friendlyErrorMessage(err))
    } finally {
      setImproving(false)
    }
  }

  /** Cosmetic-only save — updates just the cover photo via the same upsert-by-id save endpoint everything else uses. */
  async function handlePhotoChange(photo: string) {
    if (!recipe) return
    setSavingPhoto(true)
    try {
      const res = await saveRecipe({ ...recipe, photo })
      setRecipe(res.recipe)
      setPhotoEditorOpen(false)
    } catch {
      /* non-critical — the photo just didn't save, recipe data is unaffected */
    } finally {
      setSavingPhoto(false)
    }
  }

  async function handleSaveImproved() {
    if (!improvedDraft) return
    setSavingImproved(true)
    try {
      const res = await saveRecipe(improvedDraft)
      setRecipe(res.recipe)
      setImprovedDraft(null)
      setImproveOpen(false)
      setInstruction('')
    } catch (err) {
      setImproveError(err instanceof ApiError ? err.message : friendlyErrorMessage(err))
    } finally {
      setSavingImproved(false)
    }
  }

  function handleAddToPlan() {
    if (!recipe || !addDay) return
    // One "Add to Plan" = one meal = one serving, not the whole batch —
    // recipe.macros is the full recipe total, which for a multi-portion
    // dish would massively overstate a single meal's macros.
    const per = perServingMacros(recipe)
    addMealToDay(addDay, {
      time: addSlot,
      name: recipe.name,
      protein: per.protein,
      carbs: per.carbs,
      fat: per.fat,
      kcal: per.kcal,
      ingredients: recipe.ingredients.map((i) => (i.qty ? `${i.qty} ${i.name}` : i.name)).join(', '),
    })
    setAddDone(true)
  }

  async function handleDelete() {
    if (!recipe) return
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    setDeleting(true)
    try {
      await deleteRecipe(recipe.id)
      router.back()
    } catch {
      setDeleting(false)
    }
  }

  if (notFound) {
    return (
      <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: c.bg }}>
        <Text className="text-sm" style={{ color: c.muted }}>Recipe not found.</Text>
      </View>
    )
  }

  if (!recipe) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: c.bg }}>
        <ActivityIndicator color={c.lime} />
      </View>
    )
  }

  const recipeServing = perServingMacros(recipe)

  return (
    <ScrollView contentContainerClassName="p-4" style={{ backgroundColor: c.bg }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: recipe.name }} />

      {recipe.photo ? (
        <Image source={{ uri: recipe.photo }} style={{ width: '100%', height: 180, borderRadius: 12, marginBottom: 12 }} contentFit="cover" />
      ) : null}

      <Text className="mb-1 font-display text-xl" style={{ color: c.text }}>{recipe.name}</Text>
      {recipe.sourceUrl ? (
        <Pressable onPress={() => WebBrowser.openBrowserAsync(recipe.sourceUrl!)} className="mb-3 self-start">
          <Text className="text-xs underline" style={{ color: c.blue }}>
            {recipe.sourcePlatform === 'tiktok' ? 'View on TikTok' : recipe.sourcePlatform === 'instagram' ? 'View on Instagram' : 'View source'}
          </Text>
        </Pressable>
      ) : (
        <View className="mb-3" />
      )}

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>
        Per serving{recipe.servings && recipe.servings > 1 ? ` · serves ${recipe.servings}` : ''}
      </Text>
      <View className="mb-2 flex-row gap-2">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((key) => (
          <View key={key} className="flex-1 items-center rounded-xl border py-2.5" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
            <Text className="text-sm font-bold" style={{ color: c.text }}>{recipeServing[key]}</Text>
            <Text className="text-[10px] uppercase" style={{ color: c.muted }}>{key}</Text>
          </View>
        ))}
      </View>
      {recipe.servings && recipe.servings > 1 ? (
        <Text className="mb-5 text-xs" style={{ color: c.muted }}>
          Whole recipe (all {recipe.servings} servings): {recipe.macros.kcal} kcal · {recipe.macros.protein}g protein · {recipe.macros.carbs}g carbs · {recipe.macros.fat}g fat
        </Text>
      ) : (
        <View className="mb-5" />
      )}

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

      {/* Cover photo */}
      <View className="mb-3 rounded-xl border p-3.5" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
        <Pressable onPress={() => setPhotoEditorOpen((v) => !v)} disabled={savingPhoto}>
          <Text className="text-sm font-bold" style={{ color: c.orange }}>{recipe.photo ? 'Change Cover Photo' : 'Add Cover Photo'}</Text>
        </Pressable>
        {photoEditorOpen && (
          <View className="mt-3">
            <RecipePhotoPicker photo={recipe.photo} onChange={handlePhotoChange} />
          </View>
        )}
      </View>

      {/* Add to Plan */}
      <View className="mb-3 rounded-xl border p-3.5" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
        <Pressable onPress={() => { setAddOpen((v) => !v); setAddDone(false) }}>
          <Text className="text-sm font-bold" style={{ color: c.lime }}>Add to Plan</Text>
        </Pressable>
        {addOpen && (
          <View className="mt-3 gap-3">
            {addDone ? (
              <Text className="text-xs" style={{ color: c.muted }}>
                Added to {addDay}. Note: the Haul shopping list wasn't updated automatically — add anything missing by hand.
              </Text>
            ) : (
              <>
                <Text className="text-xs font-semibold" style={{ color: c.muted }}>Day</Text>
                <PillGroup options={(plan?.days ?? []).map((d) => ({ value: d.day, label: d.day }))} value={addDay} onChange={setAddDay} />
                <Text className="text-xs font-semibold" style={{ color: c.muted }}>When</Text>
                <PillGroup options={TIME_SLOTS} value={addSlot} onChange={setAddSlot} />
                <Text className="text-xs" style={{ color: c.muted }}>
                  Adds 1 serving — {recipeServing.kcal} kcal, {recipeServing.protein}g protein, {recipeServing.carbs}g carbs, {recipeServing.fat}g fat.
                </Text>
                <Pressable
                  onPress={handleAddToPlan}
                  disabled={!addDay}
                  className="items-center rounded-xl bg-lime py-2.5"
                  style={{ opacity: addDay ? 1 : 0.5 }}
                >
                  <Text className="text-sm font-extrabold text-bg">Confirm</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>

      {/* Improve for Macros */}
      <View className="mb-3 rounded-xl border p-3.5" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
        <Pressable onPress={() => setImproveOpen((v) => !v)}>
          <Text className="text-sm font-bold" style={{ color: c.blue }}>Improve for Macros</Text>
        </Pressable>
        {improveOpen && (
          <View className="mt-3 gap-3">
            {!improvedDraft ? (
              <>
                <Text className="text-xs font-semibold" style={{ color: c.muted }}>Goal (optional shortcut — edits the text below)</Text>
                <View className="flex-row flex-wrap gap-2">
                  {GOAL_PRESETS.map((preset) => (
                    <Pressable
                      key={preset.label}
                      onPress={() => setInstruction(preset.instruction)}
                      className="rounded-full border px-3 py-1.5"
                      style={{ borderColor: c.border, backgroundColor: c.bg }}
                    >
                      <Text className="text-xs font-semibold" style={{ color: c.text }}>{preset.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={instruction}
                  onChangeText={setInstruction}
                  placeholder="e.g. more protein, fewer carbs"
                  placeholderTextColor={c.muted}
                  multiline
                  className="rounded-xl border px-3 py-2.5 text-sm"
                  style={{ borderColor: c.border, backgroundColor: c.bg, color: c.text }}
                />
                {improveError ? <Text className="text-xs" style={{ color: c.red }}>{improveError}</Text> : null}
                <Pressable
                  onPress={handleImprove}
                  disabled={improving || !instruction.trim()}
                  className="flex-row items-center justify-center gap-2 rounded-xl bg-blue py-2.5"
                  style={{ opacity: improving || !instruction.trim() ? 0.6 : 1 }}
                >
                  {improving && <ActivityIndicator color="#0e0f11" />}
                  <Text className="text-sm font-extrabold text-bg">{improving ? 'Thinking…' : 'Get Suggestion'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text className="text-xs font-semibold" style={{ color: c.muted }}>
                  New macros — per serving{improvedDraft.servings && improvedDraft.servings > 1 ? ` (serves ${improvedDraft.servings})` : ''}
                </Text>
                <View className="flex-row gap-2">
                  {(['kcal', 'protein', 'carbs', 'fat'] as const).map((key) => (
                    <View key={key} className="flex-1 items-center rounded-xl border py-2" style={{ borderColor: c.border, backgroundColor: c.bg }}>
                      <Text className="text-sm font-bold" style={{ color: c.lime }}>{perServingMacros(improvedDraft)[key]}</Text>
                      <Text className="text-[9px] uppercase" style={{ color: c.muted }}>{key}</Text>
                    </View>
                  ))}
                </View>
                <Text className="text-xs" style={{ color: c.muted }}>{improvedDraft.name}</Text>
                <View className="flex-row gap-2">
                  <Pressable onPress={() => setImprovedDraft(null)} className="flex-1 items-center rounded-xl border py-2.5" style={{ borderColor: c.border }}>
                    <Text className="text-sm font-semibold" style={{ color: c.muted }}>Discard</Text>
                  </Pressable>
                  <Pressable onPress={handleSaveImproved} disabled={savingImproved} className="flex-1 items-center rounded-xl bg-lime py-2.5" style={{ opacity: savingImproved ? 0.6 : 1 }}>
                    <Text className="text-sm font-extrabold text-bg">{savingImproved ? 'Saving…' : 'Save This Version'}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}
      </View>

      <Pressable onPress={handleDelete} disabled={deleting} className="items-center rounded-xl border py-2.5" style={{ borderColor: 'rgba(255,87,87,0.3)', backgroundColor: 'rgba(255,87,87,0.1)', opacity: deleting ? 0.6 : 1 }}>
        <Text className="text-sm font-bold" style={{ color: c.red }}>{deleteConfirm ? 'Tap again to confirm' : 'Delete Recipe'}</Text>
      </Pressable>
    </ScrollView>
  )
}
