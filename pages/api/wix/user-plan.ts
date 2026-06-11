import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.query.user_id as string
  if (!userId) return res.status(400).json({ plan: null })

  const db = supabaseAdmin()
  const { data: user } = await db.from('users')
    .select('plan_id, plan_expires_at')
    .eq('id', userId).maybeSingle()

  if (!user?.plan_id) return res.status(200).json({ plan: null })

  const { data: plan } = await db.from('plans')
    .select('id, name, max_messages_month, max_instances, max_campaigns')
    .eq('id', user.plan_id).maybeSingle()

  return res.status(200).json({
    plan: plan ? { ...plan, plan_expires_at: user.plan_expires_at } : null
  })
}
