// Mirrors claude-backend's RecipeRecord (src/server.ts) 1:1.
import type { Macros } from './plan'

/** One ingredient line within a recipe. */
export interface RecipeIngredient {
  name: string
  qty: string
}

/** A saved recipe in the user's personal recipe box. */
export interface Recipe {
  id: number
  name: string
  ingredients: RecipeIngredient[]
  steps: string[]
  macros: Macros
  servings?: number
  sourceUrl?: string
  sourceCaption?: string
  sourcePlatform?: 'instagram' | 'tiktok' | 'manual' | 'other'
  savedAt: string
  updatedAt?: string
}
