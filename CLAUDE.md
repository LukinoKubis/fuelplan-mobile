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

## expo-notifications has no web build at all
Unlike `expo-secure-store` (a no-op stub on web — see above),
`expo-notifications`'s `package.json` `main` field points at a file that
doesn't exist for the web platform at all — importing it anywhere
reachable from the web bundle **fails the entire Metro build** (a hard
500, not a graceful fallback). Fixed by splitting `src/lib/pushNotifications.ts`
into a real native implementation plus a `pushNotifications.web.ts`
sibling (trivial no-op stubs, never importing `expo-notifications` or
`expo-device`) — Metro's platform-extension resolution picks the `.web.ts`
file automatically for web builds, so every caller just imports from
`../lib/pushNotifications` unchanged. If a future native-only package
breaks `expo start --web`, suspect this same pattern (no web entry at all,
not just a stub) before assuming the import itself is wrong.

## M5 status: Android done and verified end-to-end; iOS blocked on Apple enrollment
`eas init` is done (`extra.eas.projectId` in `app.json`), the user created
a Firebase project and registered `fit.fuelplan.app`, and the FCM v1
service-account key is uploaded to EAS credentials (see "Push
notifications" below for how — the CLI's `eas credentials` flow is
interactive-only, so this was done via direct GraphQL calls).

**Verified for real, not just typechecked**: with no physical device
available, a local Android emulator was set up (Android SDK + AVD,
`google_apis_playstore` system image, boots as a real emulator window)
specifically to test this. Full chain confirmed working: Settings' Weekly
Summary toggle → real `getExpoPushTokenAsync()` token → registered with
the backend → stored in Redis → sent via Expo's push API → delivered
through Firebase FCM v1 → arrives on-device, both backgrounded and in the
foreground (see the `pushNotifications.ts`/`setNotificationHandler` note
below — foreground delivery needed a real fix, not just a config check).

**iOS is still blocked** on an APNs push key, which needs Apple Developer
Program enrollment (deferred by the user, cost/timeline reasons — same as
the EAS/store-submission blockers in M6).

## expo-notifications drops foreground pushes unless you configure a handler
By default, a push that arrives while the app is in the foreground is
**silently discarded** — no banner, no error, nothing — unless
`Notifications.setNotificationHandler(...)` is called somewhere that runs
on app start. `src/lib/pushNotifications.ts` sets one at module scope
(imported from `_layout.tsx` via the Settings toggle path, so it runs
early enough). **Real bug hit and fixed while verifying M5**: this was
missing entirely — a background test push worked, an otherwise-identical
foreground one vanished. If a future push type needs different
foreground behavior (e.g. suppress a banner for some notification
category), change the handler's return value, don't remove it.

## Testing push (or anything native-only) without a physical device
This dev environment has no phone and the user's phone is iOS (App
Store/EAS builds for iOS are blocked on Apple enrollment, so it can't run
a dev build anyway). For Android, a local emulator is a real substitute,
not just a UI-only stand-in — set up once via the command-line Android
SDK tools (`sdkmanager` for `platform-tools`/`emulator`/a
`system-images;android-35;google_apis_playstore;x86_64` image,
`avdmanager create avd`), then `emulator -avd <name>` boots a real window.
**Must use a `google_apis_playstore` (not plain `google_apis`) image** —
it has real Play Services, which is what makes FCM push actually work,
not just simulate. Confirmed empirically: `Device.isDevice` (from
`expo-device`) reports `false` on this emulator the same as it would on
an iOS simulator, but unlike an iOS simulator it **does** receive real
FCM pushes — see the `Device.isDevice` gate in `pushNotifications.ts`,
which now only excludes iOS for this reason. `adb` can install an EAS
build APK directly (`adb install -r foo.apk`), simulate an OS share via
`adb shell am start -a android.intent.action.SEND -t text/plain --es
android.intent.extra.TEXT '<url>'` (used to verify M4 without an actual
TikTok app), and read the real Redis-stored push token to send a real
test push directly through Expo's API — no need to reconstruct the
user's password to hit `requireAuth` endpoints for read-only verification
like this.

## M6 status: polish done, EAS/store submission blocked
Keyboard-avoidance audit done (`SurveyFlow.tsx`'s footer was
`position: absolute`, which doesn't cooperate with `KeyboardAvoidingView`'s
padding-based approach — restructured to normal flex flow; `plan-name.tsx`
wrapped too). Added `src/lib/errorMessage.ts` for a friendly
"you're offline" message on raw network failures (RN has no reliable
`navigator.onLine` and no PWA service-worker offline fallback to lean on)
— wired into login/signup, forgot/reset-password, and plan generation.
`eas.json` added with the standard development/preview/production
profiles.

**App icons — real branding, but not final submission-quality.** Copied
the web app's PWA icons in as the Android adaptive icon foreground
(`icon-maskable-512.png` — already has the safe-zone padding adaptive
icons need), splash icon, top-level icon, and web favicon, with
`app.json`'s background colors switched from the scaffold's placeholder
blue to the actual brand dark (`#0e0f11`). **Two things still need a real
design pass, not more agent work:**
- The source is only 512×512; the App Store wants a 1024×1024 master —
  upscaling would look soft. No image-generation/upscaling tool was
  available in this dev environment to do better than a straight copy.
- `assets/expo.icon` (iOS) is Apple's newer multi-layer "Icon Composer"
  bundle format (a directory: `icon.json` + `Assets/`), not a plain PNG —
  left untouched at the scaffold's placeholder rather than risk
  fabricating a malformed bundle without the real tooling (Xcode's Icon
  Composer) to author one correctly.
- `android-icon-monochrome.png` (Android 13+ themed icon) is also still
  the scaffold's generic placeholder.

**Blocked on the user, same shape as M5's blockers:**
- ~~`eas login` + `eas init`~~ — done (project linked, `extra.eas.projectId`
  in `app.json`; auth via `EXPO_TOKEN` env var, never written to a file).
- First EAS build: the first-ever Android development build was kicked
  off 2026-07-24 (`eas build --profile development --platform android`,
  cloud-generated keystore, versionCode initialized to 1). Store-bound
  builds are still gated on Apple Developer Program enrollment ($99/yr,
  ~24-48h identity verification) and Google Play Console ($25 one-time)
  — explicitly deferred by the user until the app is further along.
- Store listing assets — privacy policy (needs a hosted URL, e.g. a page
  on fuelplan.fit), screenshots (need a real build running on a device or
  simulator, neither available here), Data Safety/App Privacy
  questionnaire answers, a reviewer demo account (can create one the same
  way the earlier test accounts were created, once asked).

## File structure
- `src/app/` — Expo Router routes. `_layout.tsx` (root: providers +
  hydration gate + nav theme), `(auth)/` (login/signup/forgot-password/
  reset-password — the last via the `fuelplanmobile://reset-password?token=`
  deep link, `scheme` set in `app.json`), `(tabs)/` (Fuel/Prep/Haul, custom
  `Header` wired as the Tabs navigator's header, both header and tab bar
  hidden during the survey full-takeover same as the web app's
  `chromeHidden`; `recipes/` is a 4th tab with its own nested `<Stack>`
  (list + `[id]` detail) since the recipe box is plan-independent, unlike
  Fuel/Prep/Haul — it turns off the Tabs navigator's own header via
  `headerShown: false` on that one `Tabs.Screen` and renders the shared
  `Header` component itself instead, only on the list screen), `modal/`
  (Settings/History/PlanName/RecipeImport, Expo Router modal presentation
  routes, not drawers — see the migration plan's rationale)
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

## Recipe box (Recipe M1-M4 code done; M4 on-device verification pending)
Personal recipe library, separate from the AI-generated 7-day plan. No new
AI-calling endpoint — extraction (`recipePrompt.ts`'s
`buildExtractRecipeRequest`) and "Improve for Macros"
(`buildImproveForMacrosRequest`) both go through the existing
`POST /api/claude` proxy, same as plan generation, and so consume a
generation credit like any other Claude call. Backend persistence is
`claude-backend`'s `/api/recipes/{save,list,delete}` (see that repo's
CLAUDE.md) — no recipe-by-id GET endpoint exists; the detail screen
(`recipes/[id].tsx`) is handed the full recipe object as a route param by
the list screen and only falls back to fetching+filtering the whole list
if that param is missing (e.g. a future deep link).

`sanitizeCaption()` (`lib/sanitize.ts`) is `sanitizeInput`'s sibling for
this feature — same prompt-injection-phrase stripping, but skips the
strict food-word character allowlist (captions have emoji/punctuation/
hashtags) and caps at 3000 chars to match the backend's own
`sanitizeUserContent` truncation ceiling.

`modal/recipe-import.tsx` is the permanent landing screen for both manual
paste and (M4) native share-intent — it already accepts `url`/`text`
route params so M4 can hand off into it unchanged. Currently reachable
via Settings' "Add a Recipe" and the Recipes tab's "+ Add".

**`ADD_MEAL_TO_DAY` (PlanContext) must append, never insert.** `fuel/index.tsx`
keys each meal's `eaten` toggle state off its **array index** within
`day.meals` (`` `${day.day}-${i}` ``) — inserting a new meal anywhere but
the end would silently point every later meal's saved eaten-state at the
wrong meal. Verified with a Playwright pass: added a meal to a day that
already had one meal marked eaten, confirmed the macro bar recomputed
exactly right and the existing eaten-state didn't shift.

**Known v1 limitation, surfaced in the UI, not silently**: adding a recipe
to a plan does not update the Haul tab's `shopping_list` (a separate flat
AI-generated array, unrelated to `Recipe.ingredients`) — the "Added to
{day}" confirmation says so explicitly. Regenerating the shopping list
from recipe ingredients is future scope.

**Share-intent (M4)**: `expo-share-intent` (config plugin in `app.json`:
android `text/*` intent filter, iOS text/web-url activation rules).
`ShareIntentProvider` is the outermost provider in `_layout.tsx`;
`ShareIntentRedirect` (same file, inside `AppReadyGate` so navigation is
mounted even on cold-start-from-a-share) pushes to
`/modal/recipe-import?url=...&text=...`. Unlike `expo-notifications`,
this package is web-safe out of the box (`requireOptionalNativeModule` +
`useShareIntent` self-disables on web) — no `.web.ts` sibling needed,
verified the web bundle still builds. TikTok shares auto-prefill the
caption via TikTok's public oEmbed (`title` field carries the full
caption — verified live against a real video; the fetch is CORS-blocked
in the *browser* preview only, which doesn't apply to native fetch, and
fails soft to manual paste). Instagram shares get a "copy the caption
and paste it" prompt — no ToS-safe auto-fetch exists, scraping was
deliberately rejected. **Share targets don't work in Expo Go or web** —
testing the actual OS-level "share to Fuelplan" flow needs the EAS
dev-client build installed on a real Android device.

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
