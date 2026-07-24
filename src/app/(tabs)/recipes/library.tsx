import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native'
import { Text } from '@/components/Text'
import { useRouter } from 'expo-router'
import { getRecipeLibrary } from '../../../lib/client'
import { useThemeColors } from '../../../lib/themeColors'
import { PillGroup } from '../../../components/survey/Chips'
import type { LibraryRecipe } from '../../../types/recipeLibrary'

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

/**
 * Browse/search the shared recipe library (admin-seeded catalog, every
 * user reads the same copy) — distinct from index.tsx's personal recipe
 * box. Search is debounced client-side; filtering itself happens
 * server-side (see claude-backend's /api/library/list) so this screen
 * never has to pull the whole catalog just to show one category.
 */
export default function RecipeLibraryScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [recipes, setRecipes] = useState<LibraryRecipe[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setRecipes((prev) => prev) // keep showing stale results while refetching, avoids a flash to "Loading…" on every keystroke
    getRecipeLibrary({ category: category || undefined, search: debouncedSearch || undefined })
      .then((res) => {
        if (!cancelled) setRecipes(res.recipes)
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the library — try again.")
      })
    return () => {
      cancelled = true
    }
  }, [category, debouncedSearch])

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <ScrollView contentContainerClassName="p-4">
        <Text className="mb-3 text-xs" style={{ color: c.muted }}>
          A shared catalog of ready-made recipes — browse, search, and add any of them straight to your own recipe box or plan.
        </Text>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, ingredient, cuisine…"
          placeholderTextColor={c.muted}
          className="mb-3 rounded-xl border px-3 py-2.5 text-sm"
          style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
        />

        <View className="mb-4">
          <PillGroup options={CATEGORIES} value={category} onChange={setCategory} />
        </View>

        {recipes === null && !error && (
          <View className="items-center py-10">
            <ActivityIndicator color={c.lime} />
          </View>
        )}
        {error ? <Text className="text-sm" style={{ color: c.red }}>{error}</Text> : null}
        {recipes?.length === 0 && (
          <Text className="text-sm" style={{ color: c.muted }}>No recipes match — try a different search or category.</Text>
        )}

        <View className="gap-2.5">
          {recipes?.map((recipe) => {
            const perServingKcal = Math.round(recipe.macros.kcal / (recipe.servings > 0 ? recipe.servings : 1))
            return (
              <Pressable
                key={recipe.id}
                onPress={() =>
                  router.push({ pathname: '/(tabs)/recipes/library-detail', params: { id: String(recipe.id), recipe: JSON.stringify(recipe) } })
                }
                className="rounded-xl border p-3.5"
                style={{ borderColor: c.border, backgroundColor: c.bg2 }}
              >
                <Text className="mb-1 text-sm font-semibold" numberOfLines={1} style={{ color: c.text }}>{recipe.name}</Text>
                <Text className="mb-1.5 text-xs" style={{ color: c.muted }}>
                  {perServingKcal} kcal/serving · {recipe.cuisine} · {recipe.category}
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
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
