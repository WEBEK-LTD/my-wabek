import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

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
    const { id, status } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    await db.from('support_tickets').update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
    }).eq('id', id)
    return res.status(200).json({ success: true })
  }

  return res.status(405).end()
}
