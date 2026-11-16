import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { escapeFilterValue } from '@/lib/security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { page = '1', limit = '20', search } = req.query
    const pageNum  = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20))
    const offset   = (pageNum - 1) * limitNum

    let query = db.from('users')
      .select('id, email, name, role, plan_id, plan_expires_at, is_active, created_at, referred_by, plans(id, name, price_monthly)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)

    // Escape PostgREST filter syntax; stripped chars become wildcards so
    // "john.doe@x.com" still matches.
    const term = escapeFilterValue(search).replace(/\s+/g, '%')
    if (term) query = query.or(`email.ilike.%${term}%,name.ilike.%${term}%`)

    const { data, error, count } = await query
    if (error) {
      console.error('[admin users] list failed:', error.message)
      return res.status(500).json({ error: 'Failed to load users' })
    }
    return res.status(200).json({ users: data || [], total: count || 0, page: pageNum })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
