import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path, Rect } from 'react-native-svg'
import { Field } from '../../components/Field'
import { useAccount } from '../../state/AccountContext'

type Mode = 'login' | 'signup'

export default function LoginScreen() {
  const { login, signup } = useAccount()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), password)
      } else {
        await signup(email.trim().toLowerCase(), password)
      }
    } catch (err) {
      setError((err as Error).message || 'Something went wrong — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="flex-1 items-center justify-center px-6 py-8" keyboardShouldPersistTaps="handled">
          <View className="mb-6 items-center">
            <Svg width={44} height={44} viewBox="0 0 48 48" fill="none">
              <Rect width={48} height={48} rx={14} fill="#c8f542" />
              <Path d="M25 7L13 27h12l-4 14 18-22H27L31 7H25z" fill="#0e0f11" />
            </Svg>
            <Text className="mt-3 font-display text-xl tracking-wide text-light-text dark:text-text">FUELPLAN</Text>
          </View>

          <View className="w-full max-w-sm">
            <Text className="mb-1 text-lg font-semibold text-light-text dark:text-text">
              {mode === 'login' ? 'Log in' : 'Create your account'}
            </Text>
            <Text className="mb-4 text-sm text-light-muted dark:text-muted">
              {mode === 'login' ? 'Welcome back.' : 'Free plans to get started — top up any time in Settings.'}
            </Text>

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              secureTextEntry
              autoCapitalize="none"
            />

            {error ? <Text className="mb-3 text-sm text-red">{error}</Text> : null}

            <Pressable
              onPress={handleSubmit}
              disabled={busy}
              className="w-full rounded-xl bg-lime py-3"
              style={{ opacity: busy ? 0.6 : 1 }}
            >
              <Text className="text-center text-sm font-extrabold text-bg">
                {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
              </Text>
            </Pressable>

            <View className="mt-4 flex-row justify-center">
              <Text className="text-sm text-light-muted dark:text-muted">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              </Text>
              <Pressable
                onPress={() => {
                  setMode(mode === 'login' ? 'signup' : 'login')
                  setError('')
                }}
              >
                <Text className="text-sm font-semibold text-lime underline">{mode === 'login' ? 'Sign up' : 'Log in'}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
