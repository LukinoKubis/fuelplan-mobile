import { Pressable, View } from 'react-native'
import { Text } from '@/components/Text'
import { GOAL_PRESETS, formatGoalOffset } from '../../types/goal'
import { useThemeColors } from '../../lib/themeColors'

interface GoalPickerProps {
  value: number
  onChange: (offset: number) => void
}

/** Grid of goal-preset cards (Lean Bulk → Aggressive Cut) — the "Quick select" path in Step3Macros. */
export function GoalPicker({ value, onChange }: GoalPickerProps) {
  const c = useThemeColors()
  return (
    <View className="flex-row flex-wrap gap-2">
      {GOAL_PRESETS.map((g) => {
        const active = g.offset === value
        return (
          <Pressable
            key={g.offset}
            onPress={() => onChange(g.offset)}
            className="gap-1 rounded-xl border px-3 py-2.5"
            style={{
              width: g.wide ? '100%' : '48%',
              borderColor: active ? g.color : c.border,
              backgroundColor: active ? `${g.color}22` : c.bg2,
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold" style={{ color: c.text }}>
                {g.name}
              </Text>
              <Text className="text-xs font-extrabold" style={{ color: g.color }}>
                {formatGoalOffset(g.offset)}
              </Text>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
