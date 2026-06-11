import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { status = 'open', assigned_to, page = '1', search } = req.query
    const limit = 30
    const offset = (parseInt(page as string) - 1) * limit

    let query = db.from('conversation_assignments')
      .select(`
        *,
        contacts(id, name, phone, tags),
        assigned_user:assigned_to(id, name, email)
      `, { count: 'exact' })
      .eq('owner_id', user.userId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (status !== 'all') query = query.eq('status', status as string)
    if (assigned_to) query = query.eq('assigned_to', assigned_to as string)

    const { data, error, count } = await query
    if (error) return res.status(500).json({ error: error.message })

    // Get last message for each conversation
    const contactIds = (data || []).map(c => c.contact_id)
    let lastMessages: Record<string, unknown> = {}
    if (contactIds.length > 0) {
      const { data: msgs } = await db.from('messages')
        .select('contact_id, content, direction, created_at, type')
        .eq('user_id', user.userId)
        .in('contact_id', contactIds)
        .order('created_at', { ascending: false })

      // Get last message per contact
      for (const msg of msgs || []) {
        if (!lastMessages[msg.contact_id as string]) {
          lastMessages[msg.contact_id as string] = msg
        }
      }
    }

    const conversations = (data || []).map(conv => ({
      ...conv,
      last_message: lastMessages[conv.contact_id] || null,
    }))

    return res.status(200).json({ conversations, total: count, page: parseInt(page as string) })
  }

  if (req.method === 'POST') {
    const { contact_id, assigned_to, status, priority, tags, notes } = req.body
    if (!contact_id) return res.status(400).json({ error: 'contact_id required' })

    const { data, error } = await db.from('conversation_assignments').upsert({
      id: uuidv4(),
      owner_id: user.userId,
      contact_id,
      assigned_to: assigned_to || null,
      status: status || 'open',
      priority: priority || 'normal',
      tags: tags || [],
      notes: notes || null,
      last_message_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,contact_id' }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ conversation: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
