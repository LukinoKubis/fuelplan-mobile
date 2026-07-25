import { View } from 'react-native'
import { Text } from '@/components/Text'
import { useThemeColors } from '../../lib/themeColors'

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

/** Traffic-light convention (easy=lime, moderate=orange, hard=red) — used on both the library list cards and the detail screen. Kept as its own badge rather than folded into the macro chips elsewhere on a card, so the color doesn't read as another macro value. */
export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const c = useThemeColors()
  const color = difficulty === 'beginner' ? c.lime : difficulty === 'advanced' ? c.red : c.orange
  return (
    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${color}22` }}>
      <Text className="text-[10px] font-bold" style={{ color }}>{DIFFICULTY_LABEL[difficulty] ?? difficulty}</Text>
    </View>
  )
}
