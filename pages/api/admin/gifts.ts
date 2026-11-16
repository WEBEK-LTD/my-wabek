import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { randomCode } from '@/lib/security'
import { logAction, getClientIp } from '@/lib/middleware'

const MAX_DURATION_DAYS = 365
const MAX_QUANTITY = 50
const CREDIT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // invite_credits are per ~month

function generateGiftCode(): string {
  return `GIFT-${randomCode(4)}-${randomCode(4)}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const isAdmin = user.role === 'admin'

  if (req.method === 'GET') {
    // Admin gets all, users get their own
    const query = isAdmin
      ? db.from('gift_invites').select('*, plan:plan_id(name), used_by_user:used_by(name, email)').order('created_at', { ascending: false })
      : db.from('gift_invites').select('id, code, plan_id, duration_days, note, is_used, used_at, expires_at, created_at, plan:plan_id(name)').eq('created_by', user.userId).order('created_at', { ascending: false })

    const { data } = await query
    return res.status(200).json({ gifts: data || [] })
  }

  if (req.method === 'POST') {
    const { plan_id, note, expires_at } = req.body || {}
    const durationDays = parseInt(String(req.body?.duration_days), 10)
    let quantity = parseInt(String(req.body?.quantity ?? 1), 10)
    const price = parseFloat(req.body?.price) || 0

    if (typeof plan_id !== 'string' || !plan_id) return res.status(400).json({ error: 'plan_id and duration_days required' })
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > MAX_DURATION_DAYS) {
      return res.status(400).json({ error: `duration_days must be between 1 and ${MAX_DURATION_DAYS}` })
    }
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1
    if (quantity > MAX_QUANTITY) return res.status(400).json({ error: `quantity must be at most ${MAX_QUANTITY}` })
    let expiresAt: string | null = null
    if (expires_at) {
      const d = new Date(expires_at)
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid expires_at' })
      expiresAt = d.toISOString()
    }

    const { data: plan } = await db.from('plans').select('id').eq('id', plan_id).maybeSingle()
    if (!plan) return res.status(404).json({ error: 'Plan not found' })

    // Non-admins: only users whose own plan allows gift invites, only for their
    // own plan, within their monthly invite_credits.
    let creditLimit = 0
    if (!isAdmin) {
      const { data: me } = await db.from('users')
        .select('plan_id, plan_expires_at, plans(allow_gift_invites, invite_credits)')
        .eq('id', user.userId).single()
      const myPlan = me?.plans as unknown as { allow_gift_invites?: boolean; invite_credits?: number } | null
      const planActive = !!me?.plan_id && (!me.plan_expires_at || new Date(me.plan_expires_at) > new Date())
      creditLimit = Number(myPlan?.invite_credits || 0)
      if (!planActive || !myPlan?.allow_gift_invites || creditLimit <= 0) {
        return res.status(403).json({ error: 'Your plan does not include gift invites' })
      }
      if (me!.plan_id !== plan_id) return res.status(403).json({ error: 'You can only gift your own plan' })
      if (durationDays > 30) return res.status(400).json({ error: 'duration_days must be at most 30' })
      const used = await countRecentGifts(db, user.userId)
      if (used + quantity > creditLimit) {
        return res.status(403).json({ error: `Not enough invite credits (${Math.max(0, creditLimit - used)} left this month)` })
      }
    }

    const gifts = []
    for (let i = 0; i < quantity; i++) {
      gifts.push({
        created_by: user.userId,
        plan_id,
        code: generateGiftCode(),
        duration_days: durationDays,
        price: isAdmin ? price : 0,
        note: typeof note === 'string' ? note.slice(0, 500) : null,
        expires_at: expiresAt,
      })
    }

    const { data, error } = await db.from('gift_invites').insert(gifts).select()
    if (error) {
      console.error('[gifts] insert failed:', error.message)
      return res.status(500).json({ error: 'Failed to create gift codes' })
    }

    // Concurrency guard for non-admins: if parallel requests overshot the
    // credit limit, roll back this batch.
    if (!isAdmin && (await countRecentGifts(db, user.userId)) > creditLimit) {
      await db.from('gift_invites').delete().in('id', (data || []).map(g => g.id))
      return res.status(403).json({ error: 'Not enough invite credits' })
    }

    await logAction({
      userId: user.userId, action: 'gift_codes_created', resource: 'gift_invite',
      details: { plan_id, duration_days: durationDays, quantity, admin: isAdmin },
      ipAddress: getClientIp(req),
    })
    return res.status(201).json({ gifts: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function countRecentGifts(db: ReturnType<typeof supabaseAdmin>, userId: string): Promise<number> {
  const since = new Date(Date.now() - CREDIT_WINDOW_MS).toISOString()
  const { count } = await db.from('gift_invites')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId).gte('created_at', since)
  return count || 0
}
