/**
 * Dark/light theme state for the whole app. Persists the user's choice to
 * AsyncStorage and drives NativeWind's `colorScheme`, which is what makes
 * every `dark:`-prefixed className actually respond to the toggle (plain
 * `useColorScheme()` alone only reflects OS appearance, not a manual
 * override — see CLAUDE.md's "Theme switching" section).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { colorScheme } from 'nativewind'
import { loadString, saveString, STORAGE_KEYS } from '../lib/storage'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  /** Current resolved theme — defaults to 'dark' until hydration completes. */
  theme: Theme
  /** Flips the theme, persists it, and updates NativeWind's colorScheme. */
  toggleTheme: () => void
  /** True once the persisted theme has been read from storage. */
  isHydrated: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Provides theme state to the whole app. Must wrap everything that renders
 * themed UI — `src/app/_layout.tsx`'s `AppReadyGate` waits on `isHydrated`
 * before rendering the real route tree, so no screen ever flashes the
 * wrong theme on launch.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [isHydrated, setIsHydrated] = useState(false)

  // Read the persisted preference once on mount. AsyncStorage has no sync
  // API, so this can't be a lazy useState initializer the way the web
  // app's localStorage-backed version was — see CLAUDE.md's "Async
  // storage" section for the full pattern this follows.
  useEffect(() => {
    let cancelled = false
    loadString(STORAGE_KEYS.theme).then((saved) => {
      if (cancelled) return
      const resolved: Theme = saved === 'light' ? 'light' : 'dark'
      setTheme(resolved)
      colorScheme.set(resolved)
      setIsHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const toggleTheme = () => {
    setTheme((t) => {
      const next: Theme = t === 'light' ? 'dark' : 'light'
      colorScheme.set(next)
      void saveString(STORAGE_KEYS.theme, next)
      return next
    })
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme, isHydrated }}>{children}</ThemeContext.Provider>
}

/** Reads theme state — must be called under a `ThemeProvider`. */
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
