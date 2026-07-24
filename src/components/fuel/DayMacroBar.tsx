import { View } from 'react-native'
import { Text } from '@/components/Text'
import type { DayPlan } from '../../types/plan'
import { useThemeColors } from '../../lib/themeColors'

/** One macro's progress bar — actual/target values plus a filled bar clamped at 100%. */
function Bar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const c = useThemeColors()
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <View className="flex-1">
      <Text className="text-[11px]" style={{ color: c.muted }}>{label}</Text>
      <Text className="mb-1 text-[11px]" style={{ color: c.muted }}>
        {value}/{target}
        {label !== 'kcal' ? 'g' : ''}
      </Text>
      <View className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: c.border }}>
        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  )
}

/** Row of 4 macro bars (kcal/protein/carbs/fat) comparing a day's actual totals against its target. */
export function DayMacroBar({ day, target }: { day: DayPlan; target: { kcal: number; protein: number; carbs: number; fat: number } }) {
  const c = useThemeColors()
  return (
    <View className="flex-row gap-2 border-b px-4 py-3" style={{ borderColor: c.border, backgroundColor: c.card }}>
      <Bar label="kcal" value={day.kcal} target={target.kcal} color={c.lime} />
      <Bar label="protein" value={day.protein} target={target.protein} color={c.blue} />
      <Bar label="carbs" value={day.carbs} target={target.carbs} color={c.orange} />
      <Bar label="fat" value={day.fat} target={target.fat} color={c.red} />
    </View>
  )
}
