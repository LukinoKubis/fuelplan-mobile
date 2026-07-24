import { useEffect, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/components/Text'
import { useRouter } from 'expo-router'
import { deleteHistory, getHistoryList, restoreHistory } from '../../lib/client'
import { usePlan } from '../../state/PlanContext'
import type { HistoryEntryMeta } from '../../types/plan'
import { useThemeColors } from '../../lib/themeColors'

/** "My Plans" modal — lists saved plans (max 5 server-side) with Restore/Delete actions. */
export default function HistoryScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const { setPlan } = usePlan()
  const [entries, setEntries] = useState<HistoryEntryMeta[] | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    getHistoryList()
      .then((res) => setEntries(res.history))
      .catch(() => setEntries([]))
  }, [])

  async function handleRestore(id: number) {
    setBusyId(id)
    try {
      const res = await restoreHistory(id)
      setPlan(res.plan, res.userName, res.planName)
      router.back()
    } catch {
      /* non-critical */
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: number) {
    setBusyId(id)
    try {
      await deleteHistory(id)
      setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev))
    } catch {
      /* non-critical */
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ScrollView contentContainerClassName="p-5" style={{ backgroundColor: c.bg }}>
      {entries === null && <Text className="text-sm" style={{ color: c.muted }}>Loading…</Text>}
      {entries?.length === 0 && (
        <Text className="text-sm" style={{ color: c.muted }}>No saved plans yet. Name a plan after generating it to see it here.</Text>
      )}
      <View className="gap-2.5">
        {entries?.map((entry) => (
          <View key={entry.id} className="flex-row items-center justify-between gap-3 rounded-xl border p-3.5" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold" numberOfLines={1} style={{ color: c.text }}>{entry.planName}</Text>
              <Text className="text-xs" style={{ color: c.muted }}>
                {new Date(entry.savedAt).toLocaleDateString()} · {entry.macros?.kcal} kcal
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => handleRestore(entry.id)}
                disabled={busyId === entry.id}
                className="rounded-lg border px-2.5 py-1.5"
                style={{ borderColor: 'rgba(200,245,66,0.4)', backgroundColor: 'rgba(200,245,66,0.15)', opacity: busyId === entry.id ? 0.5 : 1 }}
              >
                <Text className="text-xs font-bold text-lime">Restore</Text>
              </Pressable>
              <Pressable
                onPress={() => handleDelete(entry.id)}
                disabled={busyId === entry.id}
                className="rounded-lg border px-2.5 py-1.5"
                style={{ borderColor: 'rgba(255,87,87,0.3)', backgroundColor: 'rgba(255,87,87,0.1)', opacity: busyId === entry.id ? 0.5 : 1 }}
              >
                <Text className="text-xs font-bold" style={{ color: c.red }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
