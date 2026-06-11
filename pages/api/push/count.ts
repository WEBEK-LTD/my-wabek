import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const db = supabaseAdmin()
  const { count } = await db
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })

  return res.status(200).json({ count: count || 0 })
}
