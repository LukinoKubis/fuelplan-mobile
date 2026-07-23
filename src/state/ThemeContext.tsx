import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { colorScheme } from 'nativewind'
import { loadString, saveString, STORAGE_KEYS } from '../lib/storage'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  isHydrated: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [isHydrated, setIsHydrated] = useState(false)

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

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
