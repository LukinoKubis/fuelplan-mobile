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

## Fonts — the family name must match the exact loaded weight
`useFonts()` (`expo-font`) registers each loaded weight as its **own
distinct font-family name** — e.g. `Syne_800ExtraBold`, `Figtree_400Regular`
— not a single `"Syne"`/`"Figtree"` family with weight variants the way a
web `@font-face` block normally works. **Real bug hit and fixed during
M4**: `tailwind.config.js`'s `fontFamily.display`/`fontFamily.body` were
set to `['Syne']`/`['Figtree']` (the bare names, matching how the web app's
CSS referenced them) — since no font is actually registered under those
bare names, every single `<Text>` silently fell back to the system font
with no error, anywhere in the app. Caught by the user actually looking at
`localhost:8098` — a Playwright screenshot alone hadn't made the
discrepancy obvious enough to catch on first pass; verify font fixes with
`getComputedStyle(el).fontFamily` in the browser, not just a visual
screenshot. Fixed by pointing `fontFamily.display`/`.body` at the exact
loaded names (`Syne_800ExtraBold`, `Figtree_400Regular` — the weights
matching the web app's h1-h4-are-800 / body-is-400 rule). Tailwind's
`font-bold`/`font-extrabold` weight utilities still layer on top fine
(browsers/native both synthesize bold reasonably against a single loaded
weight) — the fix was only the family *name*, not the weight-utility usage
elsewhere in components.

## React Navigation's own theme is separate from NativeWind's
NativeWind's `colorScheme` only affects `dark:`/`light-` styled NativeWind
components — it does **not** reach React Navigation's native chrome (Stack
headers, default tab bar styling), which has its own theme system
(`DarkTheme`/`DefaultTheme`/`ThemeProvider`, all re-exported from
`expo-router` — no need for a direct `@react-navigation/native` dependency).
**Real bug hit and fixed during M4**: the modal Stack's header (`Settings`
title bar) rendered with a hardcoded white background regardless of the
app's dark/light toggle, because the root layout never wired up a
navigation theme at all (the scaffold's original `_layout.tsx` did this by
default, wired to `useColorScheme()`; that got dropped when M1 rewrote the
file). Fixed in `src/app/_layout.tsx`'s `AppReadyGate`: wraps the tree in
`<NavigationThemeProvider value={theme === 'dark' ? NAV_DARK_THEME :
NAV_LIGHT_THEME}>` (custom theme objects with `colors` matching the same
hex tokens as `tailwind.config.js`), driven by **our** `ThemeContext`
value, not raw `useColorScheme()` — so it follows the manual toggle, not
just OS appearance. Anywhere a native-chrome element doesn't respect the
theme, suspect this same gap (NativeWind ≠ React Navigation theming) before
anything else. `(tabs)/_layout.tsx`'s `tabBarStyle`/tint colors also need
to read from `useThemeColors()` (see below) rather than hardcoded hex, for
the same reason.

## Getting a color value in JS (not just a static className)
For anything that needs a color as a JS value — inline `style={{}}`,
computed/conditional colors (e.g. `Chips.tsx`'s active-vs-inactive state,
`GoalPicker`'s per-preset accent color), SVG `stroke`/`fill` props, or
native-chrome config like `tabBarStyle`/`NAV_DARK_THEME` above — NativeWind
class names don't help since there's no way to read a resolved Tailwind
color back out into JS. Use `useThemeColors()` (`src/lib/themeColors.ts`)
instead — a small hook mirroring the same hex values as
`tailwind.config.js`, keyed by the live `ThemeContext` value. Keep the two
in sync by hand if tokens change; there's no single source of truth shared
between them (Tailwind config isn't importable at runtime in a form JS
values can read).

## Font wrapper — always import Text from components/Text, not react-native
RN has no font inheritance (no web-style `body { font-family }` cascade) —
every `<Text>` defaults to the platform system font unless given one
explicitly. `src/components/Text.tsx` wraps RN's `Text` with `font-body`
(Figtree) baked in as the default className, so plain body text doesn't
need to remember it on every usage. **Import `Text` from
`@/components/Text` everywhere, never from `'react-native'` directly** —
grep for `from 'react-native'` importing `Text` if a new component seems to
have unstyled text; pass `font-display` explicitly for headings (Syne),
same as the web app's h1-h4 rule.

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
  hydration gate + nav theme), `(auth)/` (login/signup/forgot-password/
  reset-password — the last via the `fuelplanmobile://reset-password?token=`
  deep link, `scheme` set in `app.json`), `(tabs)/` (Fuel/Prep/Haul, custom
  `Header` wired as the Tabs navigator's header, both header and tab bar
  hidden during the survey full-takeover same as the web app's
  `chromeHidden`), `modal/` (Settings/History/PlanName, Expo Router modal
  presentation routes, not drawers — see the migration plan's rationale)
- `src/state/` — `ThemeContext`, `AccountContext`, `PlanContext` (ported
  from the web app's `src/state/`, same names/shapes, async-hydration
  rewrite per above)
- `src/lib/` — `client.ts`, `generatePrompt.ts`, `macros.ts`, `sanitize.ts`
  (all ported near-verbatim from the web app's `src/api/`), `storage.ts`
  (async `AsyncStorage` wrapper, same `STORAGE_KEYS`/function names as the
  web app's `api/storage.ts` but Promise-returning), `secureStorage.ts`
  (JWT-specific, see above), `themeColors.ts` (JS-value color lookup, see
  above)
- `src/types/` — ported from the web app's `src/types/` (`plan.ts`,
  `profile.ts`, `goal.ts` — the last with `var(--x)` CSS custom properties
  swapped for actual hex, since RN style values can't resolve CSS vars)
- `src/components/` — `Text.tsx` (font-defaulting wrapper, see above),
  `Field.tsx`, `layout/Header.tsx`, `fuel/` (DayTabs — gesture-handler swipe
  reimplementation, DayMacroBar, MealCard, ShoppingList),
  `survey/` (4-step wizard + Chips/GoalPicker/PaceSlider, ported from the
  web app's `components/survey/`), `shared/` (LoadingOverlay, ErrorPanel,
  ErrorBoundary, SettingsAction)
- `Onboarding` (web app's PWA-install-guide screen) was **not ported** —
  100% PWA-install-prompt content, not applicable natively.

## Milestones
Tracked as GitHub issues on this repo (`gh issue list`), not just the
internal plan file — M1-M4 closed, M5/M6 open. See the approved migration
plan for the full M1–M6 breakdown (scaffold → Fuel → Prep/Haul →
settings/modals → push notifications → EAS/store submission). Push
notifications are **in v1 scope** (explicit decision, overriding the
initially-researched recommendation to defer them) — will require a new
Firebase project and swapping the backend's `web-push`/VAPID implementation
for `expo-server-sdk-node`.

## Local dev
```
npm install
npx expo start --web    # fastest smoke-test loop in this dev environment
npx expo start           # real dev-client/Expo Go flow, needs a device/emulator
```
No local backend — always hits the live Railway `claude-backend`
(`API_BASE` in `src/lib/client.ts`).
