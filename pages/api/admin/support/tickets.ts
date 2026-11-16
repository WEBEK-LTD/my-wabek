import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { logAction, getClientIp } from '@/lib/middleware'

const STATUSES = ['open', 'pending', 'resolved', 'closed']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  const { error: tableCheck } = await db.from('support_tickets').select('id').limit(1)
  if (tableCheck?.message?.includes('relation') || tableCheck?.message?.includes('schema cache')) {
    return res.status(503).json({ error: 'Support tables not found. Run migration 012_support_tickets.sql in Supabase SQL Editor.' })
  }

  if (req.method === 'GET') {
    const { status } = req.query
    let q = db.from('support_tickets')
      .select(`*, users(id,name,email,plan_id,created_at), support_messages(id,content,sender_type,created_at)`)
      .order('updated_at', { ascending: false })
    if (status && status !== 'all') q = q.eq('status', status as string)
    const { data } = await q
    return res.status(200).json({ tickets: data || [] })
  }

  if (req.method === 'PUT') {
    const { id, status } = req.body || {}
    if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'id required' })
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' })
    const { error } = await db.from('support_tickets').update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
    }).eq('id', id)
    if (error) {
      console.error('[admin tickets] update failed:', error.message)
      return res.status(500).json({ error: 'Failed to update ticket' })
    }
    await logAction({ userId: admin.userId, action: 'admin_ticket_status', resource: 'support_ticket', resourceId: id, details: { status }, ipAddress: getClientIp(req) })
    return res.status(200).json({ success: true })
  }

  return res.status(405).end()
}
