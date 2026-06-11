import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  const { data: contact } = await db
    .from('contacts').select('*').eq('id', id as string).eq('user_id', user.userId).single()
  if (!contact) return res.status(404).json({ error: 'Contact not found' })

  if (req.method === 'GET') {
    const { data: messages } = await db.from('messages').select('*').eq('contact_id', id as string).order('created_at', { ascending: false }).limit(50)
    return res.status(200).json({ contact, messages: messages || [] })
  }

  if (req.method === 'PUT') {
    const { name, email, tags, variables, is_blocked, opted_out } = req.body
    const { data, error } = await db.from('contacts').update({ name, email, tags, variables, is_blocked, opted_out, updated_at: new Date().toISOString() }).eq('id', id as string).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ contact: data })
  }

  if (req.method === 'DELETE') {
    await db.from('contacts').delete().eq('id', id as string)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
