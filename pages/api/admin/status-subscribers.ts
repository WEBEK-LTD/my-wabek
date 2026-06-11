import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  const { data, count } = await db.from('status_subscribers').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  return res.status(200).json({ subscribers: data || [], count: count || 0 })
}
