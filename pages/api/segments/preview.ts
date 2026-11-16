import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { escapeFilterValue } from '@/lib/security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const conditions = Array.isArray(req.body?.conditions) ? req.body.conditions.slice(0, 20) : []
  let query = db.from('contacts').select('id, name, phone, tags', { count: 'exact' }).eq('user_id', user.userId).limit(10)

  for (const cond of conditions) {
    if (cond.field === 'tags' && cond.operator === 'contains' && cond.value) {
      query = query.contains('tags', [String(cond.value).slice(0, 100)])
    } else if (cond.field === 'name' && cond.operator === 'contains' && cond.value) {
      query = query.ilike('name', `%${escapeFilterValue(cond.value)}%`)
    } else if (cond.field === 'phone' && cond.operator === 'starts_with' && cond.value) {
      query = query.like('phone', `${escapeFilterValue(cond.value)}%`)
    } else if (cond.field === 'opted_out') {
      query = query.eq('opted_out', cond.value === 'true')
    } else if (cond.field === 'is_blocked') {
      query = query.eq('is_blocked', cond.value === 'true')
    }
  }

  const { data, count } = await query
  return res.status(200).json({ contacts: data || [], count: count || 0 })
}
