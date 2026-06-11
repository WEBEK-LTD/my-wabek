import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

function generateCode(name: string): string {
  const prefix = name.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${suffix}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('reseller_invites').select('*, reseller_plan:reseller_plan_id(custom_name, custom_price_monthly, base_plan:base_plan_id(name))').eq('reseller_id', user.userId).order('created_at', { ascending: false })
    return res.status(200).json({ invites: data || [] })
  }

  if (req.method === 'POST') {
    const { reseller_plan_id, label, trial_days, discount_pct, max_uses, expires_at, custom_code } = req.body

    // Get user name for code generation
    const { data: userData } = await db.from('users').select('name').eq('id', user.userId).single()
    const code = custom_code?.toUpperCase() || generateCode(userData?.name || 'USER')

    // Check code uniqueness
    const { data: existing } = await db.from('reseller_invites').select('id').eq('code', code).single()
    if (existing) return res.status(409).json({ error: 'Code already exists, try another' })

    const { data, error } = await db.from('reseller_invites').insert({
      id: uuidv4(),
      reseller_id: user.userId,
      reseller_plan_id: reseller_plan_id || null,
      code, label,
      trial_days: trial_days || 0,
      discount_pct: discount_pct || 0,
      max_uses: max_uses || null,
      expires_at: expires_at || null,
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    return res.status(201).json({ invite: data, url: `${appUrl}/auth/register?code=${code}` })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
