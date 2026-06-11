import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'PUT') {
    const { data, error } = await db.from('plans').update({ ...req.body, updated_at: new Date().toISOString() }).eq('id', id as string).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ plan: data })
  }

  if (req.method === 'DELETE') {
    await db.from('plans').update({ is_active: false }).eq('id', id as string)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
