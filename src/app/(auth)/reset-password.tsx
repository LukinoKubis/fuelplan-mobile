import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/components/Text'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Field } from '../../components/Field'
import { resetPassword } from '../../lib/client'
import { useThemeColors } from '../../lib/themeColors'

// Reached via the deep link in the forgot-password email:
// fuelplanmobile://reset-password?token=TOKEN (scheme set in app.json).
export default function ResetPasswordScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const { token } = useLocalSearchParams<{ token?: string }>()
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleSubmit() {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await resetPassword(token, newPassword)
      setNotice('Password updated — you can log in now.')
      setTimeout(() => router.replace('/(auth)/login'), 1200)
    } catch (err) {
      setError((err as Error).message || 'That reset link is invalid or has expired.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-bg">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6 py-8">
        <View className="w-full max-w-sm self-center">
          <Text className="mb-1 text-lg font-semibold" style={{ color: c.text }}>Set a new password</Text>
          <Text className="mb-4 text-sm" style={{ color: c.muted }}>Choose a new password for your account.</Text>

          <Field
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? <Text className="mb-3 text-sm text-red">{error}</Text> : null}
          {notice ? <Text className="mb-3 text-sm text-lime">{notice}</Text> : null}

          <Pressable onPress={handleSubmit} disabled={busy || !token} className="w-full rounded-xl bg-lime py-3" style={{ opacity: busy || !token ? 0.6 : 1 }}>
            <Text className="text-center text-sm font-extrabold text-bg">{busy ? 'Saving…' : 'Save new password'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
