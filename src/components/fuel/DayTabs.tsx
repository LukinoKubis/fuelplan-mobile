import { Pressable, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Svg, { Path } from 'react-native-svg'
import { useThemeColors } from '../../lib/themeColors'

interface DayTabsProps {
  days: string[]
  active: number
  onChange: (index: number) => void
}

const SWIPE_THRESHOLD_PX = 40

export function DayTabs({ days, active, onChange }: DayTabsProps) {
  const c = useThemeColors()
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const activeDay = days[active]

  function go(delta: number) {
    const next = active + delta
    if (next < 0 || next >= days.length) return
    onChange(next)
  }

  // Discrete swipe → day change, same threshold-based approach as the web
  // version's touchstart/touchend delta check — no drag-follow animation,
  // just "did the gesture cross the threshold" on release.
  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (Math.abs(e.translationX) < SWIPE_THRESHOLD_PX) return
      const delta = e.translationX > 0 ? -1 : 1
      const next = active + delta
      if (next < 0 || next >= days.length) return
      onChange(next)
    })

  return (
    <GestureDetector gesture={panGesture}>
      <View className="border-b" style={{ borderColor: c.border, backgroundColor: c.card }}>
        <View className="flex-row items-center justify-between px-2 py-2.5">
          <Pressable onPress={() => go(-1)} disabled={active === 0} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-lg" style={{ opacity: active === 0 ? 0.3 : 1 }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 18l-6-6 6-6" />
            </Svg>
          </Pressable>
          <Text className="text-sm font-bold" style={{ color: c.text }}>
            {activeDay}
            {activeDay === todayName && <Text className="ml-1.5 font-semibold" style={{ color: c.muted }}> · Today</Text>}
          </Text>
          <Pressable onPress={() => go(1)} disabled={active === days.length - 1} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-lg" style={{ opacity: active === days.length - 1 ? 0.3 : 1 }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 18l6-6-6-6" />
            </Svg>
          </Pressable>
        </View>
        <View className="flex-row items-center justify-center gap-2.5 pb-2.5">
          {days.map((day, i) => (
            <Pressable key={day} onPress={() => onChange(i)} hitSlop={6} className="h-4 w-4 items-center justify-center">
              <View
                className="rounded-full"
                style={{ width: i === active ? 8 : 6, height: i === active ? 8 : 6, backgroundColor: i === active ? c.lime : c.border }}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </GestureDetector>
  )
}
