import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  // ── GET: all resellers ─────────────────────────────────
  if (req.method === 'GET') {
    const { data: resellers } = await db
      .from('reseller_profiles')
      .select('*, user:user_id(id, name, email)')
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
  if (req.method === 'PATCH') {
    const { user_id, is_approved, commission_pct } = req.body
    if (!user_id) return res.status(400).json({ error: 'user_id required' })

    // Upsert so it works even if profile doesn't exist yet
    const { data, error } = await db.from('reseller_profiles').upsert({
      id: uuidv4(),
      user_id,
      is_approved,
      approved_at: is_approved ? new Date().toISOString() : null,
      referral_commission_pct: commission_pct ?? 0,
      payment_method: 'platform',
      payout_schedule: 'monthly',
      balance_pending: 0,
      balance_paid: 0,
      balance_total: 0,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).select().single()

    if (error) return res.status(500).json({ error: error.message })

    if (is_approved) {
      await db.from('notifications').insert({
        user_id,
        type: 'success',
        title: '🎉 Reseller Account Approved!',
        body: 'Your reseller account has been approved. Start creating invite links and earn commissions!',
        link: '/dashboard/reseller',
      })
    }

    return res.status(200).json({ profile: data })
  }

  // ── POST: record payout ────────────────────────────────
  if (req.method === 'POST') {
    const { reseller_id, amount, method, reference, period_start, period_end } = req.body
    if (!reseller_id || !amount) return res.status(400).json({ error: 'reseller_id and amount required' })

    const { data: payout, error } = await db.from('reseller_payouts').insert({
      id: uuidv4(),
      reseller_id,
      amount: parseFloat(amount),
      currency: 'USD',
      method: method || 'bank_transfer',
      reference: reference || null,
      status: 'paid',
      period_start: period_start || null,
      period_end: period_end || null,
      paid_at: new Date().toISOString(),
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })

    // Deduct from pending balance
    const { data: rp } = await db
      .from('reseller_profiles')
      .select('balance_pending, balance_paid')
      .eq('user_id', reseller_id)
      .single()

    if (rp) {
      await db.from('reseller_profiles').update({
        balance_pending: Math.max(0, (rp.balance_pending || 0) - parseFloat(amount)),
        balance_paid:    (rp.balance_paid || 0) + parseFloat(amount),
        updated_at:      new Date().toISOString(),
      }).eq('user_id', reseller_id)
    }

    // Notify reseller
    await db.from('notifications').insert({
      user_id: reseller_id,
      type: 'success',
      title: '💸 Payout Processed!',
      body: `$${parseFloat(amount).toFixed(2)} has been sent via ${method || 'bank transfer'}.`,
      link: '/dashboard/reseller',
    })

    return res.status(201).json({ payout })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
