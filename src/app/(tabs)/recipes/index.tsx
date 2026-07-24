import { useCallback, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Image } from 'expo-image'
import { Text } from '@/components/Text'
import { useFocusEffect, useRouter } from 'expo-router'
import { Header } from '../../../components/layout/Header'
import { getRecipeList } from '../../../lib/client'
import { useThemeColors } from '../../../lib/themeColors'
import type { Recipe } from '../../../types/recipe'

/** Recipes tab — the personal recipe box list. Refetches every time the tab regains focus, so a save/delete elsewhere is reflected without manual pull-to-refresh. */
export default function RecipesListScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)

  useFocusEffect(
    useCallback(() => {
      getRecipeList()
        .then((res) => setRecipes(res.recipes))
        .catch(() => setRecipes((prev) => prev ?? []))
    }, [])
  )

  return (
    <View className="flex-1 bg-light-bg dark:bg-bg">
      <Header onOpenSettings={() => router.push('/modal/settings')} />
      <ScrollView contentContainerClassName="p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="font-display text-lg" style={{ color: c.text }}>Your Recipes</Text>
          <Pressable onPress={() => router.push('/modal/recipe-import')} className="rounded-lg bg-lime px-3 py-1.5">
            <Text className="text-xs font-extrabold text-bg">+ Add</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/(tabs)/recipes/library')}
          className="mb-4 flex-row items-center justify-between rounded-xl border px-3.5 py-3"
          style={{ borderColor: c.border, backgroundColor: c.bg2 }}
        >
          <Text className="text-sm font-semibold" style={{ color: c.text }}>Browse Recipe Library →</Text>
        </Pressable>

        {recipes === null && <Text className="text-sm" style={{ color: c.muted }}>Loading…</Text>}
        {recipes?.length === 0 && (
          <Text className="text-sm" style={{ color: c.muted }}>
            No saved recipes yet. Paste a recipe or a caption from Instagram/TikTok to get started.
          </Text>
        )}

        <View className="gap-2.5">
          {recipes?.map((recipe) => (
            <Pressable
              key={recipe.id}
              onPress={() => router.push({ pathname: '/(tabs)/recipes/[id]', params: { id: String(recipe.id), recipe: JSON.stringify(recipe) } })}
              className="flex-row items-center gap-3 rounded-xl border p-3.5"
              style={{ borderColor: c.border, backgroundColor: c.bg2 }}
            >
              {recipe.photo ? (
                <Image source={{ uri: recipe.photo }} style={{ width: 48, height: 48, borderRadius: 8 }} contentFit="cover" />
              ) : null}
              <View className="min-w-0 flex-1">
                <Text className="mb-1 text-sm font-semibold" numberOfLines={1} style={{ color: c.text }}>{recipe.name}</Text>
                <Text className="text-xs" style={{ color: c.muted }}>
                  {Math.round((recipe.macros?.kcal ?? 0) / (recipe.servings && recipe.servings > 0 ? recipe.servings : 1))} kcal/serving
                  {recipe.servings && recipe.servings > 1 ? ` (serves ${recipe.servings})` : ''} · {recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? '' : 's'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
