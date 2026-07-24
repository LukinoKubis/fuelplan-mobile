// Ported verbatim from fuelplan-frontend/src/types/plan.ts
/** Daily macro targets/totals. */
export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/** A single meal within a day's plan. */
export interface Meal {
  time: string
  name: string
  protein: number
  carbs: number
  fat: number
  kcal: number
  ingredients: string
}

/** One day of the 7-day plan — macro totals plus its meals. */
export interface DayPlan {
  day: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  meals: Meal[]
}

/** A single Sunday batch-cook step, shown in the Prep tab. */
export interface PrepTask {
  task: string
  meal: string
  durationMinutes: number
  lane: string
  detail: string
}

/** A single shopping-list line item. */
export interface ShoppingItem {
  name: string
  qty: string
}

/** A grouped section of the shopping list (e.g. "Proteins"). */
export interface ShoppingCategory {
  category: string
  items: ShoppingItem[]
}

/** The full AI-generated plan — everything Fuel/Prep/Haul render from. */
export interface Plan {
  summary: Macros
  prep_tasks: PrepTask[]
  days: DayPlan[]
  shopping_list: ShoppingCategory[]
}

/** Lightweight metadata for a saved plan, as returned by the History list endpoint (no full plan JSON). */
export interface HistoryEntryMeta {
  id: number
  savedAt: string
  userName: string
  planName: string
  macros: Macros
}
