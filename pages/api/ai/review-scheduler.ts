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
// Railway's SERVER_SECRET is stored on Netlify as WA_WEB_SERVER_SECRET (and
// optionally WABEK_EVENTS_SECRET), so those names are accepted too.
function isLegacyServerCall(req: NextApiRequest): boolean {
  const header = req.headers['x-cron-secret']
  const candidates = [process.env.SERVER_SECRET, process.env.WA_WEB_SERVER_SECRET, process.env.WABEK_EVENTS_SECRET]
  let ok = false
  for (const secret of candidates) {
    if (!secret || secret.length < 16 || secret === 'change-this-secret') continue
    // No early exit: compare against every configured secret.
    if (safeEqual(header, secret)) ok = true
  }
  return ok
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
