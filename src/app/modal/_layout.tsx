import { Stack } from 'expo-router'

export default function ModalLayout() {
  return (
    <Stack screenOptions={{ presentation: 'modal', headerShown: true }}>
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="history" options={{ title: 'My Plans' }} />
      <Stack.Screen name="plan-name" options={{ title: 'Name your plan', presentation: 'formSheet' }} />
    </Stack>
  )
}
