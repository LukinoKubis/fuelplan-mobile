import '../global.css'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Slot } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { Syne_400Regular, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne'
import { Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree'
import { ThemeProvider, useTheme } from '../state/ThemeContext'
import { AccountProvider, useAccount } from '../state/AccountContext'
import { PlanProvider, usePlan } from '../state/PlanContext'
import { warmUpBackend } from '../lib/client'

SplashScreen.preventAutoHideAsync()

function AppReadyGate({ children }: { children: React.ReactNode }) {
  const { isHydrated: themeReady } = useTheme()
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
  return <>{children}</>
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
