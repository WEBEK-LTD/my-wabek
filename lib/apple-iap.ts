// Apple In-App Purchase (auto-renewable subscriptions) for the iOS app.
//
// Purchases are StoreKit 2 transactions: JWS signed by Apple. We verify the
// signature ourselves against Apple's certificate chain (no App Store API key
// needed), then write the plan through the same path Stripe uses
// (applySubscriptionState), with the subscription id `apple:<originalTransactionId>`.
//
// Product ids: com.webek.wabek.<plan>.<monthly|yearly>, plan = starter | pro | business
// (matched to plans.name). Every product has a 3-day free trial (set in App Store Connect).
import { X509Certificate, createPublicKey } from 'crypto'
import { compactVerify, decodeProtectedHeader } from 'jose'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applySubscriptionState, type BillingCycle } from './stripe'

export const APPLE_BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'com.webek.wabek'
export const IAP_PLANS = ['starter', 'pro', 'business'] as const
export type IapPlan = (typeof IAP_PLANS)[number]
// Business yearly isn't sold on iPhone: Apple's highest subscription price ($1,000/year)
// is below the website's yearly Business price.
export const IAP_PRODUCT_IDS = IAP_PLANS.flatMap(p => [`${APPLE_BUNDLE_ID}.${p}.monthly`, `${APPLE_BUNDLE_ID}.${p}.yearly`])
  .filter(id => id !== `${APPLE_BUNDLE_ID}.business.yearly`)

// SHA-256 of "Apple Root CA - G3" (https://www.apple.com/certificateauthority/).
const APPLE_ROOT_G3_SHA256 = '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79'
const OID_APPLE_WWDR_INTERMEDIATE = '1.2.840.113635.100.6.2.1'
const OID_APPLE_STOREKIT_LEAF = '1.2.840.113635.100.6.11.1'

export class AppleIapError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

/** Verify an Apple-signed JWS (transaction, renewal info or notification) and return its payload. */
export async function verifyAppleJws<T = Record<string, unknown>>(jws: string): Promise<T> {
  if (typeof jws !== 'string' || jws.split('.').length !== 3 || jws.length > 20000) throw new AppleIapError('Malformed signed data')
  const header = decodeProtectedHeader(jws)
  const x5c = header.x5c
  if (header.alg !== 'ES256' || !Array.isArray(x5c) || x5c.length < 3) throw new AppleIapError('Unexpected signature format')
  const [leaf, intermediate, root] = x5c.slice(0, 3).map(c => new X509Certificate(Buffer.from(c, 'base64')))

  if (root.fingerprint256 !== APPLE_ROOT_G3_SHA256) throw new AppleIapError('Not signed by Apple')
  if (!intermediate.verify(root.publicKey) || !leaf.verify(intermediate.publicKey)) throw new AppleIapError('Broken certificate chain')
  if (!intermediate.checkIssued(root) || !leaf.checkIssued(intermediate)) throw new AppleIapError('Broken certificate chain')
  // Apple's marker extensions on the intermediate and the StoreKit signing certificate.
  if (!certHasExtension(intermediate, OID_APPLE_WWDR_INTERMEDIATE) || !certHasExtension(leaf, OID_APPLE_STOREKIT_LEAF)) throw new AppleIapError('Not a StoreKit certificate')
  const now = Date.now()
  for (const c of [leaf, intermediate, root]) {
    if (new Date(c.validFrom).getTime() > now || new Date(c.validTo).getTime() < now) throw new AppleIapError('Certificate expired')
  }

  const { payload } = await compactVerify(jws, createPublicKey(leaf.publicKey.export({ type: 'spki', format: 'pem' })))
  return JSON.parse(new TextDecoder().decode(payload)) as T
}

/** DER-encode an OID and look for it in the certificate. */
function certHasExtension(cert: X509Certificate, oid: string): boolean {
  const parts = oid.split('.').map(Number)
  const bytes: number[] = [parts[0] * 40 + parts[1]]
  for (const n of parts.slice(2)) {
    const enc: number[] = []
    let v = n
    do { enc.unshift(v & 0x7f); v = Math.floor(v / 128) } while (v > 0)
    for (let i = 0; i < enc.length - 1; i++) enc[i] |= 0x80
    bytes.push(...enc)
  }
  const needle = Buffer.from([0x06, bytes.length, ...bytes])
  return cert.raw.includes(needle)
}

export interface AppleTransaction {
  transactionId: string
  originalTransactionId: string
  bundleId: string
  productId: string
  purchaseDate: number
  expiresDate?: number
  revocationDate?: number
  appAccountToken?: string
  environment?: 'Sandbox' | 'Production' | string
  offerType?: number
  offerDiscountType?: string
  type?: string
}

export function parseProductId(productId: string): { plan: IapPlan; cycle: BillingCycle } | null {
  const m = new RegExp(`^${APPLE_BUNDLE_ID.replace(/\./g, '\\.')}\\.(starter|pro|business)\\.(monthly|yearly)$`).exec(productId || '')
  return m ? { plan: m[1] as IapPlan, cycle: m[2] as BillingCycle } : null
}

type DB = SupabaseClient

async function planIdFor(db: DB, plan: IapPlan): Promise<string | null> {
  const { data } = await db.from('plans').select('id, name, is_active').ilike('name', plan)
  const row = (data || []).find(p => p.is_active !== false) || (data || [])[0]
  return row?.id || null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Write a verified Apple transaction to the account. `userId` is the account
 * that sent it (verify endpoint) or null (server notification → appAccountToken).
 */
export async function applyAppleTransaction(db: DB, tx: AppleTransaction, opts: { userId?: string | null; autoRenew?: boolean | null } = {}) {
  if (tx.bundleId !== APPLE_BUNDLE_ID) throw new AppleIapError('Wrong app')
  const product = parseProductId(tx.productId)
  if (!product) throw new AppleIapError('Unknown product')

  const token = tx.appAccountToken && UUID_RE.test(tx.appAccountToken) ? tx.appAccountToken.toLowerCase() : null
  let userId = opts.userId || token
  if (!userId) {
    // Purchase restored from another device without a token: the account it was first linked to.
    const { data } = await db.from('subscriptions').select('user_id').eq('stripe_subscription_id', `apple:${tx.originalTransactionId}`).limit(1)
    userId = data?.[0]?.user_id || null
  }
  if (!userId) throw new AppleIapError('Purchase is not linked to an account', 404)
  // A purchase made from one WABEK account can't be claimed by another.
  if (opts.userId && token && token !== opts.userId.toLowerCase()) throw new AppleIapError('This purchase belongs to another account', 409)

  const planId = await planIdFor(db, product.plan)
  if (!planId) throw new AppleIapError('Plan not found', 500)

  const now = Date.now()
  const expires = Number(tx.expiresDate || 0)
  const trial = tx.offerType === 1 && (tx.offerDiscountType === 'FREE_TRIAL' || !tx.offerDiscountType)
  const status = tx.revocationDate ? 'cancelled' : expires > now ? (trial ? 'trialing' : 'active') : 'cancelled'

  return applySubscriptionState(db, {
    userId,
    planId,
    sub: {
      id: `apple:${tx.originalTransactionId}`,
      current_period_start: Math.floor(Number(tx.purchaseDate || now) / 1000),
      current_period_end: Math.floor((expires || now) / 1000),
      cancel_at_period_end: opts.autoRenew === false,
    },
    status,
    cycle: product.cycle,
  })
}
