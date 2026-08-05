import '../global.css'
import { useEffect, useRef } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { DarkTheme, DefaultTheme, Slot, ThemeProvider as NavigationThemeProvider, useRouter } from 'expo-router'
import type { Theme as NavigationTheme } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { Syne_400Regular, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne'
import { Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree'
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent'
import Head from 'expo-router/head'
import { ThemeProvider, useTheme } from '../state/ThemeContext'
import { AccountProvider, useAccount } from '../state/AccountContext'
import { PlanProvider, usePlan } from '../state/PlanContext'
import { warmUpBackend, getHistoryList, restoreHistory } from '../lib/client'

SplashScreen.preventAutoHideAsync()

// React Navigation's own theme controls native chrome (Stack headers, tab
// bar defaults) that NativeWind's colorScheme doesn't reach — without this,
// modal/stack headers render with RN Navigation's light-theme default
// regardless of our own dark/light toggle. Colors match tailwind.config.js.
const NAV_DARK_THEME: NavigationTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, primary: '#c8f542', background: '#0e0f11', card: '#1e2128', text: '#f0f2f5', border: '#2a2d35' },
}
const NAV_LIGHT_THEME: NavigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: '#c8f542', background: '#f0f2f5', card: '#ffffff', text: '#0e0f11', border: '#d8dce6' },
}

/**
 * Watches for an incoming OS share (a URL/text shared to the app from
 * Instagram, TikTok, a browser, etc. — native builds only, no-op on web
 * and in Expo Go) and hands it off to the recipe-import modal. Rendered
 * inside AppReadyGate so navigation is guaranteed mounted before any
 * router.push fires, including the cold-start-from-a-share case.
 */
function ShareIntentRedirect() {
  const router = useRouter()
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext()

  useEffect(() => {
    if (!hasShareIntent) return
    const url = shareIntent.webUrl || ''
    // Android often delivers a shared link as plain text with no separate
    // webUrl — fall back to fishing the first URL out of the text.
    const textUrl = !url && shareIntent.text ? (shareIntent.text.match(/https?:\/\/\S+/)?.[0] ?? '') : ''
    const finalUrl = url || textUrl
    // Only pass the text through when it's more than just the URL itself —
    // a bare link should land as `url` with an empty caption field.
    const text = shareIntent.text && shareIntent.text.trim() !== finalUrl ? shareIntent.text : ''
    resetShareIntent()
    router.push({ pathname: '/modal/recipe-import', params: { url: finalUrl, text } })
  }, [hasShareIntent, shareIntent, resetShareIntent, router])

  return null
}

/**
 * Local storage (AsyncStorage on native, plain `localStorage` on the web
 * export) isn't guaranteed durable long-term — browsers can and do clear
 * an inactive origin's storage (e.g. Safari's ~7-day ITP purge for
 * script-writable storage), which silently drops the locally-cached plan
 * and sends a returning user straight to the survey even though they
 * already generated one. Every generated plan is now also saved
 * server-side (see `modal/plan-name.tsx`), so on hydration, if there's no
 * local plan but the user is logged in, check the server's saved-plan
 * history and restore the most recent entry before ever falling through
 * to the survey. Silently does nothing (falls through to survey as
 * before) if there's no server history either, or the request fails.
 */
function AutoRestoreFromHistory() {
  const { plan, setPlan } = usePlan()
  const { isAuthed } = useAccount()
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current || plan || !isAuthed) return
    attempted.current = true
    getHistoryList()
      .then(({ history }) => {
        if (history.length === 0) return
        const mostRecent = [...history].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())[0]
        return restoreHistory(mostRecent.id).then((r) => setPlan(r.plan, r.userName, r.planName))
      })
      .catch(() => {
        /* non-critical — falls through to the survey same as before */
      })
  }, [plan, isAuthed, setPlan])

  return null
}

function AppReadyGate({ children }: { children: React.ReactNode }) {
  const { theme, isHydrated: themeReady } = useTheme()
  const { isHydrated: accountReady } = useAccount()
  const { isHydrated: planReady } = usePlan()
  const [fontsLoaded] = useFonts({
    Syne_400Regular,
    Syne_700Bold,
    Syne_800ExtraBold,
    Figtree_300Light,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
  })

  const ready = themeReady && accountReady && planReady && fontsLoaded

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  useEffect(() => {
    warmUpBackend()
  }, [])

  if (!ready) return null
  return <NavigationThemeProvider value={theme === 'dark' ? NAV_DARK_THEME : NAV_LIGHT_THEME}>{children}</NavigationThemeProvider>
}

export default function RootLayout() {
  return (
    // ShareIntentProvider must sit above everything that might react to a
    // share (per expo-share-intent's docs it should be the outermost
    // provider) — it's inert on web/Expo Go where the native module is
    // absent, so it costs nothing in this dev environment.
    <ShareIntentProvider>
      {/* Web only (no-op on native) — the static export's HTML shell has an
          empty <title>, since Expo Router's web build doesn't read app.json's
          `name` for it automatically. */}
      <Head>
        <title>Fuelplan</title>
      </Head>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AccountProvider>
            <PlanProvider>
              <AppReadyGate>
                <ShareIntentRedirect />
                <AutoRestoreFromHistory />
                <Slot />
              </AppReadyGate>
            </PlanProvider>
          </AccountProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ShareIntentProvider>
  )
}
