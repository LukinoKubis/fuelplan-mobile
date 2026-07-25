import { Pressable, View } from 'react-native'
import { Text } from '@/components/Text'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useThemeColors } from '../../lib/themeColors'

interface NewPlanChooserProps {
  onGenerate: () => void
  onCustom: () => void
}

/**
 * First-time landing screen (no plan exists yet) — picks between the two
 * plan-creation paths. Existing users see the same two options as pills in
 * the Fuel tab's header instead (see fuel/index.tsx), so this only renders
 * once, before any plan exists.
 */
export function NewPlanChooser({ onGenerate, onCustom }: NewPlanChooserProps) {
  const c = useThemeColors()
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-light-bg dark:bg-bg px-6">
      <Text className="mb-2 text-center font-display text-3xl leading-tight text-light-text dark:text-text">
        Let's build{'\n'}your plan
      </Text>
      <Text className="mb-8 text-center text-sm text-light-muted dark:text-muted">Choose how you want to start.</Text>

      <Pressable onPress={onGenerate} className="mb-3 w-full items-center rounded-2xl bg-lime px-5 py-4">
        <Text className="text-base font-extrabold text-bg">Generate My Plan</Text>
        <Text className="mt-1 text-xs text-bg" style={{ opacity: 0.75 }}>Answer a few questions, we pick the meals</Text>
      </Pressable>

      <Pressable onPress={onCustom} className="w-full items-center rounded-2xl border px-5 py-4" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
        <Text className="text-base font-extrabold" style={{ color: c.text }}>Create Custom Plan</Text>
        <Text className="mt-1 text-xs" style={{ color: c.muted }}>Set your targets, pick every meal yourself</Text>
      </Pressable>
    </SafeAreaView>
  )
}
