import { Pressable, View } from 'react-native'
import { Text } from '@/components/Text'
import Svg, { Path } from 'react-native-svg'
import type { Meal } from '../../types/plan'
import { useThemeColors } from '../../lib/themeColors'

interface MealCardProps {
  meal: Meal
  eaten: boolean
  onToggleEaten: () => void
  favorite: boolean
  onToggleFavorite: () => void
  onReplace: () => void
}

/** One meal's card in the Fuel tab's day view — macros, ingredients, favorite toggle, eaten toggle, replace action. */
export function MealCard({ meal, eaten, onToggleEaten, favorite, onToggleFavorite, onReplace }: MealCardProps) {
  const c = useThemeColors()
  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: c.border, backgroundColor: c.card, opacity: eaten ? 0.6 : 1 }}>
      <View className="mb-1.5 flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: c.muted }}>{meal.time}</Text>
          <Text className="font-display text-base" style={{ color: c.text }}>{meal.name}</Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={onReplace} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M23 4v6h-6" />
              <Path d="M1 20v-6h6" />
              <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </Svg>
          </Pressable>
          <Pressable onPress={onToggleFavorite} hitSlop={8}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill={favorite ? c.lime : 'none'} stroke={favorite ? c.lime : c.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </Svg>
          </Pressable>
        </View>
      </View>

      <Text className="mb-3 text-xs leading-relaxed" style={{ color: c.muted }}>{meal.ingredients}</Text>

      <View className="mb-3 flex-row flex-wrap gap-3">
        <Text className="text-[11px] font-semibold" style={{ color: c.muted }}>{meal.kcal} kcal</Text>
        <Text className="text-[11px] font-semibold" style={{ color: c.muted }}>{meal.protein}g protein</Text>
        <Text className="text-[11px] font-semibold" style={{ color: c.muted }}>{meal.carbs}g carbs</Text>
        <Text className="text-[11px] font-semibold" style={{ color: c.muted }}>{meal.fat}g fat</Text>
      </View>

      <Pressable
        onPress={onToggleEaten}
        className="items-center rounded-lg border py-2"
        style={{ borderColor: eaten ? c.lime : c.border, backgroundColor: eaten ? 'rgba(200,245,66,0.15)' : 'transparent' }}
      >
        <Text className="text-xs font-bold" style={{ color: eaten ? c.lime : c.muted }}>{eaten ? '✓ Eaten' : 'Mark as eaten'}</Text>
      </Pressable>
    </View>
  )
}
