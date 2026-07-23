// Client-side push registration. Requires: (1) this project linked to an
// EAS project (getExpoPushTokenAsync needs a projectId — not set up yet,
// see M6), (2) FCM v1 credentials uploaded to EAS for Android delivery,
// (3) an APNs push key for iOS delivery (needs Apple Developer Program
// enrollment). None of those exist yet — every function here fails soft
// (returns null / false, never throws to the caller) so the app works
// fine with push simply unavailable until that infra is in place.
// This is the native implementation — see pushNotifications.web.ts for why
// a separate web file exists (expo-notifications has no web build at all).
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { API_BASE, getToken } from './client'

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null // push tokens aren't meaningful on simulators/web

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return null

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  if (!projectId) {
    console.warn('[push] no EAS projectId configured — run `eas init` first')
    return null
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId })
    return data
  } catch (e) {
    console.warn('[push] failed to get push token:', (e as Error).message)
    return null
  }
}

export async function subscribePush(token: string): Promise<boolean> {
  try {
    const authToken = await getToken()
    const response = await fetch(`${API_BASE}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ token }),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function unsubscribePush(token: string): Promise<boolean> {
  try {
    const authToken = await getToken()
    const response = await fetch(`${API_BASE}/api/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ token }),
    })
    return response.ok
  } catch {
    return false
  }
}
