import { View } from 'react-native'
import { Text } from '@/components/Text'
import Slider from '@react-native-community/slider'
import { getPaceCategory } from '../../types/goal'
import { useThemeColors } from '../../lib/themeColors'

interface PaceSliderProps {
  value: number
  onChange: (rate: number) => void
}

export function PaceSlider({ value, onChange }: PaceSliderProps) {
  const c = useThemeColors()
  const cat = getPaceCategory(value)

  return (
    <View className="rounded-xl border px-3.5 py-3.5" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-extrabold" style={{ color: cat.color }}>
          {value.toFixed(2)} kg/wk
        </Text>
        <Text className="text-xs font-semibold" style={{ color: cat.color }}>
          {cat.label}
        </Text>
      </View>
      <Slider
        minimumValue={0.1}
        maximumValue={1.5}
        step={0.05}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={cat.color}
        maximumTrackTintColor={c.border}
        thumbTintColor={cat.color}
      />
      <View className="mt-1 flex-row justify-between">
        {['0.1', '0.5', '0.75', '1.0', '1.5'].map((v) => (
          <Text key={v} className="text-[10px]" style={{ color: c.muted }}>
            {v}
          </Text>
        ))}
      </View>
      <Text className="mt-2 text-xs" style={{ color: c.muted }}>
        {cat.desc}
      </Text>
    </View>
  )
}
