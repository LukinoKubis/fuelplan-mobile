import { Redirect, Stack } from 'expo-router'
import { useAccount } from '../../state/AccountContext'

export default function AuthLayout() {
  const { isAuthed } = useAccount()

  if (isAuthed) return <Redirect href="/(tabs)/fuel" />

  return <Stack screenOptions={{ headerShown: false }} />
}
