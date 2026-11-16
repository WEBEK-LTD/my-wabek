import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const { error: tableCheck } = await db.from('support_tickets').select('id').limit(1)
  if (tableCheck?.message?.includes('relation') || tableCheck?.message?.includes('schema cache')) {
    return res.status(503).json({ error: 'Run migration 012_support_tickets.sql first' })
  }

  if (req.method === 'GET') {
    const { ticket_id } = req.query
    const { data: ticket } = await db
      .from('support_tickets').select('id')
      .eq('id', ticket_id).eq('user_id', user.userId).maybeSingle()
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    // Get support messages
    const { data: msgs } = await db
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticket_id)
      .order('created_at')

    if (!msgs?.length) return res.status(200).json({ messages: [] })

    // Enrich admin messages with real WA status from messages table
    const waIds = msgs.filter(m => m.wa_message_id).map(m => m.wa_message_id)
    let waStatusMap: Record<string, string> = {}

    if (waIds.length > 0) {
      const { data: waMessages } = await db
        .from('messages')
        .select('wa_message_id, status')
        .in('wa_message_id', waIds)

      waMessages?.forEach(m => {
        waStatusMap[m.wa_message_id] = m.status
      })
    }

    // Merge status into support_messages
    const enriched = msgs.map(m => ({
      ...m,
      wa_status: m.wa_message_id ? (waStatusMap[m.wa_message_id] || 'pending') : null,
    }))

    return res.status(200).json({ messages: enriched })
  }

  if (req.method === 'POST') {
    const { ticket_id, content } = req.body || {}
    if (!ticket_id || !content || typeof content !== 'string') return res.status(400).json({ error: 'ticket_id and content required' })
    if (content.length > 10000) return res.status(400).json({ error: 'Message too long' })
    const { data: ticket } = await db
      .from('support_tickets').select('id')
      .eq('id', ticket_id).eq('user_id', user.userId).maybeSingle()
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const { data: msg, error } = await db.from('support_messages').insert({
      ticket_id, sender_type: 'user', sender_id: user.userId, content,
    }).select().single()
    if (error) {
      console.error('[support/messages] insert error:', error.message)
      return res.status(500).json({ error: 'Failed to send message' })
    }

    await db.from('support_tickets').update({
      status: 'open', updated_at: new Date().toISOString()
    }).eq('id', ticket_id)

    return res.status(200).json({ message: msg })
  }

  return res.status(405).end()
}
