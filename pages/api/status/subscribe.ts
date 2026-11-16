import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { type, value, country_code } = req.body || {}
  if (!type || !value || typeof value !== 'string') return res.status(400).json({ error: 'type and value required' })
  if (!['email', 'phone'].includes(type)) return res.status(400).json({ error: 'type must be email or phone' })
  const clean = value.toLowerCase().trim()
  if (clean.length > 254) return res.status(400).json({ error: 'value too long' })
  if (type === 'email' && !EMAIL_RE.test(clean)) return res.status(400).json({ error: 'Invalid email' })
  if (type === 'phone' && !/^\+?[0-9 ()-]{6,20}$/.test(clean)) return res.status(400).json({ error: 'Invalid phone' })

  const db = supabaseAdmin()
  const { error } = await db.from('status_subscribers').upsert(
    { type, value: clean, country_code: typeof country_code === 'string' ? country_code.slice(0, 8) : null },
    { onConflict: 'value' }
  )
  if (error) {
    console.error('[status/subscribe] error:', error.message)
    return res.status(500).json({ error: 'Failed to subscribe' })
  }
  return res.status(200).json({ success: true })
}
