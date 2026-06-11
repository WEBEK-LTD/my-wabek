import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// Keys for different SEO data types
const KEYS = {
  redirects: 'seo_redirects',
  crawl: 'seo_crawl_results',
  ranks: 'seo_rank_history',
  keywords: 'seo_tracked_keywords',
  page_scores: 'seo_page_scores',
  competitors: 'seo_competitors',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const raw = req.query.type
    const typeKey = (Array.isArray(raw) ? raw[0] : raw) as keyof typeof KEYS
    const key = typeKey ? KEYS[typeKey] : undefined
    if (!key) return res.status(400).json({ error: 'Invalid type' })
    const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle()
    return res.status(200).json({ data: data?.value || null })
  }

  if (req.method === 'POST') {
    const { type, data } = req.body
    const key = KEYS[type as keyof typeof KEYS]
    if (!key) return res.status(400).json({ error: 'Invalid type' })
    await db.from('system_settings').upsert({ key, value: data, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
