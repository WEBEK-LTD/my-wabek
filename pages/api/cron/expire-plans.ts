import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

// Run daily via Netlify scheduled functions or external cron
// GET /api/cron/expire-plans?secret=CRON_SECRET
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const db = supabaseAdmin()
  const now = new Date().toISOString()

  // Find all users with expired plans
  const { data: expired } = await db
    .from('users')
    .select('id, email')
    .not('plan_id', 'is', null)
    .not('plan_expires_at', 'is', null)
    .lt('plan_expires_at', now)

  if (!expired?.length) {
    return res.status(200).json({ expired: 0, message: 'No expired plans' })
  }

  const ids = expired.map(u => u.id)

  // Downgrade to no plan
  await db.from('users').update({ plan_id: null, plan_expires_at: null }).in('id', ids)
  await db.from('subscriptions').update({ status: 'cancelled' }).in('user_id', ids).eq('status', 'active')

  // Reset monthly AI counters on 1st of month
  const today = new Date()
  if (today.getDate() === 1) {
    await db.from('ai_settings').update({ replies_this_month: 0 }).neq('replies_this_month', 0)
  }

  return res.status(200).json({ expired: ids.length, emails: expired.map(u => u.email) })
}
