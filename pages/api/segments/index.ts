import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { cleanSegmentConditions as cleanConditions, countSegmentContacts } from '@/lib/segments'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'segments')
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('contact_segments').select('*').eq('user_id', user.userId).order('created_at', { ascending: false })
    return res.status(200).json({ segments: data || [] })
  }

  if (req.method === 'POST') {
    const { name, description } = req.body || {}
    if (!name || typeof name !== 'string' || name.length > 200) return res.status(400).json({ error: 'name required' })
    const conditions = cleanConditions(req.body?.conditions)
    if (!conditions) return res.status(400).json({ error: 'Invalid conditions' })
    const operator = req.body?.operator === 'OR' ? 'OR' : 'AND'

    // Count matching contacts
    const count = await countSegmentContacts(user.userId, conditions, operator)

    const { data, error } = await db.from('contact_segments').insert({
      id: uuidv4(), user_id: user.userId, name,
      description: typeof description === 'string' ? description.slice(0, 1000) : null,
      conditions, operator,
      contact_count: count,
    }).select().single()

    if (error) {
      console.error('[segments] db error:', error.message)
      return res.status(500).json({ error: 'Failed to create segment' })
    }
    return res.status(201).json({ segment: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
