import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native'
import { Text } from '@/components/Text'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import { getRecipeLibrary, toggleLibraryFavorite } from '../../../lib/client'
import { useThemeColors } from '../../../lib/themeColors'
import { perServingMacros } from '../../../lib/recipeMacros'
import { PillGroup } from '../../../components/survey/Chips'
import { DifficultyBadge } from '../../../components/shared/DifficultyBadge'
import type { LibraryRecipe } from '../../../types/recipeLibrary'

const CATEGORY_EMOJI: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍽️',
  snack: '🍎',
}

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

const DIFFICULTIES = [
  { value: '', label: 'Any difficulty' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

/** Small colored macro readout — same kcal=lime/protein=blue/carbs=orange/fat=red convention as DayMacroBar, so a library card reads consistently with the rest of the app. */
function MacroChip({ value, label, color, c }: { value: number; label: string; color: string; c: ReturnType<typeof useThemeColors> }) {
  return (
    <View className="flex-1 items-center rounded-lg py-1.5" style={{ backgroundColor: c.bg }}>
      <Text className="text-[13px] font-extrabold" style={{ color }}>{value}</Text>
      <Text className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: c.muted }}>{label}</Text>
    </View>
  )
}

function HeartButton({ favorited, onPress }: { favorited: boolean; onPress: () => void }) {
  const c = useThemeColors()
  return (
    <Pressable onPress={onPress} hitSlop={8} className="p-1">
      <Svg width={20} height={20} viewBox="0 0 24 24" fill={favorited ? c.red : 'none'} stroke={favorited ? c.red : c.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </Svg>
    </Pressable>
  )
}

/**
 * Browse/search the shared recipe library (admin-seeded catalog, every
 * user reads the same copy) — distinct from index.tsx's personal recipe
 * box. Search is debounced client-side; filtering (category, search,
 * favorites-only) all happens server-side (see claude-backend's
 * /api/library/list) so this screen never has to pull the whole catalog
 * just to show one slice of it.
 */
export default function RecipeLibraryScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const params = useLocalSearchParams<{ replaceDay?: string; replaceMealIndex?: string; replaceMealName?: string; presetDay?: string }>()
  const isReplaceMode = !!params.replaceDay && params.replaceMealIndex !== undefined
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [recipes, setRecipes] = useState<LibraryRecipe[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // Refetches on every focus (not just filter changes) so a favorite toggled
  // from the detail screen is reflected on the way back, not left stale.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      getRecipeLibrary({ category: category || undefined, search: debouncedSearch || undefined, favoritesOnly: favoritesOnly || undefined, difficulty: difficulty || undefined })
        .then((res) => {
          if (!cancelled) setRecipes(res.recipes)
        })
        .catch(() => {
          if (!cancelled) setError("Couldn't load the library — try again.")
        })
      return () => {
        cancelled = true
      }
    }, [category, debouncedSearch, favoritesOnly, difficulty])
  )

  /** Optimistic toggle — flips the heart immediately, reverts if the save fails. */
  function handleToggleFavorite(recipe: LibraryRecipe) {
    const next = !recipe.favorited
    setRecipes((prev) => prev?.map((r) => (r.id === recipe.id ? { ...r, favorited: next } : r)) ?? prev)
    toggleLibraryFavorite(recipe.id, next).catch(() => {
      setRecipes((prev) => prev?.map((r) => (r.id === recipe.id ? { ...r, favorited: !next } : r)) ?? prev)
    })
  }

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <ScrollView contentContainerClassName="p-4">
        <Text className="mb-3 text-xs" style={{ color: c.muted }}>
          A shared catalog of ready-made recipes — browse, search, and add any of them straight to your own recipe box or plan.
        </Text>

        {isReplaceMode && (
          <View className="mb-3 rounded-xl border px-3 py-2.5" style={{ borderColor: c.blue, backgroundColor: 'rgba(87,169,255,0.1)' }}>
            <Text className="text-xs" style={{ color: c.blue }}>
              Choosing a replacement for <Text style={{ fontWeight: '700' }}>{params.replaceMealName}</Text> on {params.replaceDay}
            </Text>
          </View>
        )}
        {!isReplaceMode && params.presetDay && (
          <View className="mb-3 rounded-xl border px-3 py-2.5" style={{ borderColor: c.orange, backgroundColor: 'rgba(255,159,67,0.1)' }}>
            <Text className="text-xs" style={{ color: c.orange }}>
              Picking a meal to add to <Text style={{ fontWeight: '700' }}>{params.presetDay}</Text>
            </Text>
          </View>
        )}

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, ingredient, cuisine…"
          placeholderTextColor={c.muted}
          className="mb-3 rounded-xl border px-3 py-2.5 text-sm"
          style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
        />

        <View className="mb-2">
          <PillGroup options={CATEGORIES} value={category} onChange={setCategory} />
        </View>
        <View className="mb-2">
          <PillGroup options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
        </View>
        <Pressable
          onPress={() => setFavoritesOnly((v) => !v)}
          className="mb-4 flex-row items-center gap-1.5 self-start rounded-full border px-3.5 py-2"
          style={{ borderColor: favoritesOnly ? c.red : c.border, backgroundColor: favoritesOnly ? 'rgba(255,87,87,0.12)' : c.bg2 }}
        >
          <HeartButton favorited={favoritesOnly} onPress={() => setFavoritesOnly((v) => !v)} />
          <Text className="text-sm font-semibold" style={{ color: favoritesOnly ? c.red : c.muted }}>Favorites only</Text>
        </Pressable>

        {recipes === null && !error && (
          <View className="items-center py-10">
            <ActivityIndicator color={c.lime} />
          </View>
        )}
        {error ? <Text className="text-sm" style={{ color: c.red }}>{error}</Text> : null}
        {recipes?.length === 0 && (
          <Text className="text-sm" style={{ color: c.muted }}>
            {favoritesOnly ? 'No favorites yet — tap the heart on any recipe to save it here.' : 'No recipes match — try a different search or category.'}
          </Text>
        )}

        <View className="gap-3">
          {recipes?.map((recipe) => {
            const per = perServingMacros(recipe)
            return (
              <Pressable
                key={recipe.id}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/recipes/library-detail',
                    params: {
                      id: String(recipe.id),
                      recipe: JSON.stringify(recipe),
                      ...(isReplaceMode
                        ? { replaceDay: params.replaceDay!, replaceMealIndex: params.replaceMealIndex!, replaceMealName: params.replaceMealName! }
                        : params.presetDay
                          ? { presetDay: params.presetDay }
                          : {}),
                    },
                  })
                }
                className="overflow-hidden rounded-2xl border"
                style={{ borderColor: c.border, backgroundColor: c.bg2 }}
              >
                <View className="flex-row items-center justify-between gap-2 px-3.5 pt-3.5">
                  <View className="flex-1 flex-row items-center gap-1.5">
                    <Text className="text-base">{CATEGORY_EMOJI[recipe.category] ?? '🍴'}</Text>
                    <Text className="flex-1 text-[15px] font-bold" numberOfLines={1} style={{ color: c.text }}>{recipe.name}</Text>
                  </View>
                  <HeartButton favorited={!!recipe.favorited} onPress={() => handleToggleFavorite(recipe)} />
                </View>
                <View className="flex-row flex-wrap items-center gap-1.5 px-3.5 pb-3">
                  <Text className="text-xs" style={{ color: c.muted }}>
                    {recipe.cuisine} · {recipe.category}{recipe.servings > 1 ? ` · serves ${recipe.servings}` : ''}
                  </Text>
                  <DifficultyBadge difficulty={recipe.difficulty} />
                </View>

                <View className="mx-3.5 flex-row gap-1.5">
                  <MacroChip value={per.kcal} label="kcal" color={c.lime} c={c} />
                  <MacroChip value={per.protein} label="protein" color={c.blue} c={c} />
                  <MacroChip value={per.carbs} label="carbs" color={c.orange} c={c} />
                  <MacroChip value={per.fat} label="fat" color={c.red} c={c} />
                </View>

                <View className="flex-row flex-wrap gap-1.5 px-3.5 py-3">
                  {recipe.tags.slice(0, 4).map((tag) => (
                    <View key={tag} className="rounded-full px-2 py-0.5" style={{ backgroundColor: c.bg }}>
                      <Text className="text-[10px]" style={{ color: c.muted }}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}
