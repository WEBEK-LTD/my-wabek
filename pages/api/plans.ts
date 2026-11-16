import { NextApiResponse, NextApiRequest } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

// Public plan catalogue (pricing page, billing, plugins).
// select('*') + an allow-list in code: naming columns in the query would make
// the whole request fail on databases where an optional column (e.g. a newer
// allow_* flag) hasn't been migrated yet. Only the fields below are returned —
// Stripe ids and any internal columns stay server-side.
const PUBLIC_FIELDS = [
  'id', 'name', 'description', 'price_monthly', 'price_yearly', 'currency',
  'features', 'is_active', 'is_popular', 'sort_order', 'trial_days',
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) {
    console.error('[plans] load failed:', error.message)
    return res.status(500).json({ plans: [] })
  }
  const plans = (data || []).map(row => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      if (PUBLIC_FIELDS.includes(k) || k.startsWith('max_') || k.startsWith('allow_')) out[k] = v
    }
    return out
  })
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  return res.status(200).json({ plans })
}
