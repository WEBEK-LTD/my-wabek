import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { ticket_id } = req.query
    if (!ticket_id) return res.status(400).json({ error: 'ticket_id required' })

    const { data: msgs } = await db
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticket_id)
      .order('created_at')

    if (!msgs?.length) return res.status(200).json({ messages: [] })

    // Enrich with WA status
    const waIds = msgs.filter(m => m.wa_message_id).map(m => m.wa_message_id)
    let waStatusMap: Record<string, string> = {}

    if (waIds.length > 0) {
      const { data: waMessages } = await db
        .from('messages')
        .select('wa_message_id, status')
        .in('wa_message_id', waIds)
      waMessages?.forEach(m => { waStatusMap[m.wa_message_id] = m.status })
    }

    const enriched = msgs.map(m => ({
      ...m,
      wa_status: m.wa_message_id ? (waStatusMap[m.wa_message_id] || 'pending') : null,
    }))

    return res.status(200).json({ messages: enriched })
  }

  return res.status(405).end()
}
