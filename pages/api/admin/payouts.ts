import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { logAction, getClientIp } from '@/lib/middleware'

const PAYOUT_METHODS = ['bank_transfer', 'paypal', 'wise', 'crypto', 'stripe', 'other']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  // ── GET: all resellers ─────────────────────────────────
  if (req.method === 'GET') {
    const { data: resellers } = await db
      .from('reseller_profiles')
      .select('id, user_id, payment_method, payout_schedule, payout_method, balance_pending, balance_paid, balance_total, payout_details, referral_commission_pct, is_approved, approved_at, notes, created_at, updated_at, stripe_connect_account_id, user:user_id(id, name, email)')
      .order('created_at', { ascending: false })

    const { data: pendingPayouts } = await db
      .from('reseller_payouts')
      .select('*, reseller:reseller_id(name, email)')
      .eq('status', 'pending')
      .order('created_at')

    return res.status(200).json({
      resellers: resellers || [],
      pendingPayouts: pendingPayouts || [],
    })
  }

  // ── PATCH: approve / reject / update commission ────────
  // Only the fields present in the body change; balances and payment method
  // are never touched here.
  if (req.method === 'PATCH') {
    const { user_id } = req.body || {}
    if (typeof user_id !== 'string' || !user_id) return res.status(400).json({ error: 'user_id required' })

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const hasApproval = typeof req.body.is_approved === 'boolean'
    if (hasApproval) {
      update.is_approved = req.body.is_approved
      update.approved_at = req.body.is_approved ? new Date().toISOString() : null
    }
    if (req.body.commission_pct !== undefined && req.body.commission_pct !== null) {
      const pct = Number(req.body.commission_pct)
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return res.status(400).json({ error: 'commission_pct must be between 0 and 100' })
      update.referral_commission_pct = pct
    }
    if (!hasApproval && update.referral_commission_pct === undefined) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    const { data: target } = await db.from('users').select('id').eq('id', user_id).maybeSingle()
    if (!target) return res.status(404).json({ error: 'User not found' })

    const { data: existing } = await db.from('reseller_profiles').select('id, is_approved').eq('user_id', user_id).maybeSingle()
    let profile: unknown = null
    if (existing) {
      const { data, error } = await db.from('reseller_profiles').update(update).eq('user_id', user_id).select().single()
      if (error) {
        console.error('[payouts] profile update failed:', error.message)
        return res.status(500).json({ error: 'Failed to update reseller' })
      }
      profile = data
    } else {
      // Create the profile only if it is missing (defaults for everything else).
      const { data, error } = await db.from('reseller_profiles').insert({ user_id, ...update }).select().single()
      if (error) {
        if (error.code === '23505') {
          const retry = await db.from('reseller_profiles').update(update).eq('user_id', user_id).select().single()
          profile = retry.data
        } else {
          console.error('[payouts] profile insert failed:', error.message)
          return res.status(500).json({ error: 'Failed to update reseller' })
        }
      } else {
        profile = data
      }
    }

    if (hasApproval && req.body.is_approved && !existing?.is_approved) {
      await db.from('notifications').insert({
        user_id,
        type: 'success',
        title: '🎉 Reseller Account Approved!',
        body: 'Your reseller account has been approved. Start creating invite links and earn commissions!',
        link: '/dashboard/reseller',
      })
    }

    await logAction({
      userId: admin.userId, action: 'admin_update_reseller', resource: 'reseller_profile', resourceId: user_id,
      details: { is_approved: update.is_approved, referral_commission_pct: update.referral_commission_pct },
      ipAddress: getClientIp(req),
    })
    return res.status(200).json({ profile })
  }

  // ── POST: record payout ────────────────────────────────
  if (req.method === 'POST') {
    const { reseller_id, method, reference, period_start, period_end, idempotency_key } = req.body || {}
    const amount = Math.round(Number(req.body?.amount) * 100) / 100
    if (typeof reseller_id !== 'string' || !reseller_id) return res.status(400).json({ error: 'reseller_id and amount required' })
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be greater than 0' })
    const payMethod = typeof method === 'string' && PAYOUT_METHODS.includes(method) ? method : 'bank_transfer'
    const toDate = (v: unknown) => {
      if (!v) return null
      const d = new Date(String(v))
      return isNaN(d.getTime()) ? null : d.toISOString()
    }
    const idemKey = typeof idempotency_key === 'string' && idempotency_key ? idempotency_key.slice(0, 128) : null

    if (idemKey) {
      const { data: prior } = await db.from('reseller_payouts').select('*').eq('idempotency_key', idemKey).maybeSingle()
      if (prior) return res.status(200).json({ payout: prior, duplicate: true })
    }

    const { data: rp } = await db.from('reseller_profiles').select('balance_pending').eq('user_id', reseller_id).maybeSingle()
    if (!rp) return res.status(404).json({ error: 'Reseller not found' })

    // Atomic: decrements balance_pending only if it covers the amount, and
    // inserts the payout row in the same transaction.
    const { data: payoutId, error: rpcErr } = await db.rpc('reseller_record_payout', {
      p_user: reseller_id,
      p_amount: amount,
      p_method: payMethod,
      p_reference: typeof reference === 'string' ? reference.slice(0, 200) : null,
      p_period_start: toDate(period_start),
      p_period_end: toDate(period_end),
      p_idempotency_key: idemKey,
    })

    if (rpcErr) {
      // Concurrent request with the same idempotency key → return that payout.
      if (rpcErr.code === '23505' && idemKey) {
        const { data: prior } = await db.from('reseller_payouts').select('*').eq('idempotency_key', idemKey).maybeSingle()
        if (prior) return res.status(200).json({ payout: prior, duplicate: true })
      }
      console.error('[payouts] reseller_record_payout failed (is migration 028 applied?):', rpcErr.message)
      return res.status(500).json({ error: 'Failed to record payout' })
    }
    if (!payoutId) {
      return res.status(400).json({ error: `Amount exceeds the pending balance ($${Number(rp.balance_pending || 0).toFixed(2)})` })
    }

    const { data: payout } = await db.from('reseller_payouts').select('*').eq('id', payoutId as string).single()

    await db.from('notifications').insert({
      user_id: reseller_id,
      type: 'success',
      title: '💸 Payout Processed!',
      body: `$${amount.toFixed(2)} has been sent via ${payMethod.replace('_', ' ')}.`,
      link: '/dashboard/reseller',
    })

    await logAction({
      userId: admin.userId, action: 'admin_record_payout', resource: 'reseller_payout', resourceId: String(payoutId),
      details: { reseller_id, amount, method: payMethod, idempotency_key: idemKey },
      ipAddress: getClientIp(req),
    })

    return res.status(201).json({ payout })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
