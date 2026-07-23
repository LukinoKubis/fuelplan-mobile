// Web build of pushNotifications.ts — expo-notifications ships no web
// entry point at all (its package.json `main` doesn't resolve for web,
// unlike most Expo modules which at least have a no-op web stub), so
// importing it unconditionally breaks Metro's web bundle entirely. Metro
// prefers a `.web.ts` file over the bare `.ts` when bundling for web, so
// this file is picked automatically there — native builds still use the
// real pushNotifications.ts. Web isn't a real target for this app in
// production; this only exists so `expo start --web` keeps working as a
// dev-testing channel.
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  return null
}

export async function subscribePush(_token: string): Promise<boolean> {
  return false
}

export async function unsubscribePush(_token: string): Promise<boolean> {
  return false
}
