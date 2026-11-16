import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'PUT') {
    const { title, message, shortcut, tags } = req.body || {}
    if (title !== undefined && (typeof title !== 'string' || !title || title.length > 200)) return res.status(400).json({ error: 'Invalid title' })
    if (message !== undefined && (typeof message !== 'string' || !message || message.length > 4096)) return res.status(400).json({ error: 'Invalid message' })
    if (shortcut !== undefined && shortcut !== null && (typeof shortcut !== 'string' || shortcut.length > 50)) return res.status(400).json({ error: 'Invalid shortcut' })
    if (tags !== undefined && (!Array.isArray(tags) || tags.some((t: unknown) => typeof t !== 'string'))) return res.status(400).json({ error: 'Invalid tags' })
    const { data, error } = await db.from('quick_replies').update({ title, message, shortcut, tags }).eq('id', id as string).eq('user_id', user.userId).select().single()
    if (error) {
      console.error('[quick-replies] db error:', error.message)
      return res.status(500).json({ error: 'Failed to update quick reply' })
    }
    return res.status(200).json({ reply: data })
  }

  if (req.method === 'DELETE') {
    await db.from('quick_replies').delete().eq('id', id as string).eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
