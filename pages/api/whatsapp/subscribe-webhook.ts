import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return

  const instanceId = req.body?.instance_id as string
  if (!instanceId) return res.status(400).json({ error: 'instance_id required' })

  const db = supabaseAdmin()
  const { data: instance } = await db
    .from('whatsapp_instances')
    .select('*')
    .eq('id', instanceId)
    .eq('user_id', user.userId)
    .single()

  if (!instance) return res.status(404).json({ error: 'Instance not found' })
  if ((instance.instance_type || instance.type) !== 'cloud_api') {
    return res.status(400).json({ error: 'Only Cloud API instances use Meta webhooks.' })
  }
  if (!instance.waba_id) {
    return res.status(400).json({ error: 'No WhatsApp Business Account ID (waba_id) on this instance.' })
  }

  const subUrl = `https://graph.facebook.com/v25.0/${instance.waba_id}/subscribed_apps`
  const appId  = process.env.META_APP_ID || ''

  try {
    // 1. Check if already subscribed — re-subscribing returns #200 error
    try {
      const checkRes  = await fetch(subUrl, {
        headers: { Authorization: `Bearer ${instance.access_token}` },
      })
      const checkData = await checkRes.json()
      const existingId = checkData?.whatsapp_business_api_data?.id
      const alreadyOk  = existingId === appId ||
        (Array.isArray(checkData?.data) && checkData.data.some((a: any) => a.id === appId))

      if (alreadyOk) {
        console.log('[subscribe-webhook] already subscribed waba_id=', instance.waba_id)
        return res.status(200).json({ success: true, message: 'Webhook subscription already active. Incoming messages are being received.' })
      }
    } catch {}

    // 2. Subscribe
    const r   = await fetch(subUrl, {
      method:  'POST',
      headers: { Authorization: `Bearer ${instance.access_token}` },
    })
    const raw = await r.text()
    let data: any = {}
    try { data = JSON.parse(raw) } catch {}

    console.log('[subscribe-webhook] POST result', r.status, raw.slice(0, 300))

    if (data?.success) {
      return res.status(200).json({ success: true, message: 'Webhook subscription active. Incoming messages should now arrive.' })
    }
    return res.status(502).json({ success: false, error: data?.error?.message || 'Subscription failed', raw: data })
  } catch (err: any) {
    return res.status(502).json({ success: false, error: err?.message || 'Request failed' })
  }
}
