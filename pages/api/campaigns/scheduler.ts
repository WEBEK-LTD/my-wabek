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

  for (const campaign of campaigns) {
    try {
      // Mark as running
      await db.from('campaigns').update({ status: 'running' }).eq('id', campaign.id)

      // Trigger campaign execution
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
      fetch(`${appUrl}/api/campaigns/${campaign.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.JWT_SECRET}`,
        },
        body: JSON.stringify({ action: 'start' }),
      }).catch(console.error)

      processed++
    } catch (e) {
      console.error(`Scheduler error for campaign ${campaign.id}:`, e)
    }
  }

  return res.status(200).json({ message: `Processed ${processed} campaigns`, processed })
}
