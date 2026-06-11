import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data: resellerPlans } = await db.from('reseller_plans').select('*, base_plan:base_plan_id(*)').eq('reseller_id', user.userId)
    const { data: basePlans } = await db.from('plans').select('*').eq('is_active', true).order('sort_order')
    return res.status(200).json({ plans: resellerPlans || [], basePlans: basePlans || [] })
  }

  if (req.method === 'POST') {
    const { base_plan_id, custom_name, custom_price_monthly, custom_price_yearly, currency } = req.body
    if (!base_plan_id || !custom_price_monthly) return res.status(400).json({ error: 'base_plan_id and custom_price_monthly required' })

    const { data, error } = await db.from('reseller_plans').upsert({
      id: uuidv4(),
      reseller_id: user.userId,
      base_plan_id, custom_name, custom_price_monthly,
      custom_price_yearly: custom_price_yearly || null,
      currency: currency || 'USD',
    }, { onConflict: 'reseller_id,base_plan_id' }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ plan: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
