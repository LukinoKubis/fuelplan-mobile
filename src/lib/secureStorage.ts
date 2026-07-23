// Keychain/Keystore-backed storage for the JWT specifically — everything
// else lives in AsyncStorage (storage.ts). Same loadString/saveString/remove
// shape so AccountContext's persistence calls read the same either way.
//
// expo-secure-store's web implementation is a no-op stub (there's no
// Keychain/Keystore equivalent in a browser) — it silently does nothing on
// web, which otherwise looks like a token that never persists. Web is not a
// real target for this app (native iOS/Android only, via EAS), but it's the
// only target this dev environment can smoke-test against, so fall back to
// AsyncStorage there. Production/native always uses real SecureStore.
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const TOKEN_KEY = 'fp_token'
const isWeb = Platform.OS === 'web'

export async function loadToken(): Promise<string | null> {
  try {
    return isWeb ? await AsyncStorage.getItem(TOKEN_KEY) : await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    return null
  }
}

export async function saveToken(value: string): Promise<void> {
  try {
    if (isWeb) await AsyncStorage.setItem(TOKEN_KEY, value)
    else await SecureStore.setItemAsync(TOKEN_KEY, value)
  } catch {
    /* ignore */
  }
}

export async function removeToken(): Promise<void> {
  try {
    if (isWeb) await AsyncStorage.removeItem(TOKEN_KEY)
    else await SecureStore.deleteItemAsync(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}
