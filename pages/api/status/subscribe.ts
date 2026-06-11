import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { type, value, country_code } = req.body
  if (!type || !value) return res.status(400).json({ error: 'type and value required' })
  if (!['email','phone'].includes(type)) return res.status(400).json({ error: 'type must be email or phone' })

  const db = supabaseAdmin()
  const { error } = await db.from('status_subscribers').upsert(
    { type, value: value.toLowerCase().trim(), country_code: country_code || null },
    { onConflict: 'value' }
  )
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true })
}
