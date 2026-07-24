// Client-side push registration. This project is now linked to EAS (see
// app.json's extra.eas.projectId), so getExpoPushTokenAsync() can resolve
// a real token — but delivery still needs FCM v1 credentials uploaded to
// EAS for Android and an APNs push key for iOS (needs Apple Developer
// Program enrollment), neither of which exist yet. Every function here
// fails soft (returns null/false, never throws) so the app works fine
// with push simply unavailable until that infra is in place.
// This is the native implementation — see pushNotifications.web.ts for why
// a separate web file exists (expo-notifications has no web build at all).
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { API_BASE, getToken } from './client'

/**
 * Requests notification permission (and sets up the default Android
 * channel) then resolves an Expo push token, or null if permission was
 * denied, this isn't a real device, or the token request itself fails
 * (e.g. missing delivery credentials).
 */
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

/** Registers a push token with the backend for the signed-in user. */
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

/** Removes a push token from the backend (Settings' toggle-off path). */
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
