import { Redirect, Stack } from 'expo-router'
import { useAccount } from '../../state/AccountContext'

/** Auth stack (login/signup/forgot/reset) — bounces to the tabs if already signed in. */
export default function AuthLayout() {
  const { isAuthed } = useAccount()

  if (isAuthed) return <Redirect href="/(tabs)/fuel" />

  return <Stack screenOptions={{ headerShown: false }} />
}
