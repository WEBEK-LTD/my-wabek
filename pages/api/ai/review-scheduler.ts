/**
 * AI Review Scheduler Endpoint
 * Called by the Railway Baileys server every hour.
 * Protected by x-cron-secret header.
 * READ-ONLY: only analyzes conversations, never sends messages.
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { runScheduledReviews } from '@/lib/ai-review-engine'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify cron secret
  const secret = req.headers['x-cron-secret']
  const expected = process.env.SERVER_SECRET || process.env.WABEK_EVENTS_SECRET
  if (!secret || secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log('[review-scheduler] Starting scheduled review run')
    await runScheduledReviews()
    return res.status(200).json({ success: true, message: 'Review run completed' })
  } catch (err: any) {
    console.error('[review-scheduler] Error:', err?.message)
    return res.status(500).json({ error: err?.message })
  }
}
