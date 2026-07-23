@AGENTS.md

# Fuelplan — Mobile (React Native / Expo)

> New repo, started 2026-07-23 as a migration off `fuelplan-frontend` (the
> Vite/React PWA, now frozen — no further frontend work goes there). Full
> migration plan/rationale/milestones: see the project root's
> `PLAN.md` entry for this migration (or ask — the plan file that drove
> this build is `synchronous-whistling-tower.md`). Zero real users existed
> at migration time, so this was a clean rewrite, not a data migration.
>
> **Before writing code, read `AGENTS.md`** — Expo SDK versions drift fast
> and the scaffold's own template already demonstrated at least one API
> (`NativeTabs`) that's newer than what this build uses; verify against
> current docs rather than assuming.

## What this is
Expo (managed) / React Native port of the Fuel meal-prep app, targeting
real iOS App Store + Google Play Store distribution — the reason for the
PWA-to-native migration was PWA limitations (no share-target support on
iOS, no store presence, second-class push).

## Stack
- Expo SDK 57, React Native 0.86, React 19.2, TypeScript (`strict: true`)
- Expo Router (file-based, `src/app/`) — NOT the `NativeTabs` experimental
  API the default template demos; using stable `<Tabs>` from `expo-router`
- NativeWind v4 (not v5 — v5 targets Tailwind v4 and is still pre-release/
  stabilizing; re-evaluate later, don't bump preemptively)
- `@react-native-async-storage/async-storage` for general persisted state,
  `expo-secure-store` for the JWT specifically (Keychain/Keystore-backed)
- Backend: same Railway-hosted `claude-backend` the web app uses — no
  backend changes for basic auth/plan endpoints; push notifications will
  need backend changes (see below)

## Design tokens
Ported from `fuelplan-frontend/src/styles/global.css` into
`tailwind.config.js`. NativeWind v4 has **no CSS-variable/semantic-token
system** (confirmed against docs) — there's no equivalent of the web app's
single-token-that-repaints-via-a-class-toggle trick. Every themed color is
defined **twice**: the base name (e.g. `bg`, `card`, `text`, `muted`) holds
the **dark** hex value, and a `light-` prefixed twin (`light-bg`,
`light-card`, etc.) holds the light hex value. **Convention: always pair
them** — `className="bg-light-bg dark:bg-bg"` — never use the bare dark
token alone, since without the `dark:` variant it won't respond to the
toggle at all. Apply this pattern to every new component.

## Theme switching
No DOM, so no `<html class="light">` trick. `ThemeContext` (`src/state/`)
calls NativeWind's `colorScheme.set('light' | 'dark')` (from the
`nativewind` package) on toggle, which is what makes `dark:` variants
resolve — plain `useColorScheme()` alone won't pick up a manual override,
it only reflects OS appearance.

## Async storage — the core porting gotcha
Every context in the web app read `localStorage` **synchronously** in a
lazy `useState` initializer. `AsyncStorage`/`SecureStore` have no sync API,
so every context here follows the same pattern instead:
1. State starts at hardcoded defaults (not a storage read).
2. A `useEffect` on mount reads storage async, then populates real state,
   then flips an `isHydrated` flag.
3. `src/app/_layout.tsx`'s `AppReadyGate` holds the native splash screen
   (`SplashScreen.preventAutoHideAsync()`/`.hideAsync()`) until all three
   contexts + fonts report ready, then renders the real route tree.
4. `PlanContext`'s reducer is kept **pure** — no storage calls inside it
   (can't await in a reducer). Persistence happens via separate
   `useEffect`s per state slice, each gated on `isHydrated` so the
   just-hydrated data doesn't immediately get re-written.

**Real bug hit and fixed during M1**: `AccountContext.setSessionFromToken`
originally fired `setToken()` (React state) without awaiting the
`saveToken()` (SecureStore) write first. The poll-starting `useEffect`
fires the instant `token` state changes and immediately calls
`getToken()` → reads storage — if that read raced ahead of the write, the
first `/api/usage` call went out unauthenticated and 401'd. Fixed by
awaiting the write before flipping state. Apply the same
write-before-state-update discipline to any future persisted value that
something else reacts to immediately.

## expo-secure-store has no web implementation
`expo-secure-store`'s web target is a literal no-op stub (confirmed by
reading `node_modules/expo-secure-store/src/ExpoSecureStore.web.ts` — it's
`export default {}`). This app is native-only in production (no web
distribution planned), but **this dev environment has no physical device
or simulator**, so `expo start --web` + a headless browser is the only
verification channel available so far. `src/lib/secureStorage.ts` falls
back to `AsyncStorage` on `Platform.OS === 'web'` specifically so the auth
flow is testable at all here — production/native always uses real
SecureStore. **This means token persistence has only been verified via the
web fallback, not against real Keychain/Keystore** — worth a real-device
smoke test before trusting it fully.

## File structure
- `src/app/` — Expo Router routes. `_layout.tsx` (root: providers +
  hydration gate), `(auth)/` (login/signup, redirects to `(tabs)` if
  already authed), `(tabs)/` (Fuel/Prep/Haul, redirects to `(auth)/login`
  if not authed — built out beyond placeholders in later milestones)
- `src/state/` — `ThemeContext`, `AccountContext`, `PlanContext` (ported
  from the web app's `src/state/`, same names/shapes, async-hydration
  rewrite per above)
- `src/lib/` — `client.ts` (ported near-verbatim from the web app's
  `api/client.ts`), `storage.ts` (async `AsyncStorage` wrapper, same
  `STORAGE_KEYS`/function names as the web app's `api/storage.ts` but
  Promise-returning), `secureStorage.ts` (JWT-specific, see above)
- `src/types/` — ported from the web app's `src/types/` as needed per
  milestone (currently `plan.ts`, `profile.ts`)
- `src/components/` — shared UI (currently just `Field.tsx`)

## Milestones
See the approved migration plan for the full M1–M6 breakdown (scaffold →
Fuel → Prep/Haul → settings/modals → push notifications → EAS/store
submission). Push notifications are **in v1 scope** (explicit decision,
overriding the initially-researched recommendation to defer them) — will
require a new Firebase project and swapping the backend's `web-push`/VAPID
implementation for `expo-server-sdk-node`.

## Local dev
```
npm install
npx expo start --web    # fastest smoke-test loop in this dev environment
npx expo start           # real dev-client/Expo Go flow, needs a device/emulator
```
No local backend — always hits the live Railway `claude-backend`
(`API_BASE` in `src/lib/client.ts`).
