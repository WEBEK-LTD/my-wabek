import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const { title, body, url, user_ids } = req.body
  if (!title || !body) return res.status(400).json({ error: 'title and body required' })

  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublic || !vapidPrivate) return res.status(400).json({ error: 'VAPID keys not configured' })

  const db = supabaseAdmin()
  let query = db.from('push_subscriptions').select('subscription, user_id')
  if (user_ids?.length) query = query.in('user_id', user_ids)

  const { data: subs } = await query
  if (!subs?.length) return res.status(200).json({ sent: 0, message: 'No subscribers' })

  let sent = 0
  const webpush = await import('web-push')
  webpush.default.setVapidDetails(`mailto:admin@waabek.com`, vapidPublic, vapidPrivate)

  for (const sub of subs) {
    try {
      const parsed = JSON.parse(sub.subscription)
      await webpush.default.sendNotification(parsed, JSON.stringify({ title, body, url: url || '/dashboard', icon: '/icon-192.png' }))
      sent++
    } catch (e) {
      // Remove invalid subscription
      if ((e as { statusCode?: number }).statusCode === 410) {
        await db.from('push_subscriptions').delete().eq('user_id', sub.user_id)
      }
    }
  }

  return res.status(200).json({ sent, total: subs.length })
}
