import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/components/Text'
import { usePlan } from '../../../state/PlanContext'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { useThemeColors } from '../../../lib/themeColors'

const LANE_LABEL: Record<string, string> = {
  stovetop: 'Stovetop',
  oven: 'Oven',
  active: 'Active prep',
  passive: 'Passive',
}

/** Prep tab — Sunday batch-cook checklist, each step expandable to show its full detail text. */
export default function PrepScreen() {
  const c = useThemeColors()
  const { plan } = usePlan()
  const [expanded, setExpanded] = useState<number | null>(null)

  const tasks = plan?.prep_tasks || []
  const totalMinutes = tasks.reduce((s, t) => s + t.durationMinutes, 0)

  return (
    <ErrorBoundary>
      <ScrollView className="flex-1 bg-light-bg dark:bg-bg" contentContainerClassName="p-4">
        <View className="mb-4">
          <Text className="font-display text-lg font-extrabold" style={{ color: c.text }}>Sunday Prep</Text>
          {tasks.length > 0 && (
            <Text className="text-xs" style={{ color: c.muted }}>
              {tasks.length} steps · ~{Math.round(totalMinutes)} min active
            </Text>
          )}
        </View>

        {!tasks.length ? (
          <View className="rounded-2xl border p-4" style={{ borderColor: c.border, backgroundColor: c.card }}>
            <Text className="text-center text-sm" style={{ color: c.muted }}>Generate a meal plan to see your Sunday prep list.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {tasks.map((task, i) => (
              <View key={i} className="rounded-xl border p-3" style={{ borderColor: c.border, backgroundColor: c.card }}>
                <Pressable onPress={() => setExpanded(expanded === i ? null : i)} className="flex-row items-start gap-2.5">
                  <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(200,245,66,0.2)' }}>
                    <Text className="text-[10px] font-bold text-lime">{i + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold" style={{ color: c.text }}>{task.task}</Text>
                    <Text className="text-[11px]" style={{ color: c.muted }}>
                      {task.meal} · {LANE_LABEL[task.lane] || task.lane}
                      {task.durationMinutes > 0 ? ` · ${task.durationMinutes} min` : ''}
                    </Text>
                  </View>
                </Pressable>
                {expanded === i && (
                  <Text className="mt-2 pl-7 text-xs leading-relaxed" style={{ color: c.muted }}>{task.detail}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ErrorBoundary>
  )
}
