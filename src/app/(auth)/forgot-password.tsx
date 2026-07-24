import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/components/Text'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Field } from '../../components/Field'
import { forgotPassword } from '../../lib/client'
import { useThemeColors } from '../../lib/themeColors'

/** Requests a reset email — always shows the same notice regardless of whether the account exists (no email enumeration). */
export default function ForgotPasswordScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function handleSubmit() {
    setBusy(true)
    try {
      await forgotPassword(email.trim().toLowerCase())
    } finally {
      setNotice('If that email has an account, a reset link is on its way.')
      setBusy(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-bg">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6 py-8">
        <View className="w-full max-w-sm self-center">
          <Text className="mb-1 text-lg font-semibold" style={{ color: c.text }}>Reset your password</Text>
          <Text className="mb-4 text-sm" style={{ color: c.muted }}>Enter your account email and we'll send a reset link.</Text>

          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoComplete="email" keyboardType="email-address" autoCapitalize="none" />

          {notice ? <Text className="mb-3 text-sm text-lime">{notice}</Text> : null}

          <Pressable onPress={handleSubmit} disabled={busy} className="w-full rounded-xl bg-lime py-3" style={{ opacity: busy ? 0.6 : 1 }}>
            <Text className="text-center text-sm font-extrabold text-bg">{busy ? 'Sending…' : 'Send reset link'}</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} className="mt-3">
            <Text className="text-center text-sm font-semibold underline" style={{ color: c.muted }}>Back to log in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
