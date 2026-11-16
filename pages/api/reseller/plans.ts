import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { checkPlanFeature } from '@/lib/middleware'
import { v4 as uuidv4 } from 'uuid'

function money(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireOwnerOrRole(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data: resellerPlans } = await db.from('reseller_plans').select('*, base_plan:base_plan_id(*)').eq('reseller_id', user.userId)
    const { data: basePlans } = await db.from('plans').select('*').eq('is_active', true).order('sort_order')
    return res.status(200).json({ plans: resellerPlans || [], basePlans: basePlans || [] })
  }

  if (req.method === 'POST') {
    // Only approved resellers on a plan that allows reselling.
    const { data: profile } = await db.from('reseller_profiles').select('is_approved').eq('user_id', user.userId).maybeSingle()
    if (!profile?.is_approved) return res.status(403).json({ error: 'Your reseller account has not been approved yet' })
    if (!(await checkPlanFeature(user.userId, 'allow_reseller'))) {
      return res.status(403).json({ error: 'Your plan does not include reselling' })
    }

    const { base_plan_id, custom_name, custom_price_monthly, custom_price_yearly, currency } = req.body || {}
    const priceMonthly = money(custom_price_monthly)
    if (typeof base_plan_id !== 'string' || !base_plan_id || priceMonthly === null || priceMonthly <= 0) {
      return res.status(400).json({ error: 'base_plan_id and custom_price_monthly required' })
    }
    const priceYearly = custom_price_yearly === undefined || custom_price_yearly === null || custom_price_yearly === '' ? null : money(custom_price_yearly)
    if (custom_price_yearly && priceYearly === null) return res.status(400).json({ error: 'Invalid yearly price' })
    if (custom_name !== undefined && custom_name !== null && (typeof custom_name !== 'string' || custom_name.length > 100)) {
      return res.status(400).json({ error: 'Invalid name' })
    }
    const cur = typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : 'USD'

    // The base plan must exist and be active (resellable).
    const { data: basePlan } = await db.from('plans').select('id, is_active').eq('id', base_plan_id).maybeSingle()
    if (!basePlan || basePlan.is_active === false) return res.status(400).json({ error: 'This plan cannot be resold' })

    const { data, error } = await db.from('reseller_plans').upsert({
      id: uuidv4(),
      reseller_id: user.userId,
      base_plan_id: basePlan.id,
      custom_name: custom_name || null,
      custom_price_monthly: priceMonthly,
      custom_price_yearly: priceYearly,
      currency: cur,
    }, { onConflict: 'reseller_id,base_plan_id' }).select().single()

    if (error) {
      console.error('[reseller/plans] upsert failed:', error.message)
      return res.status(500).json({ error: 'Could not save plan' })
    }
    return res.status(201).json({ plan: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
