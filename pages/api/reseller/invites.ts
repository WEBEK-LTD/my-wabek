import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { randomCode } from '@/lib/security'
import { v4 as uuidv4 } from 'uuid'

const MAX_TRIAL_DAYS = 30

function generateCode(name: string): string {
  const prefix = name.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X').padEnd(4, 'X')
  return `${prefix}-${randomCode(6)}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireOwnerOrRole(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('reseller_invites').select('*, reseller_plan:reseller_plan_id(custom_name, custom_price_monthly, base_plan:base_plan_id(name))').eq('reseller_id', user.userId).order('created_at', { ascending: false })
    return res.status(200).json({ invites: data || [] })
  }

  if (req.method === 'POST') {
    const { data: profile } = await db.from('reseller_profiles').select('is_approved').eq('user_id', user.userId).maybeSingle()
    if (!profile?.is_approved) return res.status(403).json({ error: 'Your reseller account has not been approved yet' })

    const { reseller_plan_id, label, trial_days, discount_pct, max_uses, expires_at, custom_code } = req.body || {}

    // The plan (if any) must be one of the caller's own, active reseller plans.
    if (reseller_plan_id) {
      if (typeof reseller_plan_id !== 'string') return res.status(400).json({ error: 'Invalid plan' })
      const { data: rp } = await db.from('reseller_plans').select('id, is_active')
        .eq('id', reseller_plan_id).eq('reseller_id', user.userId).maybeSingle()
      if (!rp || rp.is_active === false) return res.status(400).json({ error: 'Plan not found' })
    }

    const trial = parseInt(String(trial_days ?? 0), 10)
    if (!Number.isFinite(trial) || trial < 0 || trial > MAX_TRIAL_DAYS) {
      return res.status(400).json({ error: `trial_days must be between 0 and ${MAX_TRIAL_DAYS}` })
    }
    const discount = parseFloat(String(discount_pct ?? 0))
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) return res.status(400).json({ error: 'Invalid discount' })
    const maxUses = max_uses === undefined || max_uses === null || max_uses === '' ? null : parseInt(String(max_uses), 10)
    if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 1_000_000)) return res.status(400).json({ error: 'Invalid max_uses' })
    let expiresAt: string | null = null
    if (expires_at) {
      const d = new Date(expires_at)
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid expires_at' })
      expiresAt = d.toISOString()
    }
    if (label !== undefined && label !== null && (typeof label !== 'string' || label.length > 100)) {
      return res.status(400).json({ error: 'Invalid label' })
    }

    let code: string
    if (custom_code) {
      if (typeof custom_code !== 'string' || !/^[A-Za-z0-9-]{4,32}$/.test(custom_code)) {
        return res.status(400).json({ error: 'Code must be 4-32 letters, digits or dashes' })
      }
      code = custom_code.toUpperCase()
    } else {
      const { data: userData } = await db.from('users').select('name').eq('id', user.userId).maybeSingle()
      code = generateCode(userData?.name || 'USER')
    }

    const { data: existing } = await db.from('reseller_invites').select('id').eq('code', code).maybeSingle()
    if (existing) return res.status(409).json({ error: 'Code already exists, try another' })

    const { data, error } = await db.from('reseller_invites').insert({
      id: uuidv4(),
      reseller_id: user.userId,
      reseller_plan_id: reseller_plan_id || null,
      code,
      label: label || null,
      trial_days: trial,
      discount_pct: discount,
      max_uses: maxUses,
      expires_at: expiresAt,
    }).select().single()

    if (error) {
      console.error('[reseller/invites] insert failed:', error.message)
      return res.status(500).json({ error: 'Could not create invite' })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    return res.status(201).json({ invite: data, url: `${appUrl}/auth/register?code=${encodeURIComponent(code)}` })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
