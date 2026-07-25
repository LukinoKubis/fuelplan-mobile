import type { DayPlan, Macros, Meal } from '../types/plan'
import type { LibraryRecipe } from '../types/recipeLibrary'
import type { Profile } from '../types/profile'

export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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

// `recipe.ingredients[i].qty` is the WHOLE recipe's quantity (e.g. "6 large"
// on a recipe that serves 4), not a per-serving amount — has to be divided
// by the recipe's own servings before applying the macro-fit factor, or
// quantities come out inflated by the recipe's original serving count.
// Real bug hit and fixed: a 4-serving recipe scaled to a ~1.86x macro-fit
// factor produced "11 large eggs" for a single meal (6 raw the recipe
// calls for x 1.86, never divided by 4) instead of the correct ~2.75.
function formatIngredients(recipe: LibraryRecipe, factor: number): string {
  const servings = recipe.servings > 0 ? recipe.servings : 1
  const perServingFactor = factor / servings
  return recipe.ingredients.map((i) => (i.qty ? `${scaleQtyString(i.qty, perServingFactor)} ${i.name}` : i.name)).join(', ')
}

/** Best-effort keyword match against a recipe's name + ingredient names — same spirit as the AI prompt's existing dislikedFoods handling, just enforced algorithmically instead of trusted to a model. */
function conflictsWithDislikes(recipe: LibraryRecipe, disliked: string[]): boolean {
  if (!disliked.length) return false
  const text = (recipe.name + ' ' + recipe.ingredients.map((i) => i.name).join(' ')).toLowerCase()
  return disliked.some((d) => d && text.includes(d))
}

/** Soft nudge away from reusing an already-used recipe — the actual variety cap comes from selectRotationPool() below limiting the pool size itself, not from this penalty. Still useful as a tie-breaker so a 2-or-3-recipe rotation pool actually alternates rather than always picking the single best-fitting one. */
function repeatPenalty(usedCount: number): number {
  return usedCount * 60
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

// Real bug hit and fixed: protein was penalized symmetrically (overshoot
// as harshly as undershoot), so a recipe that would overshoot the protein
// sub-target scored no better than one that undershot it by the same
// amount — the picker had no real pressure toward the highest-protein
// options even when the library had plenty of headroom. Confirmed live: a
// 220g/day protein target landed 184-204g despite ~258g being reachable
// at the same kcal from the library available at the time. Undershoot is
// penalized harder than overshoot (protein surplus is essentially never
// bad; falling short of a stated target is the actual complaint) — but
// not by a huge margin: an early near-zero overshoot penalty (0.4x)
// swung too far the other way once the library grew more high-density
// staples, overshooting by 20-38g/day. 2.5x (vs 4x for undershoot) is
// the empirically tuned middle ground verified across multiple target
// profiles (aggressive/moderate/cutting), landing exactly on target or a
// small deliberate overshoot, never under. Kcal/carbs/fat stay
// symmetric — those really do have a "too much" side that matters
// (especially carbs/fat on a cut), unlike protein.
function proteinError(actual: number, target: number): number {
  const diff = actual - target
  return diff >= 0 ? diff * 2.5 : Math.abs(diff) * 4
}

function dayError(totals: Macros, target: Macros): number {
  return (
    Math.abs(totals.kcal - target.kcal) * 0.05 +
    proteinError(totals.protein, target.protein) +
    Math.abs(totals.carbs - target.carbs) * 0.5 +
    Math.abs(totals.fat - target.fat) * 1
  )
}

function cuisineBonus(recipe: LibraryRecipe, preferredCuisines: string[]): number {
  return preferredCuisines.some((c) => recipe.cuisine.toLowerCase().includes(c.toLowerCase())) ? 20 : 0
}

const DIFFICULTY_ORDER = ['beginner', 'intermediate', 'advanced']

/** A recipe matching the user's stated cooking skill gets a small bonus; one that's two tiers off (e.g. a beginner cook, an advanced recipe) gets a penalty. One tier off either direction is fine — no bonus, no penalty. */
function difficultyBonus(recipe: LibraryRecipe, cookingSkill: string): number {
  if (!cookingSkill) return 0
  if (recipe.difficulty === cookingSkill) return 15
  const gap = Math.abs(DIFFICULTY_ORDER.indexOf(recipe.difficulty) - DIFFICULTY_ORDER.indexOf(cookingSkill))
  return gap >= 2 ? -20 : 0
}

/**
 * Picks the top `count` distinct recipes for a slot against its macro
 * sub-target — this is what actually enforces "switch between at most N
 * meals", not a soft penalty. Meal prep is repetitive by design (the
 * user's framing: "usually people switch between 2 lunches at max"), so
 * rather than freely picking from the whole category pool every day, the
 * week's pool for a slot is capped to this small set up front, and the
 * per-day picks below (initialPickForSlot/repairDay) only ever choose
 * from within it.
 */
function selectRotationPool(pool: LibraryRecipe[], target: Macros, count: number, preferredCuisines: string[], cookingSkill: string): LibraryRecipe[] {
  const scored = pool.map((recipe) => {
    const factor = bestFactorForTarget(recipe, target.kcal)
    const score = dayError(scaledMacros(recipe, factor), target) - cuisineBonus(recipe, preferredCuisines) - difficultyBonus(recipe, cookingSkill)
    return { recipe, score }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, Math.max(1, count)).map((s) => s.recipe)
}

function initialPickForSlot(pool: LibraryRecipe[], target: Macros, usedCounts: Map<number, number>, preferredCuisines: string[]): { recipe: LibraryRecipe; factor: number } | null {
  let best: { recipe: LibraryRecipe; factor: number; score: number } | null = null

  for (const recipe of pool) {
    const factor = bestFactorForTarget(recipe, target.kcal)
    const m = scaledMacros(recipe, factor)
    const score = dayError(m, target) + repeatPenalty(usedCounts.get(recipe.id) || 0) - cuisineBonus(recipe, preferredCuisines)

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
function repairDay(picks: Pick[], target: Macros, pools: LibraryPools, usedCounts: Map<number, number>, preferredCuisines: string[]): Pick[] {
  const current = [...picks]

  for (let iter = 0; iter < MAX_REPAIR_ITERATIONS; iter++) {
    const currentError = dayError(sumMacros(current), target)
    let bestSwap: { index: number; recipe: LibraryRecipe; factor: number; error: number } | null = null

    for (let i = 0; i < current.length; i++) {
      const slot = current[i].slot
      const pool = pools[slot.key] // already capped to the slot's rotation pool — a repair swap can only pick among those same N recipes, never outside the rotation cap
      const slotShareTarget: Macros = { kcal: target.kcal * slot.share, protein: target.protein * slot.share, carbs: target.carbs * slot.share, fat: target.fat * slot.share }

      for (const recipe of pool) {
        const factor = bestFactorForTarget(recipe, slotShareTarget.kcal)
        const candidateTotals = sumMacros([...current.slice(0, i), { slot, recipe, factor }, ...current.slice(i + 1)])
        const usedCount = usedCounts.get(recipe.id) || 0
        const alreadyThisSlot = recipe.id === current[i].recipe.id
        const error =
          dayError(candidateTotals, target) +
          repeatPenalty(alreadyThisSlot ? Math.max(0, usedCount - 1) : usedCount) * 0.3 -
          cuisineBonus(recipe, preferredCuisines) * 0.3

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
 * AI call. Meal prep is repetitive by design, so before assembling any
 * days, each slot's usable pool is first capped down to `profile.variety`
 * distinct recipes (selectRotationPool) — "1" means the same meal every
 * day, "2"/"3" means rotating between that many, never more. Then for each
 * day: an initial per-slot pick from within that capped pool against
 * proportional macro sub-targets, a local-search repair pass that swaps
 * toward a better day-level macro fit (see repairDay, still constrained to
 * the same capped pool), then one bounded final kcal-only correction so
 * the day's kcal total lands almost exactly on target.
 */
export function assemblePlanFromLibrary(macros: Macros, profile: Profile, pools: LibraryPools): DayPlan[] {
  // A true content gap (library not seeded, or a fetch that "succeeded"
  // with nothing in it) — fail loudly here rather than silently returning
  // 7 empty days. Scaling handles the magnitude problem (see module doc),
  // but there's nothing to scale if a category has zero recipes.
  if (!pools.breakfast.length && !pools.lunch.length && !pools.dinner.length && !pools.snack.length) {
    throw new Error('The recipe library is empty — nothing to build a plan from yet.')
  }

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

  const rotationCount = Math.max(1, Math.min(3, parseInt(profile.variety, 10) || 2))
  const rotationPools: LibraryPools = {} as LibraryPools
  for (const slot of SLOTS) {
    const target: Macros = { kcal: macros.kcal * slot.share, protein: macros.protein * slot.share, carbs: macros.carbs * slot.share, fat: macros.fat * slot.share }
    rotationPools[slot.key] = selectRotationPool(effectivePools[slot.key], target, rotationCount, profile.cuisines, profile.cookingSkill)
  }

  const usedCounts = new Map<number, number>()
  const days: DayPlan[] = []

  for (const day of WEEK_DAYS) {
    let picks: Pick[] = []

    for (const slot of SLOTS) {
      const target: Macros = { kcal: macros.kcal * slot.share, protein: macros.protein * slot.share, carbs: macros.carbs * slot.share, fat: macros.fat * slot.share }
      const picked = initialPickForSlot(rotationPools[slot.key], target, usedCounts, profile.cuisines)
      if (!picked) continue
      picks.push({ slot, recipe: picked.recipe, factor: picked.factor })
      usedCounts.set(picked.recipe.id, (usedCounts.get(picked.recipe.id) || 0) + 1)
    }

    picks = repairDay(picks, macros, rotationPools, usedCounts, profile.cuisines)

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

/** Fetches the full library, one category at a time — unlike libraryGrounding.ts's old compact sample, assemblePlanFromLibrary needs the whole pool to actually pick from, not just a naming hint. */
export async function getLibraryPools(): Promise<LibraryPools> {
  // Dynamic import, not a top-level one — client.ts pulls in RN/AsyncStorage
  // transitively, which would make this whole module fail to load outside
  // a bundler (e.g. a plain tsx script testing assemblePlanFromLibrary in
  // isolation, as used throughout this feature's development). Keeps the
  // pure algorithm above genuinely free of RN dependencies at module-load
  // time; only this fetch wrapper needs them, and only once actually called.
  const { getRecipeLibrary } = await import('./client')
  const [breakfast, lunch, dinner, snack] = await Promise.all([
    getRecipeLibrary({ category: 'breakfast' }),
    getRecipeLibrary({ category: 'lunch' }),
    getRecipeLibrary({ category: 'dinner' }),
    getRecipeLibrary({ category: 'snack' }),
  ])
  return { breakfast: breakfast.recipes, lunch: lunch.recipes, dinner: dinner.recipes, snack: snack.recipes }
}
