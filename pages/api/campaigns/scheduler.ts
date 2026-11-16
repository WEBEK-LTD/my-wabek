import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCron } from '@/lib/security'

// Called every minute by netlify/functions/campaign-runner.mts:
//   POST /api/campaigns/scheduler   header: x-cron-secret: <CRON_SECRET>
//
// Each due campaign is kicked off by calling POST /api/campaigns/:id
// {action:'start'} with the same cron header. Those calls are fired
// concurrently and we only wait a short time for each: the target function
// keeps running its batch after we stop waiting, and anything left over is
// picked up on the next tick (the campaign stays 'scheduled' until [id].ts
// marks it running), so the scheduler itself never hits the function timeout.

const KICK_TIMEOUT_MS = 2500
const MAX_PER_TICK = 25

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireCron(req, res)) return

  const db = supabaseAdmin()
  const now = new Date().toISOString()

  const { data: campaigns, error } = await db
    .from('campaigns')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(MAX_PER_TICK)

  if (error) {
    console.error('[scheduler] query failed:', error.message)
    return res.status(500).json({ error: 'Query failed' })
  }
  if (!campaigns?.length) {
    return res.status(200).json({ message: 'No campaigns due', processed: 0 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://waabek.com'
  const cronSecret = process.env.CRON_SECRET as string // requireCron guarantees it is set

  const outcomes = await Promise.all(campaigns.map(async (campaign) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), KICK_TIMEOUT_MS)
    try {
      const r = await fetch(`${appUrl}/api/campaigns/${encodeURIComponent(campaign.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
        body: JSON.stringify({ action: 'start' }),
        signal: ctrl.signal,
      })
      return r.ok ? 'started' : 'failed'
    } catch (e) {
      // Abort after the short wait is expected: the batch continues server-side.
      if ((e as Error)?.name === 'AbortError') return 'started'
      console.error(`[scheduler] start failed for campaign ${campaign.id}:`, (e as Error)?.message)
      return 'failed'
    } finally {
      clearTimeout(timer)
    }
  }))

  const started = outcomes.filter(o => o === 'started').length
  const failed = outcomes.length - started
  return res.status(200).json({ message: `Processed ${outcomes.length} campaigns`, processed: outcomes.length, started, failed })
}
