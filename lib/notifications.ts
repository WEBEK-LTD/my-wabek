import { supabaseAdmin } from './supabase'
import { sendMobilePush } from './mobile-push'

type NotifType = 'info' | 'success' | 'warning' | 'error' | 'message' | 'campaign' | 'system'

export async function createNotification(params: {
  userId: string
  type: NotifType
  title: string
  body?: string
  link?: string
}) {
  try {
    const db = supabaseAdmin()
    await db.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body || null,
      link: params.link || null,
      is_read: false,
    })
  } catch (e) {
    console.error('Notification error:', e)
  }
}

export async function notifyCampaignComplete(userId: string, campaignName: string, sent: number, failed: number) {
  await createNotification({
    userId,
    type: failed > 0 ? 'warning' : 'success',
    title: `Campaign "${campaignName}" completed`,
    body: `${sent} sent, ${failed} failed`,
    link: '/dashboard/campaigns',
  })
  await sendMobilePush(userId, 'campaign_done', { name: campaignName, sent, failed })
}

export async function notifyNewMessage(userId: string, from: string, preview: string) {
  await createNotification({
    userId,
    type: 'message',
    title: `New message from ${from}`,
    body: preview.slice(0, 100),
    link: '/dashboard/chat',
  })
  await sendMobilePush(userId, 'message', { from, preview: preview.slice(0, 160) })
}

export async function notifyInstanceConnected(userId: string, phoneNumber: string) {
  await createNotification({
    userId,
    type: 'success',
    title: 'WhatsApp Connected',
    body: `${phoneNumber} is now connected`,
    link: '/dashboard/instances',
  })
  await sendMobilePush(userId, 'number_connected', { phone: phoneNumber })
}

export async function notifyInstanceDisconnected(userId: string, phoneNumber: string) {
  await createNotification({
    userId,
    type: 'warning',
    title: 'WhatsApp Disconnected',
    body: `${phoneNumber} disconnected. Reconnect to continue sending messages.`,
    link: '/dashboard/instances',
  })
  await sendMobilePush(userId, 'number_disconnected', { phone: phoneNumber })
}
