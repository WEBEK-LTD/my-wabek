import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  const { search, page = '1' } = req.query
  const pageNum = parseInt(page as string)
  const limit = 50
  const offset = (pageNum - 1) * limit

  let query = db.from('system_logs').select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) query = query.ilike('action', `%${search}%`)

  const { data, error, count } = await query
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ logs: data, total: count, page: pageNum })
}
