import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/Text'
import { useThemeColors } from '../../lib/themeColors'

export interface ChipOption {
  value: string
  label: string
  icon?: ReactNode
  sub?: string
}

interface PillGroupProps {
  options: ChipOption[]
  value: string
  onChange: (value: string) => void
}

export function PillGroup({ options, value, onChange }: PillGroupProps) {
  const c = useThemeColors()
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className="rounded-full border px-3.5 py-2"
            style={{ borderColor: active ? c.lime : c.border, backgroundColor: active ? 'rgba(200,245,66,0.15)' : c.bg2 }}
          >
            <Text className="text-sm font-semibold" style={{ color: active ? c.lime : c.muted }}>
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

interface CardGridProps {
  options: ChipOption[]
  value: string | string[]
  onChange: (value: string) => void
  multi?: boolean
  columns?: 2 | 3
}

export function CardGrid({ options, value, onChange, multi, columns = 2 }: CardGridProps) {
  const c = useThemeColors()
  const isActive = (v: string) => (multi ? (value as string[]).includes(v) : value === v)
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = isActive(opt.value)
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className="items-center gap-1 rounded-xl border px-2 py-3"
            style={{
              width: columns === 3 ? '31.5%' : '48%',
              borderColor: active ? c.lime : c.border,
              backgroundColor: active ? 'rgba(200,245,66,0.12)' : c.bg2,
            }}
          >
            {opt.icon}
            <Text className="text-xs font-semibold" style={{ color: active ? c.lime : c.text }}>
              {opt.label}
            </Text>
            {opt.sub && (
              <Text className="text-center text-[10px]" style={{ color: c.muted }}>
                {opt.sub}
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

interface VarietyGroupProps {
  options: { value: string; title: string; desc: string; icon?: ReactNode }[]
  value: string
  onChange: (value: string) => void
}

export function VarietyGroup({ options, value, onChange }: VarietyGroupProps) {
  const c = useThemeColors()
  return (
    <View className="gap-2">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className="flex-row items-center gap-3 rounded-xl border px-3.5 py-3"
            style={{ borderColor: active ? c.lime : c.border, backgroundColor: active ? 'rgba(200,245,66,0.1)' : c.bg2 }}
          >
            {opt.icon}
            <View className="flex-1">
              <Text className="text-sm font-bold" style={{ color: c.text }}>
                {opt.title}
              </Text>
              <Text className="text-xs" style={{ color: c.muted }}>
                {opt.desc}
              </Text>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}
