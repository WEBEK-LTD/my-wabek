import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: newUsersThisMonth },
    { count: totalMessages },
    { count: messagesThisMonth },
    { count: totalContacts },
    { count: activeSubs },
    { count: totalCampaigns },
    { count: totalChatbots },
    { count: totalInstances },
    { count: connectedInstances },
    { data: logs },
    { data: plans },
    { data: revenueData },
    { data: dailySignups },
  ] = await Promise.all([
    db.from('users').select('*', { count: 'exact', head: true }),
    db.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
    db.from('users').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
    db.from('messages').select('*', { count: 'exact', head: true }),
    db.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
    db.from('contacts').select('*', { count: 'exact', head: true }),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('campaigns').select('*', { count: 'exact', head: true }),
    db.from('chatbot_flows').select('*', { count: 'exact', head: true }),
    db.from('whatsapp_instances').select('*', { count: 'exact', head: true }),
    db.from('whatsapp_instances').select('*', { count: 'exact', head: true }).eq('status', 'connected'),
    db.from('system_logs').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('plans').select('id, name, price_monthly').eq('is_active', true),
    db.from('subscriptions').select('plans(price_monthly)').eq('status', 'active'),
    db.from('users').select('created_at').gte('created_at', weekStart).order('created_at'),
  ])

  // Users per plan
  const planStats = []
  for (const plan of plans || []) {
    const { count } = await db.from('users').select('*', { count: 'exact', head: true }).eq('plan_id', plan.id)
    planStats.push({ plan: plan.name, count: count || 0 })
  }

  // MRR calculation
  let mrr = 0
  for (const s of (revenueData || [])) {
    mrr += (s as Record<string, { price_monthly?: number }>).plans?.price_monthly || 0
  }

  // Daily signups last 7 days
  const signupsByDay: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    signupsByDay[d.toISOString().split('T')[0]] = 0
  }
  for (const u of dailySignups || []) {
    const day = u.created_at.split('T')[0]
    if (day in signupsByDay) signupsByDay[day]++
  }

  return res.status(200).json({
    stats: {
      total_users: totalUsers || 0,
      active_users: activeUsers || 0,
      new_users_this_month: newUsersThisMonth || 0,
      total_messages: totalMessages || 0,
      messages_this_month: messagesThisMonth || 0,
      total_contacts: totalContacts || 0,
      active_subscriptions: activeSubs || 0,
      total_campaigns: totalCampaigns || 0,
      total_chatbots: totalChatbots || 0,
      total_instances: totalInstances || 0,
      connected_instances: connectedInstances || 0,
      mrr: mrr,
    },
    plan_distribution: planStats,
    daily_signups: Object.entries(signupsByDay).map(([date, count]) => ({ date, count })),
    recent_logs: logs || [],
  })
}
