import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

// Call every minute via cron job:
// GET https://waabek.com/api/campaigns/scheduler?secret=YOUR_JWT_SECRET

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth check
  const secret = req.query.secret || req.headers['x-secret']
  const validSecret = process.env.CRON_SECRET || process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET
  if (secret !== validSecret) return res.status(403).json({ error: 'Forbidden' })

  const db = supabaseAdmin()
  const now = new Date().toISOString()

  // Find campaigns due to run
  const { data: campaigns } = await db
    .from('campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)

  if (!campaigns?.length) {
    return res.status(200).json({ message: 'No campaigns due', processed: 0 })
  }

  let processed = 0
  const results: any[] = []

  for (const campaign of campaigns) {
    try {
      // NOTE: do NOT set status='running' here — [id].ts's 'start' action
      // only allows transitioning from draft/scheduled/paused, and will
      // itself mark the campaign as 'running' once it begins the batch.

      // Trigger campaign execution and AWAIT it. A fire-and-forget fetch
      // here gets killed when this function returns (serverless), leaving
      // the campaign stuck at status='running' with no progress.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://waabek.com'
      const r = await fetch(`${appUrl}/api/campaigns/${campaign.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.JWT_SECRET}`,
        },
        body: JSON.stringify({ action: 'start' }),
      })
      const data = await r.json().catch(() => ({}))
      results.push({ id: campaign.id, status: r.status, ...data })

      processed++
    } catch (e: any) {
      console.error(`Scheduler error for campaign ${campaign.id}:`, e)
      results.push({ id: campaign.id, error: e?.message })
    }
  }

  return res.status(200).json({ message: `Processed ${processed} campaigns`, processed, results })
}
