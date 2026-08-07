// Native in-app purchases via RevenueCat (issue #19) — Apple/Google both
// require native IAP for consumable digital goods like plan credits;
// LemonSqueezy's web checkout (client.ts's createCheckout, still the live
// path everywhere right now) would get the app rejected on store
// submission. This module is a SCAFFOLD: the flow below is real and
// typechecks, but PRODUCT_IDS are placeholders that don't exist in App
// Store Connect / Google Play Console yet (blocked on the same Apple
// Developer Program / Google Play Console enrollment as issue #6) — real
// product creation has to happen there first. Soft-disabled like
// recipePhotoStorage.ts's Supabase config: configurePurchases() is a
// no-op if the platform's API key env var isn't set, so shipping this
// with no keys configured never breaks anything, same as a missing
// Supabase key just keeps recipe photos on the base64 fallback.
import { Platform } from 'react-native'
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases'

// Placeholder product identifiers — pick real ones to match whatever gets
// created in App Store Connect / Play Console (naming convention here
// mirrors LemonSqueezy's '5'/'10'/'20' credit tiers in client.ts's
// createCheckout, kept as consumables not subscriptions since a credit
// top-up is a one-time purchase, not recurring access).
export const CREDIT_PRODUCT_IDS = {
  '5': 'fuelplan_credits_5',
  '10': 'fuelplan_credits_10',
  '20': 'fuelplan_credits_20',
} as const

let configured = false

/**
 * Configures the RevenueCat SDK for the signed-in user, using our own
 * userId as RevenueCat's appUserID (so a purchase's server-side webhook —
 * see claude-backend's /api/webhook/revenuecat — can credit the right
 * account without a separate id-mapping step). No-ops if this platform's
 * API key isn't set, so the app functions identically to today until real
 * keys + products exist.
 */
export async function configurePurchases(userId: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
  if (!apiKey || configured) return
  Purchases.configure({ apiKey, appUserID: userId })
  configured = true
}

/** True once configurePurchases() has run with a real key — gates whether the IAP UI should even render. */
export function isPurchasesConfigured(): boolean {
  return configured
}

/** Fetches the current offering's packages (empty if not configured or no offering exists yet in RevenueCat's dashboard). */
export async function getCreditPackages(): Promise<PurchasesPackage[]> {
  if (!configured) return []
  const offerings = await Purchases.getOfferings()
  return offerings.current?.availablePackages || []
}

/** Purchases a package; caller is responsible for refreshing remaining credits afterward (the actual credit grant happens server-side via the RevenueCat webhook, same as LemonSqueezy's webhook does today — this call itself doesn't touch our backend). */
export async function purchaseCreditPackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg)
  return customerInfo
}

/** Restores prior purchases (App Store/Play Store requirement for any IAP-using app, not optional polish). */
export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases()
}
