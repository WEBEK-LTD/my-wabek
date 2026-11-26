import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { APPLE_BUNDLE_ID, AppleIapError, applyAppleTransaction, verifyAppleJws, type AppleTransaction } from '@/lib/apple-iap'

/**
 * App Store Server Notifications V2 (renewals, expirations, refunds, trial
 * conversions). Set this URL for Production and Sandbox in App Store Connect →
 * App Information → App Store Server Notifications. The payload is Apple-signed.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const n = await verifyAppleJws<{
      notificationType: string; subtype?: string; notificationUUID?: string
      data?: { bundleId?: string; environment?: string; signedTransactionInfo?: string; signedRenewalInfo?: string }
    }>(String((req.body || {}).signedPayload || ''))
    if (n.notificationType === 'TEST') return res.status(200).json({ ok: true })
    if (n.data?.bundleId && n.data.bundleId !== APPLE_BUNDLE_ID) return res.status(200).json({ ignored: 'other app' })
    if (!n.data?.signedTransactionInfo) return res.status(200).json({ ignored: n.notificationType })

    const tx = await verifyAppleJws<AppleTransaction>(n.data.signedTransactionInfo)
    let autoRenew: boolean | null = null
    if (n.data.signedRenewalInfo) {
      const r = await verifyAppleJws<{ autoRenewStatus?: number }>(n.data.signedRenewalInfo)
      autoRenew = r.autoRenewStatus === undefined ? null : r.autoRenewStatus === 1
    }
    await applyAppleTransaction(supabaseAdmin(), tx, { autoRenew })
    console.log(`[apple-notifications] ${n.notificationType}${n.subtype ? '/' + n.subtype : ''} ${tx.productId} applied`)
    return res.status(200).json({ ok: true })
  } catch (e) {
    if (e instanceof AppleIapError && e.status === 404) {
      // Not linked to an account (e.g. a purchase never verified by the app) — nothing to update.
      return res.status(200).json({ ignored: e.message })
    }
    console.error('[apple-notifications] failed:', e instanceof Error ? e.message : e)
    // Non-2xx makes Apple retry (bad signature stays 400 — Apple stops after retries).
    return res.status(e instanceof AppleIapError ? 400 : 500).json({ error: 'Could not process notification' })
  }
}
