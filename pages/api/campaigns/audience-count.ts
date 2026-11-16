import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveContactFilter } from '@/lib/campaign-templates'
import { countCampaignAudience } from '@/lib/segments'

/**
 * POST /api/campaigns/audience-count
 *   { audience: 'all' | 'segment' | 'tags', segment_id?, tags?, tag_operator?: 'any' | 'all' }
 * → { count, filter }
 *
 * Exact recipient count for a campaign audience, resolved and filtered exactly
 * like campaign creation and the sender (resolveContactFilter +
 * applyCampaignFilter; blocked and opted-out contacts excluded).
 */
const bodySchema = z.object({
  audience: z.enum(['all', 'segment', 'tags']),
  segment_id: z.string().uuid().optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  tag_operator: z.enum(['any', 'all']).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const user = await requireMemberAccess(req, res, 'campaigns', { write: false })
  if (!user) return

  const parsed = bodySchema.safeParse(req.body || {})
  if (!parsed.success) return res.status(400).json({ error: 'Invalid data', details: parsed.error.errors })
  const { audience, segment_id, tags, tag_operator } = parsed.data

  if (audience === 'segment' && !segment_id) return res.status(400).json({ error: 'segment_id required' })
  const cleanTags = (tags || []).map(t => t.trim()).filter(Boolean)
  if (audience === 'tags' && !cleanTags.length) return res.status(400).json({ error: 'tags required' })

  const db = supabaseAdmin()
  const resolved = await resolveContactFilter(
    db, user.userId,
    audience === 'tags' ? { tags: cleanTags, tag_operator } : { all: true },
    audience === 'segment' ? segment_id : undefined,
  )
  if ('error' in resolved) return res.status(404).json({ error: resolved.error })

  try {
    const count = await countCampaignAudience(user.userId, resolved.filter)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ count, filter: resolved.filter })
  } catch (e) {
    console.error('[campaigns/audience-count] failed:', (e as Error).message)
    return res.status(500).json({ error: 'Failed to count recipients' })
  }
}
