// Apple In-App Purchase (iOS only). Plans are auto-renewable subscriptions with a
// 3-day free trial; every purchase is verified by WABEK's server
// (pages/api/mobile/iap/verify.ts) before the transaction is finished.
import { Platform } from 'react-native'
import { api } from './api'

type IapModule = typeof import('expo-iap')
type Purchase = import('expo-iap').Purchase
export type IapProduct = {
  id: string
  title: string
  displayPrice: string
  freeTrial: boolean
  groupId: string | null
}

// Web preview only: tooling (store screenshots) can inject a fake store as globalThis.__WABEK_IAP_MOCK__.
const webMock = Platform.OS === 'web' ? ((globalThis as { __WABEK_IAP_MOCK__?: unknown }).__WABEK_IAP_MOCK__ as IapModule | undefined) : undefined
export const iapSupported = Platform.OS === 'ios' || !!webMock

let mod: IapModule | null = webMock || null
function iap(): IapModule {
  if (!iapSupported) throw new Error('In-app purchase is only available on iPhone')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (!mod) mod = require('expo-iap') as IapModule
  return mod
}

let connected = false
export async function connect(): Promise<void> {
  if (connected) return
  await iap().initConnection()
  connected = true
}

export async function loadProducts(skus: string[]): Promise<IapProduct[]> {
  await connect()
  const list = ((await iap().fetchProducts({ skus, type: 'subs' })) || []) as unknown as Record<string, unknown>[]
  return list.map(p => {
    const info = p.subscriptionInfoIOS as { subscriptionGroupId?: string } | undefined
    return {
      id: String(p.id),
      title: String(p.title || p.displayName || p.id),
      displayPrice: String(p.displayPrice || ''),
      freeTrial: p.introductoryPricePaymentModeIOS === 'free-trial',
      groupId: info?.subscriptionGroupId || null,
    }
  })
}

/** Whether this Apple ID can still get the free trial in the group. */
export async function trialEligible(groupId: string | null): Promise<boolean> {
  if (!groupId) return true
  try {
    return !!(await iap().isEligibleForIntroOfferIOS(groupId))
  } catch {
    return true
  }
}

/** Sends a purchase to WABEK, then finishes it with Apple. */
async function verifyAndFinish(purchase: Purchase): Promise<void> {
  const jws = purchase.purchaseToken
  if (!jws) throw new Error('Missing purchase data')
  await api('/api/mobile/iap/verify', { method: 'POST', body: { jws } })
  await iap().finishTransaction({ purchase, isConsumable: false })
}

/**
 * Listens for purchase results (also those finished in the background, e.g. after
 * Ask to Buy or an interrupted purchase). Returns an unsubscribe function.
 */
export function listen(onVerified: () => void, onError: (message: string | null) => void): () => void {
  const m = iap()
  const a = m.purchaseUpdatedListener(p => {
    verifyAndFinish(p).then(onVerified).catch(e => onError(e instanceof Error ? e.message : null))
  })
  const b = m.purchaseErrorListener(e => {
    if (String(e.code || '') === 'user-cancelled') return onError(null)
    onError(e.message || null)
  })
  return () => { a.remove(); b.remove() }
}

/** `accountToken` ties the subscription to this WABEK account (Apple's appAccountToken). */
export async function buy(sku: string, accountToken: string): Promise<void> {
  await connect()
  await iap().requestPurchase({
    type: 'subs',
    request: { apple: { sku, appAccountToken: accountToken, andDangerouslyFinishTransactionAutomatically: false } },
  })
}

/** Restore: re-send this Apple ID's subscriptions to WABEK. Returns how many were found. */
export async function restore(skus: string[]): Promise<number> {
  await connect()
  const m = iap()
  await m.restorePurchases()
  const list = ((await m.getAvailablePurchases()) || []) as Purchase[]
  const mine = list.filter(p => skus.includes(p.productId))
  for (const p of mine) await verifyAndFinish(p)
  return mine.length
}

/** Apple's own subscription management sheet (cancel, change plan). */
export async function manage(): Promise<void> {
  await connect()
  await iap().deepLinkToSubscriptions({})
}
