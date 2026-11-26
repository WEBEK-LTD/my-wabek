import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { AppleIapError, applyAppleTransaction, verifyAppleJws, type AppleTransaction } from '@/lib/apple-iap'

/**
 * POST { jws } — a StoreKit 2 signed transaction from the iOS app (purchase or restore).
 * Verifies Apple's signature and activates the plan on the caller's account.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  if (user.actualUserId) return res.status(403).json({ error: 'Only the account owner can manage the plan', code: 'owner_only' })

  const jws = (req.body || {}).jws
  try {
    const tx = await verifyAppleJws<AppleTransaction>(String(jws || ''))
    const result = await applyAppleTransaction(supabaseAdmin(), tx, { userId: user.userId })
    return res.status(200).json({
      ok: true,
      plan_id: result?.planId || null,
      expires_at: tx.expiresDate ? new Date(tx.expiresDate).toISOString() : null,
      environment: tx.environment || null,
    })
  } catch (e) {
    if (e instanceof AppleIapError) return res.status(e.status).json({ error: e.message, code: 'iap_rejected' })
    console.error('[iap verify] failed:', e instanceof Error ? e.message : e)
    return res.status(400).json({ error: 'Could not verify the purchase', code: 'iap_rejected' })
  }
}
