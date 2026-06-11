import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { checkAILimit } from '@/lib/ai-engine'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { count: totalReplies } = await db
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.userId)
    .eq('type', 'ai_reply')

  const { count: repliesThisMonth } = await db
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.userId)
    .eq('type', 'ai_reply')
    .gte('created_at', monthStart)

  const limitInfo = await checkAILimit(user.userId)

  return res.status(200).json({
    total_replies: totalReplies || 0,
    replies_this_month: repliesThisMonth || 0,
    ...limitInfo,
  })
}
