import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native'
import { Text } from '@/components/Text'
import { useRouter } from 'expo-router'
import { ApiError, submitFeedback } from '../../lib/client'
import { useThemeColors } from '../../lib/themeColors'
import { friendlyErrorMessage } from '../../lib/errorMessage'

/** Free-text suggestion/bug-report box — reachable from Settings. Sends straight to the backend (rate-limited, no admin UI to browse it yet — see claude-backend's CLAUDE.md), best-effort emailed to the app owner. */
export default function FeedbackScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSend() {
    if (!message.trim()) return
    setSending(true)
    setError('')
    try {
      await submitFeedback(message.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : friendlyErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: c.bg }}>
        <Text className="mb-2 text-lg font-bold" style={{ color: c.text }}>Thanks!</Text>
        <Text className="mb-6 text-center text-sm" style={{ color: c.muted }}>We read every message — really appreciate you taking the time.</Text>
        <Pressable onPress={() => router.back()} className="items-center rounded-xl bg-lime px-6 py-2.5">
          <Text className="text-sm font-extrabold text-bg">Done</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 p-5" style={{ backgroundColor: c.bg }}>
      <Text className="mb-1.5 text-lg" style={{ color: c.text }}>Suggestions & feedback</Text>
      <Text className="mb-4 text-sm" style={{ color: c.muted }}>Bug you hit, feature you wish existed, anything at all — goes straight to us.</Text>
      <TextInput
        autoFocus
        multiline
        value={message}
        onChangeText={setMessage}
        placeholder="What's on your mind?"
        placeholderTextColor={c.muted}
        textAlignVertical="top"
        className="mb-4 min-h-[140px] rounded-xl border px-3 py-2.5 text-sm"
        style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
      />
      {error ? <Text className="mb-3 text-sm" style={{ color: c.red }}>{error}</Text> : null}
      <Pressable
        onPress={handleSend}
        disabled={sending || !message.trim()}
        className="flex-row items-center justify-center gap-2 rounded-xl bg-lime py-2.5"
        style={{ opacity: sending || !message.trim() ? 0.6 : 1 }}
      >
        {sending && <ActivityIndicator color="#0e0f11" />}
        <Text className="text-sm font-extrabold text-bg">{sending ? 'Sending…' : 'Send'}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  )
}
