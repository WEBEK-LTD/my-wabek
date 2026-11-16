import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { pick } from '@/lib/security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('status_incidents').select('*').order('incident_date', { ascending: false }).limit(20)
    return res.status(200).json({ incidents: data || [] })
  }

  const admin = await requireAdmin(req, res)
  if (!admin) return

  if (req.method === 'POST') {
    const { title, status, duration, incident_date } = req.body
    if (!title || !incident_date) return res.status(400).json({ error: 'title and incident_date required' })
    const { data, error } = await db.from('status_incidents').insert({ title, status: status || 'resolved', duration, incident_date }).select().single()
    if (error) {
      console.error('[status/incidents] insert error:', error.message)
      return res.status(500).json({ error: 'Failed to create incident' })
    }
    return res.status(200).json({ incident: data })
  }

  if (req.method === 'PUT') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id required' })
    const fields = pick(req.body, ['title', 'status', 'duration', 'incident_date'])
    await db.from('status_incidents').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', String(id))
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    await db.from('status_incidents').delete().eq('id', id)
    return res.status(200).json({ success: true })
  }

  return res.status(405).end()
}
