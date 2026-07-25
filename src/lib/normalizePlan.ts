import type { PrepTask, ShoppingCategory, ShoppingItem } from '../types/plan'

function normalizeItem(item: unknown): ShoppingItem | null {
  if (typeof item === 'string') return { name: item, qty: '' }
  if (item && typeof item === 'object' && 'name' in item) {
    const i = item as { name?: unknown; qty?: unknown }
    if (typeof i.name === 'string') return { name: i.name, qty: typeof i.qty === 'string' ? i.qty : '' }
  }
  return null
}

/**
 * The generation prompt asks Claude for `shopping_list` as an array of
 * `{ category, items: [{ name, qty }] }` (see prepAndShoppingPrompt.ts's
 * JSON_TEMPLATE), but it's returned at least three different shapes on
 * real generations while building Library M4/M5: a flat object keyed by
 * category (`{ produce: ["...", "..."] }`), and a flat array of `{name,
 * qty}` items with no category grouping at all. `ShoppingList.tsx` checks
 * `categories.length`, so a plain object (no `.length`) silently renders
 * the "no plan yet" empty state instead of crashing — a real but quiet
 * data-loss bug, not a crash. Normalizes all three shapes here, in the
 * single place a raw plan enters state (`PlanContext.setPlan`), so every
 * source (fresh generation, history restore) gets the same defensive
 * handling. A flat list with no categories lands under one "Groceries"
 * fallback category rather than being dropped.
 */
export function normalizeShoppingList(raw: unknown): ShoppingCategory[] {
  if (Array.isArray(raw)) {
    const categories: ShoppingCategory[] = []
    const looseItems: ShoppingItem[] = []
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue
      const e = entry as { category?: unknown; items?: unknown }
      if (typeof e.category === 'string' && Array.isArray(e.items)) {
        categories.push({ category: e.category, items: e.items.map(normalizeItem).filter((i): i is ShoppingItem => i !== null) })
        continue
      }
      const loose = normalizeItem(entry)
      if (loose) looseItems.push(loose)
    }
    if (looseItems.length) categories.push({ category: 'Groceries', items: looseItems })
    return categories
  }

  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([category, value]) => {
        if (!Array.isArray(value)) return null
        const items = value.map(normalizeItem).filter((i): i is ShoppingItem => i !== null)
        return { category, items }
      })
      .filter((c): c is ShoppingCategory => c !== null)
  }

  return []
}

function normalizePrepTask(entry: unknown): PrepTask | null {
  if (!entry || typeof entry !== 'object') return null
  const e = entry as { task?: unknown; meal?: unknown; durationMinutes?: unknown; lane?: unknown; detail?: unknown }
  if (typeof e.task !== 'string') return null
  return {
    task: e.task,
    meal: typeof e.meal === 'string' ? e.meal : '',
    durationMinutes: typeof e.durationMinutes === 'number' ? e.durationMinutes : 0,
    lane: typeof e.lane === 'string' ? e.lane : 'active',
    detail: typeof e.detail === 'string' ? e.detail : '',
  }
}

/**
 * Claude occasionally groups prep_tasks into invented "session" wrapper
 * objects (`{ session: "...", tasks: ["...", "..."] }`) instead of the
 * flat array of `{task, meal, durationMinutes, lane, detail}` objects
 * asked for — confirmed on a real generation while building Library M5,
 * despite the prompt explicitly forbidding it. Flattens that shape back
 * out (each string becomes its own task with sensible field defaults)
 * rather than losing the whole prep list to a shape mismatch.
 */
export function normalizePrepTasks(raw: unknown): PrepTask[] {
  if (!Array.isArray(raw)) return []
  const tasks: PrepTask[] = []
  for (const entry of raw) {
    const direct = normalizePrepTask(entry)
    if (direct) {
      tasks.push(direct)
      continue
    }
    if (entry && typeof entry === 'object' && Array.isArray((entry as { tasks?: unknown }).tasks)) {
      for (const t of (entry as { tasks: unknown[] }).tasks) {
        if (typeof t === 'string') tasks.push({ task: t, meal: '', durationMinutes: 0, lane: 'active', detail: '' })
      }
    }
  }
  return tasks
}
