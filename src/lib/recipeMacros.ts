import type { Macros } from '../types/plan'

/** A recipe's macros are always stored as the WHOLE recipe as extracted/authored — divide by servings (default 1) to get what one portion actually looks like. Shared between the personal recipe detail screen and the library detail screen. */
export function perServingMacros(recipe: { macros: Macros; servings?: number }): Macros {
  const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1
  return {
    kcal: Math.round((recipe.macros.kcal ?? 0) / servings),
    protein: Math.round((recipe.macros.protein ?? 0) / servings),
    carbs: Math.round((recipe.macros.carbs ?? 0) / servings),
    fat: Math.round((recipe.macros.fat ?? 0) / servings),
  }
}
