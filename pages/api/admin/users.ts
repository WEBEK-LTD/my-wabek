import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { page = '1', limit = '20', search } = req.query
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const offset = (pageNum - 1) * limitNum

    let query = db.from('users').select('id, email, name, role, plan_id, is_active, trial_ends_at, created_at, plans(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)

    if (search) query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)

    const { data, error, count } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ users: data, total: count, page: pageNum })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
