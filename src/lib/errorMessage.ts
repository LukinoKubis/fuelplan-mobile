// RN has no reliable `navigator.onLine` the way the web app used it, and no
// PWA service-worker offline fallback to fall back on either — a plain
// fetch failure (device actually offline, DNS failure, etc.) surfaces as
// a raw TypeError whose message ("Network request failed" on native,
// "Failed to fetch" on web) isn't something to show a user directly.
// ApiError (thrown by lib/client.ts for any response the server actually
// returned) already carries a good message — this only needs to catch the
// case where no response came back at all.
export function friendlyErrorMessage(err: unknown, fallback = 'Something went wrong — please try again.'): string {
  if (err instanceof TypeError) {
    return "You're offline — check your connection and try again."
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}
