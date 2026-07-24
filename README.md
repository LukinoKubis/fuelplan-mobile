# Fuelplan Mobile

AI-powered meal prep app — native iOS/Android port of the Fuelplan PWA, built for real App Store/Play Store distribution. Expo (managed) + React Native + TypeScript + NativeWind v4.

> Migrated off `fuelplan-frontend` (the Vite/React PWA, now frozen) on
> 2026-07-23 — PWAs can't do OS-level share-target integration or get
> real store presence. See `CLAUDE.md` for the full architecture writeup,
> porting gotchas, and known limitations — this file is the quick-start.

## Setup

```bash
npm install
npx expo start --web   # fastest loop for UI work — no device/emulator needed
npx expo start          # real dev-client/Expo Go flow, needs a device or emulator
```

No local backend — the app always talks to the live Railway-hosted
`claude-backend` (`API_BASE` in `src/lib/client.ts`). No `.env` needed for
local dev.

```bash
npx tsc --noEmit     # typecheck
npx expo-doctor       # project health check
```

## Tech stack

- **Expo SDK 57 + Expo Router** (file-based routing, `src/app/`) + **React Native 0.86**, TypeScript throughout
- **NativeWind v4** for styling — Tailwind utility classes, dark/light theme via `nativewind`'s `colorScheme`, not CSS variables (RN has none) — see `CLAUDE.md`'s "Design tokens"/"Theme switching" sections for the exact convention
- **State**: plain React Context + `useReducer`/`useState`, no external state library — `ThemeContext`, `AccountContext`, `PlanContext` in `src/state/`, persisted to `@react-native-async-storage/async-storage` (the JWT specifically goes through `expo-secure-store`/Keychain instead)
- **No router library beyond Expo Router** — bottom tabs (`<Tabs>`), an auth stack, and a modal route group, all file-based
- Linked to **EAS** (`app.json`'s `extra.eas.projectId`) for builds/credentials; not yet submitted to either store

## Project structure

```
src/
  app/            — Expo Router routes: _layout.tsx (root), (auth)/, (tabs)/, modal/
  state/          — ThemeContext, AccountContext, PlanContext
  lib/            — API client, prompt builders, storage helpers, misc utilities
  types/          — shared TS types
  components/     — layout/, fuel/, survey/, shared/
```

Full detail (design-token conventions, async-storage hydration pattern,
every real bug hit and fixed during the port, current milestone status) is
in `CLAUDE.md` — written for AI-agent-driven development, but useful for a
human onboarding too.

## Building & deploying

```bash
eas build --profile development --platform android   # dev-client build, installable directly
eas build --profile preview --platform android        # internal-testing build
eas build --profile production --platform ios|android # store-bound build
```

No build has shipped yet — see `CLAUDE.md`'s milestone notes for what's
blocking store submission (Apple Developer Program enrollment, Google Play
Console, store listing assets).
