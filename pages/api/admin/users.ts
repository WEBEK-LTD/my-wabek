import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { escapeFilterValue } from '@/lib/security'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
    const pageNum  = Math.max(1, parseInt(one(req.query.page) || '1') || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(one(req.query.limit) || '20') || 20))
    const offset   = (pageNum - 1) * limitNum
    // `q` (preferred) or legacy `search`.
    const search = one(req.query.q) ?? one(req.query.search)
    const planId = one(req.query.plan_id)
    const status = one(req.query.status)
    const role = one(req.query.role)

    if (planId && planId !== 'all' && planId !== 'free' && !UUID.test(planId)) return res.status(400).json({ error: 'Invalid plan_id' })
    if (status && !['all', 'active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' })
    if (role && !['all', 'user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' })
    // deletion=requested → accounts that asked to be deleted from the mobile app (migration 036).
    const deletion = one(req.query.deletion) === 'requested'

    let query = db.from('users')
      .select('id, email, name, role, plan_id, plan_expires_at, is_active, created_at, referred_by, plans(id, name, price_monthly)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)

    // Escape PostgREST filter syntax; stripped chars become wildcards so
    // "john.doe@x.com" still matches.
    const term = escapeFilterValue(search).replace(/\s+/g, '%')
    if (term) query = query.or(`email.ilike.%${term}%,name.ilike.%${term}%`)

    // plan_id=free → no plan.
    if (planId === 'free') query = query.is('plan_id', null)
    else if (planId && planId !== 'all') query = query.eq('plan_id', planId)
    // Accounts with is_active NULL are treated as active (as in getAuthUser).
    // `is_active IS NOT FALSE` — not a second `or=` param next to the search one.
    if (status === 'active') query = query.not('is_active', 'is', false)
    else if (status === 'suspended') query = query.eq('is_active', false)
    if (role === 'admin') query = query.eq('role', 'admin')
    else if (role === 'user') query = query.neq('role', 'admin')
    if (deletion) query = query.not('deletion_requested_at', 'is', null)

    const { data, error, count } = await query
    if (error) {
      if (deletion && /deletion_requested_at/.test(error.message || '')) {
        return res.status(200).json({ users: [], total: 0, page: pageNum, limit: limitNum })
      }
      console.error('[admin users] list failed:', error.message)
      return res.status(500).json({ error: 'Failed to load users' })
    }
    return res.status(200).json({ users: data || [], total: count || 0, page: pageNum, limit: limitNum })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
