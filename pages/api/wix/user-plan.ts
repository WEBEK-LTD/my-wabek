import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveWixCaller } from '@/lib/wix-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // user_id in the query is ignored: the account comes from the verified caller
  const caller = await resolveWixCaller(req, res)
  if (!caller) return

  const db = supabaseAdmin()
  const { data: user } = await db.from('users')
    .select('plan_id, plan_expires_at')
    .eq('id', caller.userId).maybeSingle()

  if (!user?.plan_id) return res.status(200).json({ plan: null })

  const { data: plan } = await db.from('plans')
    .select('id, name, max_messages_month, max_instances, max_campaigns')
    .eq('id', user.plan_id).maybeSingle()

  return res.status(200).json({
    plan: plan ? { ...plan, plan_expires_at: user.plan_expires_at } : null
  })
}
