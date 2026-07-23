import { Pressable, View } from 'react-native'
import { Text } from '@/components/Text'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { useThemeColors } from '../../lib/themeColors'

export function Header({ onOpenSettings }: { onOpenSettings: () => void }) {
  const c = useThemeColors()
  return (
    <SafeAreaView edges={['top']} className="flex-row items-center justify-between border-b px-4 py-3" style={{ borderColor: c.border, backgroundColor: c.card }}>
      <View className="flex-row items-center gap-2">
        <Svg width={26} height={26} viewBox="0 0 48 48" fill="none">
          <Rect width={48} height={48} rx={14} fill="#c8f542" />
          <Path d="M25 7L13 27h12l-4 14 18-22H27L31 7H25z" fill="#0e0f11" />
        </Svg>
        <Text className="font-display text-lg tracking-tight" style={{ color: c.text }}>Fuelplan</Text>
      </View>
      <Pressable onPress={onOpenSettings} hitSlop={8} accessibilityLabel="Settings" className="h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: c.border }}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={12} cy={12} r={3} />
          <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </Svg>
      </Pressable>
    </SafeAreaView>
  )
}
