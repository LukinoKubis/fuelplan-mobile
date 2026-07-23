import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/Text'
import Svg, { Path, Rect } from 'react-native-svg'
import { useThemeColors } from '../../lib/themeColors'

const LOADER_STEPS = [
  { headline: 'Building your plan', sub: 'Reading your profile…', progress: 8 },
  { headline: 'Crunching macros', sub: 'Calculating your daily targets…', progress: 28 },
  { headline: 'Designing your meals', sub: "Crafting 7 days of food you'll love…", progress: 52 },
  { headline: 'Writing prep steps', sub: 'Planning your Sunday batch cook…', progress: 74 },
  { headline: 'Building your haul', sub: 'Compiling the shopping list…', progress: 90 },
  { headline: 'Almost ready', sub: 'Putting the finishing touches…', progress: 97 },
]

interface LoadingOverlayProps {
  onCancel: () => void
}

export function LoadingOverlay({ onCancel }: LoadingOverlayProps) {
  const c = useThemeColors()
  const [step, setStep] = useState(0)
  const [showCancel, setShowCancel] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, LOADER_STEPS.length - 1))
    }, 3200)
    const cancelTimer = setTimeout(() => setShowCancel(true), 3000)
    return () => {
      clearInterval(interval)
      clearTimeout(cancelTimer)
    }
  }, [])

  const current = LOADER_STEPS[step]

  return (
    <View className="absolute inset-0 items-center justify-center gap-6 px-8" style={{ backgroundColor: c.bg }}>
      <Svg width={56} height={56} viewBox="0 0 48 48" fill="none">
        <Rect width={48} height={48} rx={14} fill="#c8f542" />
        <Path d="M25 7L13 27h12l-4 14 18-22H27L31 7H25z" fill="#0e0f11" />
      </Svg>
      <View className="items-center">
        <Text className="mb-1.5 text-center font-display text-xl" style={{ color: c.text }}>{current.headline}</Text>
        <Text className="text-center text-sm" style={{ color: c.muted }}>{current.sub}</Text>
      </View>
      <View className="h-1.5 w-full max-w-xs overflow-hidden rounded-full" style={{ backgroundColor: c.border }}>
        <View className="h-full rounded-full bg-lime" style={{ width: `${current.progress}%` }} />
      </View>
      {showCancel && (
        <Pressable onPress={onCancel}>
          <Text className="text-sm underline" style={{ color: c.muted }}>Cancel</Text>
        </Pressable>
      )}
    </View>
  )
}
