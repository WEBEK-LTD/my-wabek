import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { cleanSegmentConditions, countSegmentContacts } from '@/lib/segments'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'segments')
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'PUT') {
    const { name, description, conditions, operator } = req.body || {}
    if (name !== undefined && (typeof name !== 'string' || !name || name.length > 200)) return res.status(400).json({ error: 'Invalid name' })
    if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > 1000)) return res.status(400).json({ error: 'Invalid description' })
    const cleaned = conditions === undefined ? undefined : cleanSegmentConditions(conditions)
    if (cleaned === null) return res.status(400).json({ error: 'Invalid conditions' })
    if (operator !== undefined && !['AND', 'OR'].includes(operator)) return res.status(400).json({ error: 'Invalid operator' })
    const update: Record<string, unknown> = { name, description, conditions: cleaned, operator, updated_at: new Date().toISOString() }
    if (cleaned !== undefined || operator !== undefined) {
      const { data: current } = await db.from('contact_segments').select('conditions, operator').eq('id', id as string).eq('user_id', user.userId).maybeSingle()
      if (current) update.contact_count = await countSegmentContacts(user.userId, cleaned ?? (current.conditions || []), operator ?? current.operator ?? 'AND')
    }
    const { data, error } = await db.from('contact_segments').update(update).eq('id', id as string).eq('user_id', user.userId).select().single()
    if (error) {
      console.error('[segments] db error:', error.message)
      return res.status(500).json({ error: 'Failed to update segment' })
    }
    return res.status(200).json({ segment: data })
  }

  if (req.method === 'DELETE') {
    await db.from('contact_segments').delete().eq('id', id as string).eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
