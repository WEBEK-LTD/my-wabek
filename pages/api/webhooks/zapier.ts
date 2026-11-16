import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { assertPublicUrl } from '@/lib/security'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('zapier_hooks').select('*').eq('user_id', user.userId).order('created_at', { ascending: false })
    return res.status(200).json({ hooks: data || [] })
  }

  if (req.method === 'POST') {
    const { target_url, event, label } = req.body || {}
    if (!target_url || !event || typeof target_url !== 'string' || typeof event !== 'string') {
      return res.status(400).json({ error: 'target_url and event required' })
    }
    // SSRF guard: public https endpoints only (re-checked on every delivery)
    try {
      await assertPublicUrl(target_url, { httpsOnly: true })
    } catch {
      return res.status(400).json({ error: 'target_url must be a public https URL' })
    }
    const { data, error } = await db.from('zapier_hooks').insert({
      id: uuidv4(), user_id: user.userId, target_url, event: event.slice(0, 64),
      label: typeof label === 'string' ? label.slice(0, 100) : '', is_active: true,
      created_at: new Date().toISOString()
    }).select().single()
    if (error) return res.status(500).json({ error: 'Failed to save hook' })
    return res.status(201).json({ hook: data })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    await db.from('zapier_hooks').delete().eq('id', id as string).eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
