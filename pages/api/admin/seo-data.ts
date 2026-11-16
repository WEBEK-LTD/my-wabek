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
  parsed_pages: 'seo_parsed_pages',
}

// Saved JSON-LD schemas: `schema_<type>` → system_settings key `seo_schema_<type>`.
const SCHEMA_TYPE = /^schema_[a-z0-9_]{1,40}$/

function keyFor(type: unknown): string | undefined {
  if (typeof type !== 'string') return undefined
  if (Object.prototype.hasOwnProperty.call(KEYS, type)) return KEYS[type as keyof typeof KEYS]
  if (SCHEMA_TYPE.test(type)) return 'seo_' + type
  return undefined
}

// Crawl results / parsed pages can be large.
export const config = { api: { bodyParser: { sizeLimit: '4mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const raw = req.query.type
    const key = keyFor(Array.isArray(raw) ? raw[0] : raw)
    if (!key) return res.status(400).json({ error: 'Invalid type' })
    const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle()
    return res.status(200).json({ data: data?.value || null })
  }

  if (req.method === 'POST') {
    const { type, data } = req.body || {}
    const key = keyFor(type)
    if (!key) return res.status(400).json({ error: 'Invalid type' })
    if (data === undefined || data === null) return res.status(400).json({ error: 'data is required' })
    const { error } = await db.from('system_settings').upsert({ key, value: data, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) {
      console.error('[admin seo-data] save failed:', error.message)
      return res.status(500).json({ error: 'Failed to save' })
    }
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
