import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('contact_segments').select('*').eq('user_id', user.userId).order('created_at', { ascending: false })
    return res.status(200).json({ segments: data || [] })
  }

  if (req.method === 'POST') {
    const { name, description, conditions, operator } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })

    // Count matching contacts
    const count = await countSegmentContacts(user.userId, conditions || [], operator || 'AND')

    const { data, error } = await db.from('contact_segments').insert({
      id: uuidv4(), user_id: user.userId, name, description,
      conditions: conditions || [], operator: operator || 'AND',
      contact_count: count,
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
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
      query = query.ilike('name', `%${cond.value}%`)
    } else if (cond.field === 'phone' && cond.operator === 'starts_with') {
      query = query.like('phone', `${cond.value}%`)
    } else if (cond.field === 'opted_out') {
      query = query.eq('opted_out', cond.value === 'true')
    }
  }

  const { count } = await query
  return count || 0
}
