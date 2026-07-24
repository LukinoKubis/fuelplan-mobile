import { getRecipeLibrary } from './client'
import type { LibraryRecipe } from '../types/recipeLibrary'

export interface GroundingCandidate {
  name: string
  category: LibraryRecipe['category']
  cuisine: string
  tags: string[]
  perServing: { kcal: number; protein: number; carbs: number; fat: number }
  ingredientNames: string[]
}

const CATEGORIES: LibraryRecipe['category'][] = ['breakfast', 'lunch', 'dinner', 'snack']
const PER_CATEGORY = 3

function toCandidate(r: LibraryRecipe): GroundingCandidate {
  const servings = r.servings > 0 ? r.servings : 1
  return {
    name: r.name,
    category: r.category,
    cuisine: r.cuisine,
    tags: r.tags,
    perServing: {
      kcal: Math.round(r.macros.kcal / servings),
      protein: Math.round(r.macros.protein / servings),
      carbs: Math.round(r.macros.carbs / servings),
      fat: Math.round(r.macros.fat / servings),
    },
    ingredientNames: r.ingredients.slice(0, 6).map((i) => i.name),
  }
}

/** Shuffles then takes n — a lightweight variety mechanism so the same plan generation doesn't always see the same library slice for a category. */
function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

/**
 * Pulls a compact, cuisine-biased sample of library recipes to ground plan
 * generation — best-effort, never blocks or fails plan generation if the
 * library is empty or unreachable. Cuisine preference is applied client-side
 * (fetch each category, prefer entries matching the profile's chosen
 * cuisines when there are enough of them) rather than adding new backend
 * filtering, since `/api/library/list` already supports category filtering
 * and the sample sizes here are small.
 */
export async function getGroundingCandidates(preferredCuisines: string[]): Promise<GroundingCandidate[]> {
  try {
    const results = await Promise.all(
      CATEGORIES.map((category) => getRecipeLibrary({ category }).catch(() => ({ recipes: [] as LibraryRecipe[] })))
    )
    const candidates: GroundingCandidate[] = []
    for (const { recipes } of results) {
      if (!recipes.length) continue
      let pool = recipes
      if (preferredCuisines.length) {
        const preferred = recipes.filter((r) => preferredCuisines.some((c) => r.cuisine.toLowerCase().includes(c.toLowerCase())))
        if (preferred.length >= 3) pool = preferred
      }
      candidates.push(...sample(pool, PER_CATEGORY).map(toCandidate))
    }
    return candidates
  } catch {
    return []
  }
}
