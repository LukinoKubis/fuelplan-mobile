import type { ShoppingCategory, ShoppingItem } from '../types/plan'

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
 * `{ category, items: [{ name, qty }] }` (see generatePrompt.ts's
 * JSON_TEMPLATE), but it occasionally returns a flat object keyed by
 * category instead (e.g. `{ produce: ["...", "..."] }`) — confirmed on a
 * real generation while building Library M4. `ShoppingList.tsx` checks
 * `categories.length`, so a plain object (no `.length`) silently renders
 * the "no plan yet" empty state instead of crashing — a real but quiet
 * data-loss bug, not a crash. Normalizes both shapes here, in the single
 * place a raw plan enters state (`PlanContext.setPlan`), so every source
 * (fresh generation, history restore) gets the same defensive handling.
 */
export function normalizeShoppingList(raw: unknown): ShoppingCategory[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const e = entry as { category?: unknown; items?: unknown }
        if (typeof e.category !== 'string' || !Array.isArray(e.items)) return null
        const items = e.items.map(normalizeItem).filter((i): i is ShoppingItem => i !== null)
        return { category: e.category, items }
      })
      .filter((c): c is ShoppingCategory => c !== null)
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
