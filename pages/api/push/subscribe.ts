import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const user = await requireAuth(req, res)
    if (!user) return

    const { subscription } = req.body || {}
    if (!subscription || typeof subscription !== 'object') return res.status(400).json({ error: 'subscription required' })
    // Must look like a Web Push subscription with an https push-service endpoint
    let endpointOk = false
    try { endpointOk = new URL(String(subscription.endpoint)).protocol === 'https:' } catch {}
    const serialized = JSON.stringify(subscription)
    if (!endpointOk || typeof subscription.keys?.p256dh !== 'string' || typeof subscription.keys?.auth !== 'string' || serialized.length > 4096) {
      return res.status(400).json({ error: 'Invalid subscription' })
    }

    const db = supabaseAdmin()
    // One subscription per logged-in person (user_id is UNIQUE): a team
    // member keeps their own row instead of replacing the owner's. No id, so
    // an existing row keeps its primary key.
    const selfId = user.actualUserId || user.userId
    await db.from('push_subscriptions').upsert({
      user_id: selfId,
      subscription: serialized,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const user = await requireAuth(req, res)
    if (!user) return
    const db = supabaseAdmin()
    await db.from('push_subscriptions').delete().eq('user_id', user.actualUserId || user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
