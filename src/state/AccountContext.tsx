import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchUsage, login as apiLogin, signup as apiSignup, clearSession, saveSession } from '../lib/client'
import { loadString, saveString, remove, STORAGE_KEYS } from '../lib/storage'
import { loadToken } from '../lib/secureStorage'

interface AccountContextValue {
  token: string
  email: string
  isAuthed: boolean
  isHydrated: boolean
  remaining: number | null
  refreshRemaining: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => void
  setSessionFromToken: (token: string, email: string) => Promise<void>
}

const AccountContext = createContext<AccountContextValue | null>(null)

const POLL_INTERVAL_MS = 30_000

export function AccountProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadToken(), loadString(STORAGE_KEYS.userEmail)]).then(([savedToken, savedEmail]) => {
      if (cancelled) return
      setToken(savedToken || '')
      setEmail(savedEmail || '')
      setIsHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Awaits the token write before flipping React state — the poll-starting
  // effect below fires the moment `token` changes and immediately reads the
  // token back out of SecureStore via client.ts's getToken(); if that read
  // raced ahead of this write, the first /api/usage call would go out
  // unauthenticated and 401.
  const setSessionFromToken = useCallback(async (nextToken: string, nextEmail: string) => {
    await saveSession(nextToken)
    void saveString(STORAGE_KEYS.userEmail, nextEmail)
    setToken(nextToken)
    setEmail(nextEmail)
  }, [])

  const login = useCallback(
    async (emailInput: string, password: string) => {
      const res = await apiLogin(emailInput, password)
      await setSessionFromToken(res.token, res.email)
    },
    [setSessionFromToken]
  )

  const signup = useCallback(
    async (emailInput: string, password: string) => {
      const res = await apiSignup(emailInput, password)
      await setSessionFromToken(res.token, res.email)
    },
    [setSessionFromToken]
  )

  const logout = useCallback(() => {
    void clearSession()
    void remove(STORAGE_KEYS.userEmail)
    setToken('')
    setEmail('')
    setRemaining(null)
  }, [])

  const refreshRemaining = useCallback(async () => {
    if (!token) return
    try {
      const { remaining: r } = await fetchUsage()
      setRemaining(r)
    } catch {
      /* non-critical */
    }
  }, [token])

  useEffect(() => {
    if (!isHydrated || !token) return
    refreshRemaining()
    pollRef.current = setInterval(refreshRemaining, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isHydrated, token, refreshRemaining])

  return (
    <AccountContext.Provider
      value={{ token, email, isAuthed: !!token, isHydrated, remaining, refreshRemaining, login, signup, logout, setSessionFromToken }}
    >
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used within AccountProvider')
  return ctx
}
