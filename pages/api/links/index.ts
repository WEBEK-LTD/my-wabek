import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

function generateShortCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('tracked_links').select('*, link_clicks(count)').eq('user_id', user.userId).order('created_at', { ascending: false })
    return res.status(200).json({ links: data || [] })
  }

  if (req.method === 'POST') {
    const { original_url, title, campaign_id } = req.body
    if (!original_url) return res.status(400).json({ error: 'original_url required' })

    let shortCode = generateShortCode()
    // Ensure unique
    const { data: existing } = await db.from('tracked_links').select('id').eq('short_code', shortCode).single()
    if (existing) shortCode = generateShortCode() + Date.now().toString(36)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'

    const { data, error } = await db.from('tracked_links').insert({
      id: uuidv4(), user_id: user.userId,
      original_url, short_code: shortCode, title,
      campaign_id: campaign_id || null,
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ link: data, short_url: `${appUrl}/l/${shortCode}` })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
