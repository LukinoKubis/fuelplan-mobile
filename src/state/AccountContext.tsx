/**
 * Auth session state — JWT token (Keychain/Keystore-backed via
 * secureStorage.ts) + email + remaining generation credits, polled from
 * the backend every 30s while logged in.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchUsage, login as apiLogin, signup as apiSignup, clearSession, saveSession } from '../lib/client'
import { loadString, saveString, remove, STORAGE_KEYS } from '../lib/storage'
import { loadToken } from '../lib/secureStorage'

interface AccountContextValue {
  /** JWT bearer token, or '' if not signed in. */
  token: string
  email: string
  /** Convenience for `!!token`. */
  isAuthed: boolean
  /** True once the persisted session has been read from SecureStore. */
  isHydrated: boolean
  /** Remaining AI-generation credits, or null before the first successful fetch. */
  remaining: number | null
  /** Re-fetches `remaining` from the backend. Also called on an interval while logged in. */
  refreshRemaining: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => void
  /** Persists a token+email pair and updates state. Used by login/signup internally. */
  setSessionFromToken: (token: string, email: string) => Promise<void>
}

const AccountContext = createContext<AccountContextValue | null>(null)

const POLL_INTERVAL_MS = 30_000

/** Provides auth/session state to the whole app — wrap it around everything in `src/app/_layout.tsx`. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Read the persisted session once on mount (AsyncStorage/SecureStore have
  // no sync API — see CLAUDE.md's "Async storage" section for why this
  // can't be a lazy useState initializer the way the web app's version was).
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

  /** Logs in against the backend and persists the resulting session. */
  const login = useCallback(
    async (emailInput: string, password: string) => {
      const res = await apiLogin(emailInput, password)
      await setSessionFromToken(res.token, res.email)
    },
    [setSessionFromToken]
  )

  /** Creates an account and persists the resulting session. */
  const signup = useCallback(
    async (emailInput: string, password: string) => {
      const res = await apiSignup(emailInput, password)
      await setSessionFromToken(res.token, res.email)
    },
    [setSessionFromToken]
  )

  /** Clears the session everywhere — SecureStore, AsyncStorage, and React state. */
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

  // Starts polling once both hydration is done and a token exists — gating
  // on isHydrated (not just mount) avoids firing a doomed request before
  // the persisted token has even been read back.
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

/** Reads auth/session state — must be called under an `AccountProvider`. */
export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used within AccountProvider')
  return ctx
}
