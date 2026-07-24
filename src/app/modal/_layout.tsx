import { Pressable } from 'react-native'
import { Text } from '@/components/Text'
import { Stack, useRouter } from 'expo-router'
import { useThemeColors } from '../../lib/themeColors'

// iOS modal presentations swipe-to-dismiss, but that gesture isn't
// discoverable and doesn't exist on Android at all — every screen in this
// stack needs an explicit, visible way to leave, not just the platform
// gesture.
function CloseButton() {
  const router = useRouter()
  const c = useThemeColors()
  return (
    <Pressable onPress={() => router.back()} hitSlop={8}>
      <Text className="text-sm font-semibold" style={{ color: c.muted }}>Close</Text>
    </Pressable>
  )
}

export default function ModalLayout() {
  return (
    <Stack screenOptions={{ presentation: 'modal', headerShown: true, headerLeft: () => <CloseButton /> }}>
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="history" options={{ title: 'My Plans' }} />
      <Stack.Screen name="plan-name" options={{ title: 'Name your plan', presentation: 'formSheet', headerLeft: () => null }} />
    </Stack>
  )
}
