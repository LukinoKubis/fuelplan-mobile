// Web build of purchases.ts — react-native-purchases is a native module
// with no real web support (same shape as expo-notifications, see
// pushNotifications.web.ts's comment for the general pattern this
// follows). Metro prefers this .web.ts file over the bare .ts when
// bundling for web, so the native package is never even imported there.
// Native IAP has no web equivalent anyway (Apple/Google's rules only bind
// their own app stores) — app.fuelplan.fit keeps using LemonSqueezy
// regardless of how this native module evolves.
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases'

export const CREDIT_PRODUCT_IDS = {
  '5': 'fuelplan_credits_5',
  '10': 'fuelplan_credits_10',
  '20': 'fuelplan_credits_20',
} as const

export async function configurePurchases(_userId: string): Promise<void> {}

export function isPurchasesConfigured(): boolean {
  return false
}

export async function getCreditPackages(): Promise<PurchasesPackage[]> {
  return []
}

export async function purchaseCreditPackage(_pkg: PurchasesPackage): Promise<CustomerInfo> {
  throw new Error('In-app purchases are not available on web — use Top Up Plans instead.')
}

export async function restorePurchases(): Promise<CustomerInfo> {
  throw new Error('In-app purchases are not available on web.')
}
