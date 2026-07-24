import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/Text'
import { useThemeColors } from '../../lib/themeColors'

interface SettingsActionProps {
  icon: ReactNode
  iconColor?: string
  title: string
  desc: string
  onPress?: () => void
  danger?: boolean
  trailing?: ReactNode
}

/**
 * One row in the Settings screen — icon, title, description, and either a
 * tap target (chevron) or a `trailing` control like a toggle switch. Renders
 * as a plain View (not Pressable) when `trailing` is given, since the row
 * itself isn't the interactive element in that case — the toggle is.
 */
export function SettingsAction({ icon, iconColor, title, desc, onPress, danger, trailing }: SettingsActionProps) {
  const c = useThemeColors()
  const resolvedIconColor = iconColor || c.lime
  const content = (
    <>
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${resolvedIconColor}1a` }}>
        {icon}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold" style={{ color: danger ? c.red : c.text }}>{title}</Text>
        <Text className="text-xs" style={{ color: c.muted }}>{desc}</Text>
      </View>
      {trailing ?? (onPress && <Text style={{ color: c.muted }}>›</Text>)}
    </>
  )

  if (trailing) {
    return (
      <View className="w-full flex-row items-center gap-3 rounded-xl border p-3" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
        {content}
      </View>
    )
  }

  return (
    <Pressable onPress={onPress} disabled={!onPress} className="w-full flex-row items-center gap-3 rounded-xl border p-3" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
      {content}
    </Pressable>
  )
}
