import { Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/components/Text'
import Svg, { Polyline } from 'react-native-svg'
import type { ShoppingCategory } from '../../types/plan'
import { usePlan } from '../../state/PlanContext'
import { useThemeColors } from '../../lib/themeColors'

/** Hand-drawn checkbox (RN has no native checkbox primitive) — filled lime square with a checkmark when checked. */
function Checkbox({ checked }: { checked: boolean }) {
  const c = useThemeColors()
  return (
    <View
      className="h-4 w-4 items-center justify-center rounded"
      style={{ borderWidth: checked ? 0 : 1.5, borderColor: c.border, backgroundColor: checked ? c.lime : 'transparent' }}
    >
      {checked && (
        <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#0e0f11" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="20 6 9 17 4 12" />
        </Svg>
      )}
    </View>
  )
}

/** The Haul tab's content — categorized, checkable shopping list, or an empty state before a plan exists. */
export function ShoppingList({ categories }: { categories: ShoppingCategory[] }) {
  const c = useThemeColors()
  const { shopChecks, toggleShopCheck } = usePlan()

  if (!categories.length) {
    return (
      <View className="min-h-[50%] flex-1 items-center justify-center gap-2 px-8">
        <Text className="font-display text-xl" style={{ color: c.text }}>Haul</Text>
        <Text className="max-w-xs text-center text-sm" style={{ color: c.muted }}>Generate a meal plan in Fuel to see your shopping list here.</Text>
      </View>
    )
  }

  return (
    <ScrollView contentContainerClassName="gap-3 p-4">
      {categories.map((cat) => (
        <View key={cat.category} className="overflow-hidden rounded-2xl border" style={{ borderColor: c.border, backgroundColor: c.card }}>
          <Text className="border-b px-4 py-2.5 text-xs font-bold uppercase tracking-wide" style={{ borderColor: c.border, color: c.muted }}>
            {cat.category}
          </Text>
          <View>
            {cat.items.map((item, i) => {
              const id = `${cat.category}-${i}-${item.name}`
              const checked = !!shopChecks[id]
              return (
                <Pressable
                  key={id}
                  onPress={() => toggleShopCheck(id)}
                  className="flex-row items-center gap-3 border-b px-4 py-2.5"
                  style={{ borderColor: c.border }}
                >
                  <Checkbox checked={checked} />
                  <Text className="flex-1 text-sm" style={{ color: checked ? c.muted : c.text, textDecorationLine: checked ? 'line-through' : 'none' }}>
                    {item.name}
                  </Text>
                  <Text className="text-xs" style={{ color: c.muted }}>{item.qty}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}
