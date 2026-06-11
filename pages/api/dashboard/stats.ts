import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalMessagesRaw },
    { count: sentThisMonthRaw },
    { count: sentLastMonthRaw },
    { count: totalContactsRaw },
    { count: newContactsThisMonthRaw },
    { count: activeCampaignsRaw },
    { count: activeChattbotsRaw },
    { data: linkClicksData },
    { count: openConversationsRaw },
    { data: instances },
    { data: recentCampaigns },
    { data: statusBreakdown },
    { data: chatbotStats },
    { count: aiRepliesRaw },
    { data: topLinks },
    { count: inboundMsgCount },
    { data: dailyMessages },
  ] = await Promise.all([
    db.from('messages').select('*', { count: 'exact', head: true }).eq('user_id', user.userId),
    db.from('messages').select('*', { count: 'exact', head: true }).eq('user_id', user.userId).eq('direction', 'outbound').gte('created_at', monthStart),
    db.from('messages').select('*', { count: 'exact', head: true }).eq('user_id', user.userId).eq('direction', 'outbound').gte('created_at', prevMonthStart).lt('created_at', monthStart),
    db.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.userId),
    db.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.userId).gte('created_at', monthStart),
    db.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', user.userId).in('status', ['running', 'scheduled']),
    db.from('chatbot_flows').select('*', { count: 'exact', head: true }).eq('user_id', user.userId).eq('is_active', true),
    db.from('tracked_links').select('click_count, short_code, original_url, created_at').eq('user_id', user.userId),
    db.from('conversation_assignments').select('*', { count: 'exact', head: true }).eq('owner_id', user.userId).eq('status', 'open'),
    db.from('whatsapp_instances').select('id, display_name, phone_number, status, type').eq('user_id', user.userId),
    db.from('campaigns').select('name, sent_count, delivered_count, read_count, failed_count, status, created_at').eq('user_id', user.userId).order('created_at', { ascending: false }).limit(8),
    db.from('messages').select('status').eq('user_id', user.userId).eq('direction', 'outbound').gte('created_at', monthStart),
    db.from('chatbot_flows').select('name, trigger_count, is_active').eq('user_id', user.userId).order('trigger_count', { ascending: false }).limit(5),
    db.from('messages').select('*', { count: 'exact', head: true }).eq('user_id', user.userId).eq('type', 'ai_reply').gte('created_at', monthStart),
    db.from('tracked_links').select('short_code, original_url, click_count').eq('user_id', user.userId).order('click_count', { ascending: false }).limit(5),
    db.from('messages').select('*', { count: 'exact', head: true }).eq('user_id', user.userId).eq('direction', 'inbound').gte('created_at', monthStart),
    // Last 30 days messages for chart
    db.from('messages').select('created_at, status, direction').eq('user_id', user.userId).gte('created_at', thirtyDaysAgo).order('created_at', { ascending: true }),
  ])

  // Null-safe counts
  const totalMessages = totalMessagesRaw || 0
  const sentThisMonth = sentThisMonthRaw || 0
  const sentLastMonth = sentLastMonthRaw || 0
  const totalContacts = totalContactsRaw || 0
  const newContactsThisMonth = newContactsThisMonthRaw || 0
  const activeCampaigns = activeCampaignsRaw || 0
  const activeChatbots = activeChattbotsRaw || 0
  const openConversations = openConversationsRaw || 0
  const inboundMessages = inboundMsgCount || 0
  const aiRepliesThisMonth = aiRepliesRaw || 0

  // Status breakdown
  const sb = { sent: 0, delivered: 0, read: 0, failed: 0 }
  for (const msg of statusBreakdown || []) {
    if (msg.status in sb) sb[msg.status as keyof typeof sb]++
  }

  // Build daily chart from raw messages (last 30 days)
  const dayMap: Record<string, { sent: number; delivered: number; received: number }> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().split('T')[0]
    dayMap[key] = { sent: 0, delivered: 0, received: 0 }
  }
  for (const msg of dailyMessages || []) {
    const day = msg.created_at?.split('T')[0]
    if (day && dayMap[day]) {
      if (msg.direction === 'outbound') {
        dayMap[day].sent++
        if (msg.status === 'delivered' || msg.status === 'read') dayMap[day].delivered++
      } else {
        dayMap[day].received++
      }
    }
  }
  const chart = Object.entries(dayMap).map(([date, v]) => ({ date, ...v }))

  // Month over month
  const momGrowth = (sentLastMonth || 0) > 0 ? Math.round((((sentThisMonth || 0) - (sentLastMonth || 0)) / (sentLastMonth || 1)) * 100) : 0
  const st = sentThisMonth || 0
  const deliveryRate = st > 0 ? Math.round(((sb.delivered + sb.read) / st) * 100) : 0
  const readRate = st > 0 ? Math.round((sb.read / st) * 100) : 0
  const totalClicks = (linkClicksData || []).reduce((sum, l) => sum + (l.click_count || 0), 0)

  return res.status(200).json({
    stats: {
      total_messages: totalMessages || 0,
      sent_this_month: sentThisMonth || 0,
      sent_last_month: sentLastMonth || 0,
      mom_growth: momGrowth,
      total_contacts: totalContacts || 0,
      new_contacts_this_month: newContactsThisMonth || 0,
      active_campaigns: activeCampaigns || 0,
      active_chatbots: activeChatbots || 0,
      link_clicks_total: totalClicks,
      open_conversations: openConversations || 0,
      ai_replies_this_month: aiRepliesThisMonth || 0,
      inbound_this_month: inboundMessages || 0,
      delivery_rate: deliveryRate,
      read_rate: readRate,
    },
    status_breakdown: sb,
    daily_chart: chart,
    recent_campaigns: recentCampaigns || [],
    chatbot_stats: chatbotStats || [],
    top_links: topLinks || [],
    instances: instances || [],
    ai_replies_this_month: aiRepliesThisMonth || 0,
  })
}
