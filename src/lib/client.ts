// Ported near-verbatim from fuelplan-frontend/src/api/client.ts — plain
// fetch() wrappers, framework-agnostic. Only change: the token is read from
// secureStorage (Keychain/Keystore) instead of localStorage, and every
// caller now awaits authHeaders() since that read is async.
import type { HistoryEntryMeta, Macros, Plan } from '../types/plan'
import { loadToken, saveToken, removeToken } from './secureStorage'

/** Railway-hosted backend shared with the (now-frozen) web app — no local backend proxy. */
export const API_BASE = 'https://fuelplan-backend-production.up.railway.app'

/** Thrown for any non-2xx backend response, with a user-presentable `message` and the HTTP `status`. */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Maps a failed response to a friendly ApiError per status code, then throws it. */
async function parseErrorResponse(response: Response): Promise<never> {
  const err = await response.json().catch(() => ({}) as { error?: string; message?: string })
  const status = response.status
  if (status === 402) throw new ApiError(status, err.message || 'You have no plans left — top up in Settings.')
  if (status === 401) throw new ApiError(status, err.error || 'Please log in again.')
  if (status === 503) throw new ApiError(status, err.error || 'The AI service is temporarily overloaded. Please wait a moment and try again.')
  if (status === 504) throw new ApiError(status, 'Request timed out. Please try again — it usually works on the second attempt.')
  if (status === 502) throw new ApiError(status, 'Server error — please try again.')
  throw new ApiError(status, err.error || `API error ${status}`)
}

/** Reads the JWT from SecureStore — '' if not signed in. */
export async function getToken(): Promise<string> {
  return (await loadToken()) || ''
}

/** Builds the `Authorization: Bearer` header for an authenticated request, or `{}` if signed out. */
async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

/** A system prompt block — can carry a `cache_control` breakpoint (see generatePrompt.ts). */
export interface SystemBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' }
}

export interface GenerateRequest {
  model: string
  max_tokens: number
  system: string | SystemBlock[]
  messages: ClaudeMessage[]
}

export interface ClaudeResponse {
  content: { text?: string }[]
}

/** Generic Anthropic proxy — the backend forwards this payload straight to Claude and deducts a credit. */
export async function postClaude(body: GenerateRequest, signal?: AbortSignal): Promise<ClaudeResponse> {
  const response = await fetch(`${API_BASE}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    signal,
    body: JSON.stringify(body),
  })
  if (!response.ok) return parseErrorResponse(response)
  return response.json()
}

/** Fetches the signed-in user's remaining AI-generation credits. */
export async function fetchUsage(): Promise<{ remaining: number }> {
  const response = await fetch(`${API_BASE}/api/usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({}),
  })
  if (!response.ok) return parseErrorResponse(response)
  return response.json()
}

/** Names and saves the current plan to the user's history (max 5 entries server-side). */
export async function saveHistory(params: { plan: Plan; userName: string; planName: string; macros: Macros }): Promise<{ ok: boolean; id: number }> {
  const response = await fetch(`${API_BASE}/api/history/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(params),
  })
  if (!response.ok) return parseErrorResponse(response)
  return response.json()
}

/** Lists saved-plan metadata (id/savedAt/planName/macros) for the History screen. */
export async function getHistoryList(): Promise<{ history: HistoryEntryMeta[] }> {
  const response = await fetch(`${API_BASE}/api/history/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({}),
  })
  if (!response.ok) return parseErrorResponse(response)
  return response.json()
}

/** Fetches the full plan JSON for a saved history entry, to reactivate it. */
export async function restoreHistory(planId: number): Promise<{ plan: Plan; userName: string; planName: string; savedAt: string }> {
  const response = await fetch(`${API_BASE}/api/history/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ planId }),
  })
  if (!response.ok) return parseErrorResponse(response)
  return response.json()
}

/** Removes a saved plan from history. */
export async function deleteHistory(planId: number): Promise<{ ok: boolean; remaining: number }> {
  const response = await fetch(`${API_BASE}/api/history/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ planId }),
  })
  if (!response.ok) return parseErrorResponse(response)
  return response.json()
}

/** Starts a LemonSqueezy checkout for a credit top-up plan; returns the URL to open. */
export async function createCheckout(plan: '5' | '10' | '20'): Promise<{ url: string }> {
  const response = await fetch(`${API_BASE}/api/create-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ plan }),
  })
  if (!response.ok) return parseErrorResponse(response)
  return response.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────
export interface AuthResponse {
  token: string
  email: string
}

/** Creates a new account. */
export async function signup(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) return parseErrorResponse(response)
  return response.json()
}

/** Signs in to an existing account. */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) return parseErrorResponse(response)
  return response.json()
}

/** Requests a password-reset email. Always resolves `{ ok: true }` server-side — no email enumeration. */
export async function forgotPassword(email: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!response.ok) return parseErrorResponse(response)
  return response.json()
}

/** Completes a password reset using the token from the emailed deep link. */
export async function resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }> {
  const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  })
  if (!response.ok) return parseErrorResponse(response)
  return response.json()
}

/** Persists a JWT to SecureStore. */
export async function saveSession(token: string): Promise<void> {
  await saveToken(token)
}

/** Removes the persisted JWT from SecureStore. */
export async function clearSession(): Promise<void> {
  await removeToken()
}

/**
 * Fires a health-check request on app launch to wake a cold-started
 * Railway instance early, retrying every 5s until it succeeds — so the
 * backend is more likely already warm by the time the user actually
 * triggers a real request.
 */
export function warmUpBackend(): void {
  const attempt = () => {
    fetch(`${API_BASE}/`)
      .then((r) => {
        if (!r.ok) setTimeout(attempt, 5000)
      })
      .catch(() => setTimeout(attempt, 5000))
  }
  attempt()
}
