/**
 * The generated meal plan plus everything tied to it — survey profile,
 * shopping-list checks, eaten-meal toggles, favorited meals. Persisted to
 * AsyncStorage per-slice (see the useEffects in `PlanProvider` below).
 */
import { createContext, useCallback, useContext, useEffect, useReducer, useState, type ReactNode } from 'react'
import type { Plan } from '../types/plan'
import { EMPTY_PROFILE, type Profile } from '../types/profile'
import { loadJSON, remove, saveJSON, STORAGE_KEYS } from '../lib/storage'

interface PlanState {
  plan: Plan | null
  userName: string
  planName: string
  profile: Profile
  shopChecks: Record<string, boolean>
  eaten: Record<string, boolean>
  favorites: { name: string }[]
}

type Action =
  | { type: 'HYDRATE'; state: PlanState }
  | { type: 'SET_PLAN'; plan: Plan; userName: string; planName?: string }
  | { type: 'SET_PLAN_NAME'; planName: string }
  | { type: 'CLEAR_PLAN' }
  | { type: 'SET_PROFILE'; profile: Partial<Profile> }
  | { type: 'TOGGLE_SHOP_CHECK'; id: string }
  | { type: 'TOGGLE_EATEN'; id: string }
  | { type: 'TOGGLE_FAVORITE'; name: string }
  | { type: 'RESET_EATEN' }
  | { type: 'RESET_SHOP_CHECKS' }

const INITIAL_STATE: PlanState = {
  plan: null,
  userName: 'Your',
  planName: '',
  profile: EMPTY_PROFILE,
  shopChecks: {},
  eaten: {},
  favorites: [],
}

/**
 * Pure reducer — no storage side effects here (AsyncStorage is async, a
 * reducer can't be). Persistence happens via the useEffects below instead,
 * keyed off the specific state slices that changed.
 */
function reducer(state: PlanState, action: Action): PlanState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state
    case 'SET_PLAN':
      return { ...state, plan: action.plan, userName: action.userName, planName: action.planName ?? '', shopChecks: {}, eaten: {} }
    case 'SET_PLAN_NAME':
      return { ...state, planName: action.planName }
    case 'CLEAR_PLAN':
      return { ...state, plan: null, planName: '', shopChecks: {}, eaten: {} }
    case 'SET_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.profile } }
    case 'TOGGLE_SHOP_CHECK':
      return { ...state, shopChecks: { ...state.shopChecks, [action.id]: !state.shopChecks[action.id] } }
    case 'TOGGLE_EATEN':
      return { ...state, eaten: { ...state.eaten, [action.id]: !state.eaten[action.id] } }
    case 'TOGGLE_FAVORITE': {
      const exists = state.favorites.some((f) => f.name === action.name)
      const favorites = exists ? state.favorites.filter((f) => f.name !== action.name) : [...state.favorites, { name: action.name }]
      return { ...state, favorites }
    }
    case 'RESET_EATEN':
      return { ...state, eaten: {} }
    case 'RESET_SHOP_CHECKS':
      return { ...state, shopChecks: {} }
    default:
      return state
  }
}

interface PlanContextValue extends PlanState {
  isHydrated: boolean
  /** Replaces the whole plan (a fresh generation or a restored history entry). Resets shopChecks/eaten. */
  setPlan: (plan: Plan, userName: string, planName?: string) => void
  setPlanName: (planName: string) => void
  /** Clears the plan (kept for "Full Reset" in Settings) — profile/favorites survive. */
  clearPlan: () => void
  /** Merges a partial patch into the survey profile. */
  setProfile: (profile: Partial<Profile>) => void
  toggleShopCheck: (id: string) => void
  toggleEaten: (id: string) => void
  toggleFavorite: (name: string) => void
  /** Clears all eaten-meal state — "Reset Week Tracking" in Settings. */
  resetEaten: () => void
  /** Clears all shopping-list check state — "Reset Shopping List" in Settings. */
  resetShopChecks: () => void
  /** True while the survey/edit-profile flow should replace the Fuel tab's normal view. */
  surveyMode: boolean
  setSurveyMode: (value: boolean) => void
}

const PlanContext = createContext<PlanContextValue | null>(null)

/** Provides plan/profile state to the whole app — wrap it around everything in `src/app/_layout.tsx`. */
export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  const [surveyMode, setSurveyMode] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      loadJSON<Plan>(STORAGE_KEYS.plan),
      loadJSON<string>(STORAGE_KEYS.userName),
      loadJSON<string>(STORAGE_KEYS.planName),
      loadJSON<Partial<Profile>>(STORAGE_KEYS.profile),
      loadJSON<Record<string, boolean>>(STORAGE_KEYS.shopChecks),
      loadJSON<Record<string, boolean>>(STORAGE_KEYS.eaten),
      loadJSON<{ name: string }[]>(STORAGE_KEYS.favorites),
    ]).then(([plan, userName, planName, profile, shopChecks, eaten, favorites]) => {
      if (cancelled) return
      dispatch({
        type: 'HYDRATE',
        state: {
          plan,
          userName: userName || 'Your',
          planName: planName || '',
          profile: { ...EMPTY_PROFILE, ...(profile || {}) },
          shopChecks: shopChecks || {},
          eaten: eaten || {},
          favorites: favorites || [],
        },
      })
      setIsHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Persist each slice after hydration completes — skips the initial
  // hydration-triggered run so we don't immediately re-write what was just
  // read back.
  useEffect(() => {
    if (isHydrated) void saveJSON(STORAGE_KEYS.plan, state.plan)
  }, [isHydrated, state.plan])
  useEffect(() => {
    if (isHydrated) void saveJSON(STORAGE_KEYS.userName, state.userName)
  }, [isHydrated, state.userName])
  useEffect(() => {
    if (isHydrated) void saveJSON(STORAGE_KEYS.planName, state.planName)
  }, [isHydrated, state.planName])
  useEffect(() => {
    if (isHydrated) void saveJSON(STORAGE_KEYS.profile, state.profile)
  }, [isHydrated, state.profile])
  useEffect(() => {
    if (isHydrated) void saveJSON(STORAGE_KEYS.shopChecks, state.shopChecks)
  }, [isHydrated, state.shopChecks])
  useEffect(() => {
    if (isHydrated) void saveJSON(STORAGE_KEYS.eaten, state.eaten)
  }, [isHydrated, state.eaten])
  useEffect(() => {
    if (isHydrated) void saveJSON(STORAGE_KEYS.favorites, state.favorites)
  }, [isHydrated, state.favorites])
  // SET_PLAN clears eaten in-memory, but the on-disk key should be removed
  // outright (matches web behavior) rather than left as a saved `{}`.
  useEffect(() => {
    if (isHydrated && state.plan && Object.keys(state.eaten).length === 0) void remove(STORAGE_KEYS.eaten)
  }, [isHydrated, state.plan])

  const setPlan = useCallback((plan: Plan, userName: string, planName?: string) => {
    dispatch({ type: 'SET_PLAN', plan, userName, planName })
    void saveJSON(STORAGE_KEYS.activePlanSavedAt, new Date().toISOString())
  }, [])
  const setPlanName = useCallback((planName: string) => dispatch({ type: 'SET_PLAN_NAME', planName }), [])
  const clearPlan = useCallback(() => dispatch({ type: 'CLEAR_PLAN' }), [])
  const setProfile = useCallback((profile: Partial<Profile>) => dispatch({ type: 'SET_PROFILE', profile }), [])
  const toggleShopCheck = useCallback((id: string) => dispatch({ type: 'TOGGLE_SHOP_CHECK', id }), [])
  const toggleEaten = useCallback((id: string) => dispatch({ type: 'TOGGLE_EATEN', id }), [])
  const toggleFavorite = useCallback((name: string) => dispatch({ type: 'TOGGLE_FAVORITE', name }), [])
  const resetEaten = useCallback(() => dispatch({ type: 'RESET_EATEN' }), [])
  const resetShopChecks = useCallback(() => dispatch({ type: 'RESET_SHOP_CHECKS' }), [])

  return (
    <PlanContext.Provider
      value={{
        ...state,
        isHydrated,
        setPlan,
        setPlanName,
        clearPlan,
        setProfile,
        toggleShopCheck,
        toggleEaten,
        toggleFavorite,
        resetEaten,
        resetShopChecks,
        surveyMode,
        setSurveyMode,
      }}
    >
      {children}
    </PlanContext.Provider>
  )
}

/** Reads plan/profile state — must be called under a `PlanProvider`. */
export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used within PlanProvider')
  return ctx
}
