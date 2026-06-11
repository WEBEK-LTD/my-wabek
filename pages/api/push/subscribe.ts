import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const user = await requireAuth(req, res)
    if (!user) return

    const { subscription } = req.body
    if (!subscription) return res.status(400).json({ error: 'subscription required' })

    const db = supabaseAdmin()
    await db.from('push_subscriptions').upsert({
      id: uuidv4(),
      user_id: user.userId,
      subscription: JSON.stringify(subscription),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const user = await requireAuth(req, res)
    if (!user) return
    const db = supabaseAdmin()
    await db.from('push_subscriptions').delete().eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
