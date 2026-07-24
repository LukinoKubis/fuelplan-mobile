// Async equivalent of fuelplan-frontend/src/api/storage.ts — same STORAGE_KEYS
// and function names/shapes (loadJSON/saveJSON/loadString/saveString/remove),
// just Promise-returning since AsyncStorage has no synchronous API. The JWT
// token is deliberately NOT here — see secureStorage.ts.
import AsyncStorage from '@react-native-async-storage/async-storage'

/** All `fp_`-prefixed AsyncStorage keys used by the app (JWT excluded — see secureStorage.ts). */
export const STORAGE_KEYS = {
  userEmail: 'fp_userEmail',
  plan: 'fp_plan',
  planName: 'fp_planName',
  userName: 'fp_userName',
  profile: 'fp_profile',
  shopChecks: 'fp_shopChecks',
  activeSection: 'fp_activeSection',
  activeDay: 'fp_activeDay',
  onboarded: 'fp_onboarded',
  eaten: 'fp_eaten',
  activePlanSavedAt: 'fp_activePlanSavedAt',
  theme: 'fp_theme',
  favorites: 'fp_favorites',
  pushToken: 'fp_pushToken',
} as const

/** Reads and JSON-parses a stored value; null if missing or malformed. */
export async function loadJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** JSON-stringifies and stores a value. Fails silently (quota/privacy-mode errors aren't actionable here). */
export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/** Reads a raw string value (no JSON parsing) — for plain values like the theme name. */
export async function loadString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key)
  } catch {
    return null
  }
}

/** Stores a raw string value (no JSON stringifying). */
export async function saveString(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

/** Deletes a single stored key. */
export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** Clears every plan-related key (used by Settings' "Full Reset") — profile/theme/favorites are untouched by callers that don't also clear those separately. */
export async function clearPlanData(): Promise<void> {
  await Promise.all(
    [
      STORAGE_KEYS.plan,
      STORAGE_KEYS.planName,
      STORAGE_KEYS.userName,
      STORAGE_KEYS.profile,
      STORAGE_KEYS.shopChecks,
      STORAGE_KEYS.activeDay,
      STORAGE_KEYS.eaten,
      STORAGE_KEYS.activePlanSavedAt,
    ].map(remove)
  )
}
