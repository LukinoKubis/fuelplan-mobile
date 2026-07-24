import type { DayPlan, Macros, Meal } from '../types/plan'
import type { LibraryRecipe } from '../types/recipeLibrary'
import type { Profile } from '../types/profile'

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface Slot {
  key: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  time: string
  share: number
}

// Chronological order (matches real meal times), not JSON_TEMPLATE's old
// breakfast/lunch/dinner/snack ordering — this is what actually renders in
// the Fuel tab's meal list.
const SLOTS: Slot[] = [
  { key: 'breakfast', time: 'Breakfast 7:00', share: 0.25 },
  { key: 'lunch', time: 'Lunch 13:00', share: 0.3 },
  { key: 'snack', time: 'Snack 16:00', share: 0.1 },
  { key: 'dinner', time: 'Dinner 19:30', share: 0.35 },
]

// How far a recipe can be scaled up/down to hit a slot's target. Wide enough
// to cover most kcal gaps, narrow enough that a 300kcal snack doesn't get
// stretched into an implausible 1000kcal "snack".
const MIN_SCALE = 0.5
const MAX_SCALE = 2.2

const MAX_REPAIR_ITERATIONS = 8

export interface LibraryPools {
  breakfast: LibraryRecipe[]
  lunch: LibraryRecipe[]
  dinner: LibraryRecipe[]
  snack: LibraryRecipe[]
}

function perServing(r: LibraryRecipe): Macros {
  const s = r.servings > 0 ? r.servings : 1
  return { kcal: r.macros.kcal / s, protein: r.macros.protein / s, carbs: r.macros.carbs / s, fat: r.macros.fat / s }
}

/** Rounds a scaled ingredient quantity to a sensible precision for its magnitude — no point in "6.37 large eggs". */
function roundQty(n: number): number {
  if (n < 3) return Math.round(n * 4) / 4
  if (n < 10) return Math.round(n * 2) / 2
  if (n < 50) return Math.round(n)
  return Math.round(n / 5) * 5
}

/** Scales the leading number in a free-text quantity ("150g" -> "180g", "6 large" -> "7 large"); quantities with no leading number (e.g. "to taste") pass through unscaled. */
function scaleQtyString(qty: string, factor: number): string {
  const m = qty.trim().match(/^(\d+(?:\.\d+)?)(.*)$/)
  if (!m) return qty
  const scaled = roundQty(parseFloat(m[1]) * factor)
  return `${scaled}${m[2]}`
}

function formatIngredients(recipe: LibraryRecipe, factor: number): string {
  return recipe.ingredients.map((i) => (i.qty ? `${scaleQtyString(i.qty, factor)} ${i.name}` : i.name)).join(', ')
}

/** Best-effort keyword match against a recipe's name + ingredient names — same spirit as the AI prompt's existing dislikedFoods handling, just enforced algorithmically instead of trusted to a model. */
function conflictsWithDislikes(recipe: LibraryRecipe, disliked: string[]): boolean {
  if (!disliked.length) return false
  const text = (recipe.name + ' ' + recipe.ingredients.map((i) => i.name).join(' ')).toLowerCase()
  return disliked.some((d) => d && text.includes(d))
}

function varietyPenalty(usedCount: number, variety: string): number {
  if (variety === 'fully diverse') return usedCount * 500
  if (variety === 'repeat') return usedCount === 0 ? 30 : 0
  return usedCount * 60 // "some variety" — discourage repeats without forbidding them
}

function bestFactorForTarget(recipe: LibraryRecipe, targetKcal: number): number {
  const ps = perServing(recipe)
  if (ps.kcal <= 0) return 1
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetKcal / ps.kcal))
}

function scaledMacros(recipe: LibraryRecipe, factor: number): Macros {
  const ps = perServing(recipe)
  return {
    kcal: Math.round(ps.kcal * factor),
    protein: Math.round(ps.protein * factor),
    carbs: Math.round(ps.carbs * factor),
    fat: Math.round(ps.fat * factor),
  }
}

interface Pick {
  slot: Slot
  recipe: LibraryRecipe
  factor: number
}

function sumMacros(picks: Pick[]): Macros {
  return picks.reduce(
    (sum, p) => {
      const m = scaledMacros(p.recipe, p.factor)
      return { kcal: sum.kcal + m.kcal, protein: sum.protein + m.protein, carbs: sum.carbs + m.carbs, fat: sum.fat + m.fat }
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

/** Protein is weighted heaviest — it's the macro real recipes vary most in density, and the one most likely to land far off target if selection only optimized for kcal. Kcal itself gets a light weight here since the final correction pass (see below) fixes it precisely regardless. */
function dayError(totals: Macros, target: Macros): number {
  return (
    Math.abs(totals.kcal - target.kcal) * 0.05 +
    Math.abs(totals.protein - target.protein) * 3 +
    Math.abs(totals.carbs - target.carbs) * 0.5 +
    Math.abs(totals.fat - target.fat) * 1
  )
}

function initialPickForSlot(pool: LibraryRecipe[], target: Macros, usedCounts: Map<number, number>, variety: string, preferredCuisines: string[]): { recipe: LibraryRecipe; factor: number } | null {
  let best: { recipe: LibraryRecipe; factor: number; score: number } | null = null

  for (const recipe of pool) {
    const factor = bestFactorForTarget(recipe, target.kcal)
    const m = scaledMacros(recipe, factor)
    const score =
      dayError(m, target) +
      varietyPenalty(usedCounts.get(recipe.id) || 0, variety) -
      (preferredCuisines.some((c) => recipe.cuisine.toLowerCase().includes(c.toLowerCase())) ? 20 : 0)

    if (!best || score < best.score) best = { recipe, factor, score }
  }

  return best ? { recipe: best.recipe, factor: best.factor } : null
}

/**
 * Local-search repair: picking each slot independently against a fixed
 * proportional sub-target (e.g. lunch = 30% of the day) works fine for kcal,
 * but real recipes vary a lot in protein *density* — a day assembled from
 * otherwise-reasonable picks can still land 30-40g of protein under target
 * with no single slot obviously "wrong". Fixes that by repeatedly trying to
 * swap the worst-fitting slot for a better alternative from its own pool,
 * scored against the *actual remaining day-level error*, not just that
 * slot's static sub-target — and stops as soon as a pass finds no
 * improving swap (a local optimum, not a fixed iteration count).
 */
function repairDay(picks: Pick[], target: Macros, pools: LibraryPools, usedCounts: Map<number, number>, variety: string, preferredCuisines: string[]): Pick[] {
  const current = [...picks]

  for (let iter = 0; iter < MAX_REPAIR_ITERATIONS; iter++) {
    const currentError = dayError(sumMacros(current), target)
    let bestSwap: { index: number; recipe: LibraryRecipe; factor: number; error: number } | null = null

    for (let i = 0; i < current.length; i++) {
      const slot = current[i].slot
      const pool = pools[slot.key]
      const slotShareTarget: Macros = { kcal: target.kcal * slot.share, protein: target.protein * slot.share, carbs: target.carbs * slot.share, fat: target.fat * slot.share }

      for (const recipe of pool) {
        const factor = bestFactorForTarget(recipe, slotShareTarget.kcal)
        const candidateTotals = sumMacros([...current.slice(0, i), { slot, recipe, factor }, ...current.slice(i + 1)])
        const usedCount = usedCounts.get(recipe.id) || 0
        const alreadyThisSlot = recipe.id === current[i].recipe.id
        const error =
          dayError(candidateTotals, target) +
          varietyPenalty(alreadyThisSlot ? Math.max(0, usedCount - 1) : usedCount, variety) * 0.3 -
          (preferredCuisines.some((c) => recipe.cuisine.toLowerCase().includes(c.toLowerCase())) ? 6 : 0)

        if (error < currentError - 0.01 && (!bestSwap || error < bestSwap.error)) {
          bestSwap = { index: i, recipe, factor, error }
        }
      }
    }

    if (!bestSwap) break // local optimum — no swap improves the day further

    const old = current[bestSwap.index]
    usedCounts.set(old.recipe.id, Math.max(0, (usedCounts.get(old.recipe.id) || 0) - 1))
    current[bestSwap.index] = { slot: old.slot, recipe: bestSwap.recipe, factor: bestSwap.factor }
    usedCounts.set(bestSwap.recipe.id, (usedCounts.get(bestSwap.recipe.id) || 0) + 1)
  }

  return current
}

/**
 * Assembles a full 7-day plan entirely from the shared recipe library — no
 * AI call. For each day: an initial per-slot pick against proportional
 * macro sub-targets, a local-search repair pass that swaps toward a better
 * day-level macro fit (see repairDay), then one bounded final kcal-only
 * correction so the day's kcal total lands almost exactly on target.
 */
export function assemblePlanFromLibrary(macros: Macros, profile: Profile, pools: LibraryPools): DayPlan[] {
  const disliked = profile.dislikedFoods
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  const filtered: LibraryPools = {
    breakfast: pools.breakfast.filter((r) => !conflictsWithDislikes(r, disliked)),
    lunch: pools.lunch.filter((r) => !conflictsWithDislikes(r, disliked)),
    dinner: pools.dinner.filter((r) => !conflictsWithDislikes(r, disliked)),
    snack: pools.snack.filter((r) => !conflictsWithDislikes(r, disliked)),
  }
  const effectivePools: LibraryPools = {
    breakfast: filtered.breakfast.length ? filtered.breakfast : pools.breakfast,
    lunch: filtered.lunch.length ? filtered.lunch : pools.lunch,
    dinner: filtered.dinner.length ? filtered.dinner : pools.dinner,
    snack: filtered.snack.length ? filtered.snack : pools.snack,
  }

  const usedCounts = new Map<number, number>()
  const days: DayPlan[] = []

  for (const day of WEEK_DAYS) {
    let picks: Pick[] = []

    for (const slot of SLOTS) {
      const target: Macros = { kcal: macros.kcal * slot.share, protein: macros.protein * slot.share, carbs: macros.carbs * slot.share, fat: macros.fat * slot.share }
      const picked = initialPickForSlot(effectivePools[slot.key], target, usedCounts, profile.variety, profile.cuisines)
      if (!picked) continue
      picks.push({ slot, recipe: picked.recipe, factor: picked.factor })
      usedCounts.set(picked.recipe.id, (usedCounts.get(picked.recipe.id) || 0) + 1)
    }

    picks = repairDay(picks, macros, effectivePools, usedCounts, profile.variety, profile.cuisines)

    const actualKcal = sumMacros(picks).kcal
    const correction = actualKcal > 0 ? Math.min(1.15, Math.max(0.85, macros.kcal / actualKcal)) : 1

    const meals: Meal[] = []
    let dayTotals: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

    for (const { slot, recipe, factor } of picks) {
      const finalFactor = Math.min(MAX_SCALE, Math.max(MIN_SCALE, factor * correction))
      const m = scaledMacros(recipe, finalFactor)
      meals.push({
        time: slot.time,
        name: recipe.name,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        kcal: m.kcal,
        ingredients: formatIngredients(recipe, finalFactor),
      })
      dayTotals = { kcal: dayTotals.kcal + m.kcal, protein: dayTotals.protein + m.protein, carbs: dayTotals.carbs + m.carbs, fat: dayTotals.fat + m.fat }
    }

    days.push({ day, ...dayTotals, meals })
  }

  return days
}
