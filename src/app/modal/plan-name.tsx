import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native'
import { Text } from '@/components/Text'
import { useRouter } from 'expo-router'
import { usePlan } from '../../state/PlanContext'
import { saveHistory } from '../../lib/client'
import { useThemeColors } from '../../lib/themeColors'

/** Shown right after generating a plan — names it and saves to history, or Skip to leave it unsaved/unnamed. */
export default function PlanNameScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const { plan, userName, setPlanName } = usePlan()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!plan) return router.back()
    setSaving(true)
    const finalName = name.trim() || 'My Plan'
    try {
      await saveHistory({ plan, userName, planName: finalName, macros: plan.summary })
      setPlanName(finalName)
    } catch {
      /* non-critical — plan already saved locally */
    } finally {
      setSaving(false)
      router.back()
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 p-5" style={{ backgroundColor: c.bg }}>
      <Text className="mb-1.5 text-lg" style={{ color: c.text }}>Name your plan</Text>
      <Text className="mb-4 text-sm" style={{ color: c.muted }}>Give this week's plan a name so you can find it later in My Plans.</Text>
      <TextInput
        autoFocus
        value={name}
        onChangeText={setName}
        placeholder="e.g. Cutting Week 1"
        placeholderTextColor={c.muted}
        className="mb-4 rounded-xl border px-3 py-2.5 text-sm"
        style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
      />
      <View className="flex-row gap-3">
        <Pressable onPress={() => router.back()} className="flex-1 items-center rounded-xl border py-2.5" style={{ borderColor: c.border }}>
          <Text className="text-sm font-semibold" style={{ color: c.muted }}>Skip</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={saving} className="flex-1 items-center rounded-xl bg-lime py-2.5" style={{ opacity: saving ? 0.6 : 1 }}>
          <Text className="text-sm font-extrabold text-bg">Save</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
