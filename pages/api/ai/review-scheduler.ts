/**
 * AI Review Scheduler Endpoint
 * Called by the Railway Baileys server every hour.
 * Protected by the x-cron-secret header (CRON_SECRET, constant-time, fail closed).
 * READ-ONLY: only analyzes conversations, never sends messages.
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { runScheduledReviews } from '@/lib/ai-review-engine'
import { isCronRequest, safeEqual } from '@/lib/security'

// TRANSITIONAL FALLBACK: wabek-baileys/server.js sends CRON_SECRET in
// x-cron-secret when it is set on Railway, and falls back to SERVER_SECRET
// otherwise. Until every Railway deployment has CRON_SECRET (see
// docs/DEPLOY_CHECKLIST.md) we also accept SERVER_SECRET here — header only,
// constant-time, and only when it is a strong value (>= 16 chars, not the
// 'change-this-secret' placeholder). Remove once CRON_SECRET is everywhere.
function isLegacyServerCall(req: NextApiRequest): boolean {
  const legacy = process.env.SERVER_SECRET
  if (!legacy || legacy.length < 16 || legacy === 'change-this-secret') return false
  return safeEqual(req.headers['x-cron-secret'], legacy)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!isCronRequest(req) && !isLegacyServerCall(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log('[review-scheduler] Starting scheduled review run')
    await runScheduledReviews()
    return res.status(200).json({ success: true, message: 'Review run completed' })
  } catch (err) {
    console.error('[review-scheduler] Error:', (err as Error)?.message)
    return res.status(500).json({ error: 'Review run failed' })
  }
}
