import { Pressable } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import Svg, { Line } from 'react-native-svg'
import { useThemeColors } from '../../lib/themeColors'

// iOS modal presentations swipe-to-dismiss, but that gesture isn't
// discoverable and doesn't exist on Android at all — every screen in this
// stack needs an explicit, visible way to leave, not just the platform
// gesture. A plain text "Close" here sat flush against the header title
// with no spacing at all — React Navigation's headerLeft slot doesn't add
// the padding a native back button gets for free. Matches the circular
// bordered icon-button treatment already used for the Settings gear in
// Header.tsx, with its own margin so it doesn't hug the title or the edge.
function CloseButton() {
  const router = useRouter()
  const c = useThemeColors()
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      accessibilityLabel="Close"
      className="ml-2 mr-3 h-8 w-8 items-center justify-center rounded-full border"
      style={{ borderColor: c.border }}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Line x1={18} y1={6} x2={6} y2={18} />
        <Line x1={6} y1={6} x2={18} y2={18} />
      </Svg>
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
