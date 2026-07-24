// Mirrors claude-backend's LibraryRecipe (src/server.ts) 1:1. Distinct
// from types/recipe.ts's Recipe — that's a personal, per-user saved
// recipe; this is one entry in the shared, admin-seeded catalog every
// user reads the same copy of.
import type { Macros } from './plan'
import type { RecipeIngredient } from './recipe'

export interface LibraryRecipe {
  id: number
  name: string
  ingredients: RecipeIngredient[]
  steps: string[]
  macros: Macros
  servings: number
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  cuisine: string
  tags: string[]
  createdAt: string
}
