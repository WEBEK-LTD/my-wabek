import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('quick_replies').select('*').eq('user_id', user.userId).order('use_count', { ascending: false })
    return res.status(200).json({ replies: data || [] })
  }

  if (req.method === 'POST') {
    const { title, message, shortcut, tags } = req.body || {}
    if (!title || !message || typeof title !== 'string' || typeof message !== 'string') return res.status(400).json({ error: 'title and message required' })
    if (title.length > 200 || message.length > 4096) return res.status(400).json({ error: 'Input too long' })
    if (tags !== undefined && (!Array.isArray(tags) || tags.some((t: unknown) => typeof t !== 'string'))) return res.status(400).json({ error: 'Invalid tags' })
    const { data, error } = await db.from('quick_replies').insert({
      id: uuidv4(), user_id: user.userId, title, message,
      shortcut: typeof shortcut === 'string' ? shortcut.slice(0, 50) : null,
      tags: (tags || []).slice(0, 20),
    }).select().single()
    if (error) {
      console.error('[quick-replies] db error:', error.message)
      return res.status(500).json({ error: 'Failed to save quick reply' })
    }
    return res.status(201).json({ reply: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
