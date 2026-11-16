import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { escapeFilterValue } from '@/lib/security'

const SEG_FIELDS = ['tags', 'name', 'phone', 'opted_out', 'is_blocked']
function cleanConditions(raw: unknown): Array<{ field: string; operator: string; value: string }> | null {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw) || raw.length > 20) return null
  const out: Array<{ field: string; operator: string; value: string }> = []
  for (const c of raw) {
    if (!c || typeof c !== 'object' || !SEG_FIELDS.includes((c as any).field)) return null
    out.push({ field: String((c as any).field), operator: String((c as any).operator || '').slice(0, 20), value: String((c as any).value ?? '').slice(0, 100) })
  }
  return out
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
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

async function countSegmentContacts(userId: string, conditions: Array<{ field: string; operator: string; value: string }>, operator: string): Promise<number> {
  const db = supabaseAdmin()
  let query = db.from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', userId)

  for (const cond of conditions) {
    if (cond.field === 'tags' && cond.operator === 'contains') {
      query = query.contains('tags', [cond.value])
    } else if (cond.field === 'name' && cond.operator === 'contains') {
      query = query.ilike('name', `%${escapeFilterValue(cond.value)}%`)
    } else if (cond.field === 'phone' && cond.operator === 'starts_with') {
      query = query.like('phone', `${escapeFilterValue(cond.value)}%`)
    } else if (cond.field === 'opted_out') {
      query = query.eq('opted_out', cond.value === 'true')
    }
  }

  const { count } = await query
  return count || 0
}
