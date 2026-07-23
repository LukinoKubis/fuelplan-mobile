import { Pressable, Text, View } from 'react-native'
import Svg, { Line, Path } from 'react-native-svg'
import { useThemeColors } from '../../lib/themeColors'

interface ErrorPanelProps {
  message: string
  onRetry: () => void
  onDismiss: () => void
  isOutOfPlans?: boolean
  onTopUp?: () => void
}

export function ErrorPanel({ message, onRetry, onDismiss, isOutOfPlans, onTopUp }: ErrorPanelProps) {
  const c = useThemeColors()
  return (
    <View className="absolute inset-0 items-center justify-center gap-4 px-8" style={{ backgroundColor: c.bg }}>
      <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={c.red} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <Line x1={12} y1={9} x2={12} y2={13} />
        <Line x1={12} y1={17} x2={12.01} y2={17} />
      </Svg>
      <Text className="text-center font-display text-xl" style={{ color: c.text }}>{isOutOfPlans ? 'Out of plans' : 'Something went wrong'}</Text>
      <Text className="max-w-xs text-center text-sm" style={{ color: c.muted }}>{message}</Text>
      <View className="flex-row gap-3">
        {isOutOfPlans && onTopUp ? (
          <Pressable onPress={onTopUp} className="rounded-xl bg-lime px-5 py-2.5">
            <Text className="text-sm font-extrabold text-bg">Top up →</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onRetry} className="rounded-xl bg-lime px-5 py-2.5">
            <Text className="text-sm font-extrabold text-bg">Try Again</Text>
          </Pressable>
        )}
        <Pressable onPress={onDismiss} className="rounded-xl border px-5 py-2.5" style={{ borderColor: c.border }}>
          <Text className="text-sm font-semibold" style={{ color: c.muted }}>Back</Text>
        </Pressable>
      </View>
    </View>
  )
}
