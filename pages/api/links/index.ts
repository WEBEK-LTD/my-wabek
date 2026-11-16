import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { randomCode } from '@/lib/security'
import { v4 as uuidv4 } from 'uuid'

const CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

// Only http(s) destinations are allowed (no javascript:, data:, file:, ...)
function normalizeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname) return null
    return u.toString()
  } catch {
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'links')
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('tracked_links').select('*, link_clicks(count)').eq('user_id', user.userId).order('created_at', { ascending: false })
    return res.status(200).json({ links: data || [] })
  }

  if (req.method === 'POST') {
    const { title, campaign_id } = req.body || {}
    const original_url = normalizeHttpUrl(req.body?.original_url)
    if (!original_url) return res.status(400).json({ error: 'A valid http(s) original_url is required' })

    if (campaign_id) {
      const { data: camp } = await db.from('campaigns').select('id')
        .eq('id', String(campaign_id)).eq('user_id', user.userId).maybeSingle()
      if (!camp) return res.status(400).json({ error: 'Campaign not found' })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'

    // short_code is UNIQUE — retry on the rare collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const shortCode = randomCode(attempt < 3 ? 6 : 8, CODE_ALPHABET)
      const { data, error } = await db.from('tracked_links').insert({
        id: uuidv4(), user_id: user.userId,
        original_url, short_code: shortCode,
        title: typeof title === 'string' ? title.slice(0, 200) : null,
        campaign_id: campaign_id || null,
      }).select().single()

      if (!error) return res.status(201).json({ link: data, short_url: `${appUrl}/l/${shortCode}` })
      if (error.code !== '23505') {
        console.error('[links] create error:', error.message)
        return res.status(500).json({ error: 'Failed to create link' })
      }
    }
    return res.status(500).json({ error: 'Failed to create link' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
