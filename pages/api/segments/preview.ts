import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { cleanSegmentConditions, applySegmentConditions } from '@/lib/segments'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const conditions = cleanSegmentConditions(Array.isArray(req.body?.conditions) ? req.body.conditions.slice(0, 20) : [])
  if (!conditions) return res.status(400).json({ error: 'Invalid conditions' })
  const operator = req.body?.operator === 'OR' ? 'OR' : 'AND'
  const query = applySegmentConditions(
    db.from('contacts').select('id, name, phone, tags', { count: 'exact' }).eq('user_id', user.userId).limit(10),
    conditions, operator)

  const { data, count } = await query
  return res.status(200).json({ contacts: data || [], count: count || 0 })
}
