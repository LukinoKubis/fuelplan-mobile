import '../global.css'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { DarkTheme, DefaultTheme, Slot, ThemeProvider as NavigationThemeProvider } from 'expo-router'
import type { Theme as NavigationTheme } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { Syne_400Regular, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne'
import { Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree'
import { ThemeProvider, useTheme } from '../state/ThemeContext'
import { AccountProvider, useAccount } from '../state/AccountContext'
import { PlanProvider, usePlan } from '../state/PlanContext'
import { warmUpBackend } from '../lib/client'

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AccountProvider>
          <PlanProvider>
            <AppReadyGate>
              <Slot />
            </AppReadyGate>
          </PlanProvider>
        </AccountProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  )
}
