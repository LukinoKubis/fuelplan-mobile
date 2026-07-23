// Async equivalent of fuelplan-frontend/src/api/storage.ts — same STORAGE_KEYS
// and function names/shapes (loadJSON/saveJSON/loadString/saveString/remove),
// just Promise-returning since AsyncStorage has no synchronous API. The JWT
// token is deliberately NOT here — see secureStorage.ts.
import AsyncStorage from '@react-native-async-storage/async-storage'

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
} as const

export async function loadJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export async function loadString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key)
  } catch {
    return null
  }
}

export async function saveString(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

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
