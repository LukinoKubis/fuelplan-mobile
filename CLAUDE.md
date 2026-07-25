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

## Temporary web deploy at app.fuelplan.fit
Deployed 2026-07-24 as a stopgap so the app is usable before Google Play
($25)/Apple Developer ($99/yr) enrollment happens — **explicitly
temporary**, retire once real store builds exist (issue #18). Separate
Netlify site (`fuelplan-app-preview`, project id
`d15724d8-93ab-44d9-aae9-10034f14e8ad`) from the frozen web app's site —
`fuelplan.fit` and `/hockeyprep` are a different codebase (`fuelplan-frontend`)
and a different Netlify site, untouched by this.

- **DNS**: `fuelplan.fit`'s zone is Netlify-managed (Netlify's own
  nameservers, not the registrar's) — setting `custom_domain` via
  `netlify api updateSite` on the new site auto-created the
  `app.fuelplan.fit` DNS record in that same zone. No registrar changes
  needed for future subdomains either, same trick applies.
- **Build**: `npx expo export --platform web` (Expo Router's static
  export — same command used for the whole session's dev-preview loop).
  `netlify.toml`'s SPA-fallback redirect only applies after Netlify's own
  static-file resolution fails (no `force = true`), so routes Expo
  pre-rendered as real per-route HTML keep serving those directly —
  the fallback exists only for genuinely dynamic paths (e.g.
  `/recipes/<a real id>`) that no static file matches.
- **Deploy is manual, not git-triggered**: `netlify deploy --prod --dir=dist`
  after the export. Linking this site to auto-deploy on push would need
  Netlify's dashboard OAuth flow to connect the GitHub repo, which isn't
  scriptable headlessly — redeploy by hand after any change meant to
  reach this URL.
- **Real limitations of a web build, not bugs**: `expo-share-intent`
  self-disables on web (no OS share sheet exists in a browser) and push
  notifications don't work here either (would need reviving the web-push
  infra that was deliberately removed when this project went native) —
  both work fine in the real Android build. Auth, plan generation,
  Fuel/Prep/Haul, and the Recipes tab (including manual paste/URL import)
  all work the same as native.

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

## Recipe box (Recipe M1-M4 all done, verified on-device including the share sheet)
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
verified the web bundle still builds. **Share targets don't work in Expo
Go or web** — testing the actual OS-level "share to Fuelplan" flow needs
the EAS dev-client build installed on a real Android device.

`recipe-import.tsx`'s Link field is real editable state (`sourceUrl`),
not a one-time read of the share-intent route param — pasting a link by
hand drives the exact same TikTok/Instagram logic as a real share. This
is also the only way to exercise that flow in Expo Go, which can't do
native share-intent.

**Caption/text auto-fill, both platforms, both real scrapes** (see
`claude-backend/CLAUDE.md` for how and the Railway-deploy gotchas —
Chromium needs real system libraries not present by default):
- **TikTok**: caption via TikTok's public oEmbed (`title` field carries
  it — the fetch is CORS-blocked in the *browser* preview only, doesn't
  apply to native, fails soft to manual paste). `extractVideoText()`
  (`client.ts`) additionally reads spoken-audio transcript + on-screen
  text overlays the caption alone doesn't cover, in parallel with the
  oEmbed fetch. Genuinely slower (10-20s) and can fail — always
  best-effort, never blocks pasting/editing manually.
  **The transcript/on-screen text are never shown in the visible text
  field** (`recipe-import.tsx`'s `videoContext` state, separate from
  `rawText`) — only fed silently into the AI extraction call. A video's
  spoken audio is often just background music lyrics or unrelated
  chatter, and showing that raw next to the actual caption looked broken.
  If both the caption and the video read come back genuinely empty (some
  videos are pure B-roll with no readable text anywhere), an inline
  orange banner tells the user rather than leaving a silently empty
  field. **Real bug hit and fixed**: this was originally `Alert.alert`,
  which is a total no-op on web (`react-native-web`'s implementation is
  literally `static alert() {}`) — silently did nothing on the real web
  deploy at app.fuelplan.fit. Swapped to the same inline-message pattern
  the screen already uses for its `error` state. If a future feature
  needs a blocking-style native notice, don't reach for `Alert.alert`
  without checking it actually renders on web first.
- **Instagram**: `extractInstagramCaption()` reads the post page's
  `og:description` meta tag (confirmed live — Instagram's oEmbed/API
  don't expose captions without Meta App Review, but this does). Faster
  than TikTok's read (~2-5s, no video/audio involved) but only works for
  genuinely public posts — private/age-restricted/some-under-load posts
  fail, falling back cleanly to the original "paste the caption
  yourself" prompt.

**Recipe cover photo**: `RecipePhotoPicker` (`components/shared/`) wraps
`expo-image-picker` + `expo-image-manipulator` (resize to 640px wide,
JPEG quality 0.6 via `lib/recipePhoto.ts`) into a reusable preview+pick
widget, used on both the import review screen and the detail screen (for
recipes without one yet — saves immediately via the existing
upsert-by-id call). Stored as a base64 data URI directly on `Recipe.photo`
— purely cosmetic, unrelated to extraction.

**Tags/labels**: `Recipe.tags?: string[]` — free-form, user-created, added/
removed as pill chips on the detail screen (`recipes/[id].tsx`), each
change saved immediately via the same upsert-by-id `saveRecipe()` call
everything else there uses (dedup is case-insensitive client-side). No
separate folder concept — the personal recipes list (`recipes/index.tsx`)
derives its filter pills from the union of every loaded recipe's tags and
filters client-side, since the full list is already in memory. Backend
`RecipeRecord.tags` (`claude-backend/src/server.ts`) is a plain passthrough
field on `/api/recipes/save`, same shape.

## Shared recipe library (Library M1-M5 all done — plan generation is now fully library-driven, no AI invents meals anymore)
A separate, admin-seeded catalog every user reads the same copy of —
distinct from the personal recipe box above. `recipes/library.tsx`
(browse/search/category filter) and `recipes/library-detail.tsx`
(read-only, "Add to My Recipes" copies it into the personal box via
`addLibraryRecipeToMine`, "Add to Plan" works the same as the personal
detail screen). Reached via "Browse Recipe Library →" on the personal
recipes list. Backend: `claude-backend`'s `/api/library/{list,
add-to-my-recipes,favorite}` and the admin-only `/api/admin/seed-library`
(see that repo's CLAUDE.md for the seeding pipeline).

**Favorites** are a bookmark into the shared library
(`fuelplan:favorites:USERID` in Redis, holding just a list of library
recipe ids) — a third, deliberately separate concept from both the
personal recipe box and `PlanContext`'s meal-name favorites (which bias
AI plan generation). `toggleLibraryFavorite()` (`client.ts`) plus a heart
icon on both the library list cards and the detail screen header, with
optimistic local-state toggling that reverts on API failure.

**Real bug hit and fixed verifying this**: `library.tsx` originally
fetched with a plain `useEffect` keyed on the filter/search state, so
toggling a favorite on the detail screen and pressing back left the list
screen's local `recipes` state stale (Expo Router's Stack keeps the
previous screen mounted, so nothing forced a refetch) — a Playwright pass
caught it directly: unfavorite from the detail screen, go back with
"Favorites only" still on, and the just-unfavorited card was still
showing. Fixed the same way `recipes/index.tsx` already handled this for
the personal list — swapped the plain `useEffect` for `useFocusEffect`
(re-exported from `expo-router`) so the library also refetches every time
the screen regains focus, not just when its own filters change.

**M4-then-superseded**: M4 was originally built as a lighter-weight
"grounding" pass — feeding a compact list of library recipe names into
the existing full-AI-generation prompt as a hint. That shipped, then was
immediately superseded by M5 (below), which replaces AI generation
entirely rather than just nudging it. Worth knowing if `git log` turns up
`libraryGrounding.ts`/the old `generatePrompt.ts` — both were deleted in
the M5 commit, not deprecated in place.

## Plan generation (Library M5) — algorithmic, not AI
`SurveyFlow.tsx`'s "Generate My Plan" no longer asks an LLM to invent 28
meals from scratch. Instead:
1. **Pick + scale, zero AI** (`planAssembly.ts`'s `assemblePlanFromLibrary`)
   — for each of the 7 days x 4 slots (breakfast/lunch/snack/dinner), score
   every candidate in that category's full library pool against the slot's
   proportional macro sub-target (protein weighted heaviest — it's the
   macro real recipes vary most in density), scale the winner's macros and
   ingredient quantities to fit (bounded 0.5x-2.2x), then run a bounded
   local-search repair pass (`repairDay`) that swaps toward a better
   day-level macro fit before a final kcal-precision correction. Dietary
   restrictions/dislikes are filtered by keyword match against
   name+ingredients; cuisine preference and the variety setting (repeat/
   some/diverse) bias selection via the same scoring function.
2. **One small AI call** (`prepAndShoppingPrompt.ts`) turns the already-
   decided week into Sunday batch-cook steps + a merged shopping list —
   the two pieces that still benefit from an LLM (grouping shared prep,
   summing repeated ingredients like "3 eggs" + "2 eggs"). Far cheaper and
   more reliable than the old single 16k-token generation, since its input
   is already fully structured. Still costs one generation credit (decrement
   lives in `/api/claude`, still called here).

Verified end-to-end across several live generations: kcal and protein
consistently land exactly or within a few grams of target using only the
~100-recipe library that exists today; carbs/fat are secondary and land
within a looser range (matches typical macro-tracking priority).

**Real bugs hit and fixed at launch:**
- **Ingredient over-scaling**: `formatIngredients()` scaled a recipe's
  *whole-batch* ingredient quantities (e.g. `"6 large"` eggs on a
  4-serving recipe) by the macro-fit factor without first dividing by the
  recipe's own `servings` — produced absurd amounts like "11 large eggs"
  for a single meal. Fixed by combining the fit factor with a `1/servings`
  divisor into one `perServingFactor` before scaling.
- **Repeated AI schema drift**, worse than the earlier M4 grounding
  incident: across three live generations, Claude returned a
  `batch_cook_plan` object with its own invented `sessions` structure
  instead of the flat `prep_tasks` array (the system prompt had said
  "Sunday batch-cook plan" prominently, which it apparently took as a
  literal field-name suggestion — removed that phrasing entirely), then
  kept grouping `prep_tasks` under session wrappers even after that fix,
  then dropped `shopping_list`'s category grouping down to a flat list.
  Fixed with much blunter prompt language that explicitly names the wrong
  shapes seen in practice ("do NOT nest tasks inside a session wrapper —
  that is wrong even if it feels more organized") — **plus** defensive
  normalization as a backstop regardless of prompt compliance:
  `normalizePrepTasks()` flattens a session-wrapped response back into
  real tasks, and `normalizeShoppingList()` (extended, see the M4 entry
  above) now also catches a flat item list with no category grouping,
  bucketing it under one "Groceries" fallback category rather than losing
  it. Both wired into `PlanContext`'s `SET_PLAN`, same as the earlier
  shopping-list fix. Lesson reinforced: don't trust a single hardened
  prompt attempt to be the whole fix for a real-world LLM JSON task —
  pair it with defensive parsing on the client.
- **Every generation failing with "Got invalid JSON back"**, discovered
  after the two fixes above (not caused by them): `claude-backend`'s
  `/api/claude` runs every message through a shared sanitizer
  (`sanitizeUserContent`) that silently truncates content over a length
  cap — sized for the old callers' single free-text fields, not this
  request's full 28-meal ingredient list (~11-12k chars). The request was
  being cut mid-list before it ever reached Anthropic; Claude correctly
  noticed and replied asking for the rest instead of returning JSON.
  Diagnosed by generating the exact request body standalone (via `tsx`,
  outside the app) and confirming it was complete and correct — the bug
  was server-side, not in `prepAndShoppingPrompt.ts`. Fixed in
  `claude-backend` (see that repo's CLAUDE.md for the full writeup) by
  raising the cap. If a future feature adds output that looks
  correct-when-inspected-locally but the AI's response claims the input
  was incomplete, suspect this same shared-sanitizer truncation before
  the prompt itself.

**Meal rotation is capped, not free variety**: `VARIETY_OPTIONS` (survey
step 3) is "Same every day" / "Switch between 2" / "Switch between 3", not
the old "repeat/some/fully diverse" labels — meal prep is repetitive by
design, most people rotate between at most 2-3 meals per slot. Enforced
structurally, not just discouraged: `planAssembly.ts`'s
`selectRotationPool()` picks the best-fitting N recipes for a slot once,
for the whole week, before any day gets assigned — every day's pick and
every repair-pass swap only ever chooses from within that capped set.

**Library recipes are categorized by difficulty** (beginner/intermediate/
advanced) — filterable in the library browse screen, shown as a badge on
both the list and detail screens (`DifficultyBadge`, traffic-light colors,
kept as its own badge rather than a macro-chip color so it doesn't read as
another macro value). `planAssembly.ts`'s `selectRotationPool()` also
biases selection toward the user's `cookingSkill` (already collected in
the survey) — a matching recipe gets a bonus, one two tiers off (e.g. a
beginner cook, an advanced recipe) gets a penalty.

**Known gap, not yet addressed**: `PlanContext`'s meal-name favorites
(the "favorite this meal" heart from the old AI-generation flow, meant to
bias future generations toward liking those meals again) has no effect on
the new algorithmic selection — `planAssembly.ts`'s scoring has no
favorites input. Not wired up yet; worth a follow-up if it turns out to
matter to users now that it's silently inert rather than removed. Tracked
as issue #26.

**Real bug hit and fixed post-launch: protein scoring was symmetric,
causing systematic undershoot.** `dayError()`'s macro-fit scoring penalized
protein overshoot and undershoot equally (`Math.abs(diff) * 3`), but real
recipes are far more constrained on the "too little" side — plenty of
recipes clear a high protein floor by a lot, almost none fall exactly on
it, so a symmetric penalty made the optimizer settle for meals well under
target rather than risk scoring a small overshoot. Diagnosed with a
standalone script comparing actual output against the *theoretical max*
protein achievable from the same library (168g actual vs 220g target,
258g theoretical max — confirming the bug was in scoring, not just content
scarcity). Fixed with an asymmetric `proteinError()`: overshoot penalized
at 2.5x, undershoot at 4x (note: heavier on undershoot, the direction
that's actually bad) — landed after two rounds of live retuning (0.4x/1.2x
were both undertuned once the library gained more high-protein recipes
from the seeding work below). kcal/carbs/fat stay symmetric — unlike
protein, they have a real "too much" side. Verified end-to-end via the
real survey→generation→Fuel-tab flow: 168g → 239g protein at a 220g
target, zero undershoot across several live macro-target scenarios.

**Targeted library seeding + "Gym Bro" cuisine**: `/api/admin/seed-library`
(`claude-backend`) now accepts optional `style`/`cuisine`/
`minProteinDensity` body params, each injecting an extra system-prompt
rule line into `SEED_JSON_TEMPLATE` — lets a seeding run target a specific
gap (e.g. "more high-protein basics") instead of only ever asking for
generic variety. Used to seed ~70 new recipes: plain high-protein staples
(chicken + rice, etc. — the "food people actually eat every day" gap) and
a dedicated "Gym Bro" cuisine (`{ value: 'Gym Bro', label: 'Gym Bro 💪' }`
in `survey/options.ts`'s `CUISINE_OPTIONS` — the label string must match
the seeded library `cuisine` field exactly for `planAssembly.ts`'s
`cuisineBonus()` to match it). This was the other half of the protein fix
above, not a separate unrelated feature — raising the library's available
protein-density ceiling is what made the second scoring retune necessary.

**Meal replace** (`PlanContext`'s `REPLACE_MEAL` action): browse-and-pick,
not auto-reroll — matches the user's explicit choice over an "auto swap"
alternative. `MealCard` grew a swap-icon `Pressable` that navigates to
`recipes/library` with `replaceDay`/`replaceMealIndex`/`replaceMealName`
params, threaded through to `library-detail.tsx`, which shows a blue
"Replace This Meal" section instead of the normal orange "Add to Plan"
one when those params are present. `replaceMeal()` replaces **in place at
the same array index** (not append) — deliberately mirrors the
`ADD_MEAL_TO_DAY`-must-append rule above, since `fuel/index.tsx` also keys
`eaten` state off meal array index; replacing in place preserves it,
inserting/removing would desync every later meal's eaten flag. Preserves
the original meal's `time` slot rather than resetting it.

**Settings screen reorganized + real gaps closed.** Was previously missing
two things a shipping app needs: **self-serve account deletion**
(`POST /api/account/delete`, `requireAuth` — Apple has required this for
any app with account creation since 2022, not just a nice-to-have; deletes
every per-user Redis key, not just the user record — remaining credits,
history, archive, tracking, push tokens, admin notes, recipes, favorites —
but deliberately keeps order/payment records, matching the privacy
policy's stated retention practice) and a **feedback/suggestions channel**
(`POST /api/feedback/submit`, rate-limited 5/hour, stores to
`fuelplan:feedback:all` capped at `MAX_FEEDBACK = 500`, best-effort emails
`FEEDBACK_NOTIFY_EMAIL` via Resend — `modal/feedback.tsx` on the mobile
side, reachable from a new "Feedback" section in Settings). Also: the
**privacy policy was built in an earlier session but never linked
anywhere in-app**, only reachable via direct URL — added under a new
"Legal" section, opens via `expo-web-browser`. Settings' sections are now:
Feedback, (narrowed) Data, Account (Log Out / Full Reset / Delete Account
— the last two danger-styled, two-tap confirm matching the existing
Full Reset pattern), Legal.

**Survey skips the "what's your name" step once it's already known** —
`profile.name` persists across plans (never reset between generations), so
re-asking it on every single regenerate read as nagging. `SurveyFlow.tsx`
now initializes `step` to `1` instead of `0` when `profile.name` is
already set (read once on mount via a lazy `useState` initializer, not
live — doesn't jump mid-survey if the user clears the field themselves).
Still reachable via Back from step 1 as an escape hatch if they want to
change it.

**Fuel tab's "My Plans"/"New Plan" buttons redesigned, then split into two**
(see "Two plan-creation paths" below for the second change) — were flat
text links that read as low-priority chrome, then a single lime "New Plan"
pill, now two pills side by side: "Generate" (lime) and "Custom"
(bordered). "My Plans" stayed a bordered pill with a clock icon on its own
row below, remaining-credits text in its own small badge.

**Two plan-creation paths: Generate (survey) vs Custom (self-picked
wizard).** `NewPlanChooser.tsx` is the first-time (no plan yet) landing
screen — two big buttons. Existing users skip that chooser entirely and
pick directly via the Fuel tab header's two pills (`fuel/index.tsx` sets
both `surveyMode` and a local `flowMode: 'survey' | 'custom'` together).
`onCancel`/Back from either flow always resets `flowMode` to `null`, which
correctly lands back on the chooser for a first-time user (`!plan` still
true) or the normal Fuel view for an existing one (`showSurvey` goes
false) — same handler, different outcome depending on whether a plan
already exists.

`CustomPlanFlow.tsx` (self-picked path) is its own small wizard, not just
a blank-plan shortcut: **step 0** is macro targets (`Step3Macros` reused
standalone via a new `hideStepLabel` prop, since it's not part of a
numbered 4-step survey here). **Steps 1-4** are one per meal slot —
breakfast, lunch, snack, dinner, in that order, matching how people
actually plan a week ("what am I doing for breakfast" as one decision, not
per day) rather than day-by-day. Each step lists that category's library
recipes (`getRecipeLibrary({ category })`, debounced search) as a tappable
multi-select; picking more than one for a slot rotates them round-robin
across the 7 days (`day[i] = picks[i % picks.length]`), picking none skips
that slot everywhere. **Shows a live running macro estimate** while
picking — `averageMacros()` over each slot's current selections, summed
across slots, rendered through the existing `DayMacroBar` component (same
one Fuel tab uses) against the target set in step 0, so the user can see
what's still missing or already overshot *before* finishing, not just
after. On the final step, builds the real `days`/`meals` arrays from the
selections, then — if at least one meal was actually picked — runs the
*same* `buildPrepAndShoppingRequest()` `SurveyFlow`'s Generate path builds,
but through `postClaudePrepAndShopping()` → `POST /api/claude/prep-and-shopping`
(`claude-backend`), **not** `postClaude()`/`/api/claude` — so Prep/Haul get
real content without spending a generation credit. That endpoint is
`requireAuth` + rate-limited (8/hour) instead of credit-gated, with a
6500-token cap (vs. `/api/claude/suggest`'s 1200 — too small for a full
week's prep/shopping JSON, ~6000 tokens). Free was an explicit product
call ("probably free for now, we're reworking the whole monetization to
freemium anyway") — revisit whether this should decrement once that
lands. Skipped entirely (no AI call, no rate-limit hit) if the user picks
zero meals in every slot. Any day still missing a slot afterward falls
back to the existing empty/add-more-meal CTAs in `fuel/index.tsx`
(`presetDay` route param into the library) — this wizard is a fast
bulk-fill, not the only way to add a meal.

**One-shot "Get AI Advice"** (per day, from the Fuel tab): deliberately
bounded — one short (2-4 sentence) targeted suggestion, never an
open-ended chat, never edits the plan itself (explicit user scope
decision). Routes through `/api/claude/suggest`
(`buildDayAdviceRequest()` in `lib/advicePrompt.ts`, `postClaudeSuggest()`
in `client.ts`) — an endpoint that already existed server-side
(`claude-backend`'s "Suggestion proxy", 1200-token cap, `requireAuth` but
**no credit decrement**) but had no caller anywhere in the app until this
feature; if a future lightweight one-shot AI feature is needed, prefer
this existing endpoint over adding a new one or routing through
`/api/claude` (which costs a full generation credit).

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
