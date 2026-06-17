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
    return res.status(400).json({ error: 'No WhatsApp Business Account ID (waba_id) on this instance. Reconnect via Embedded Signup.' })
  }

  try {
    const appId  = process.env.META_APP_ID || ''
    const apiVer = process.env.WHATSAPP_API_VERSION || 'v20.0'
    const url    = `https://graph.facebook.com/${apiVer}/${instance.waba_id}/subscribed_apps${appId ? `?app_id=${appId}` : ''}`

    console.log('[subscribe-webhook] REQUEST', JSON.stringify({
      endpoint:   url,
      api_version: apiVer,
      waba_id:    instance.waba_id,
      instance_id: instanceId,
      token_prefix: instance.access_token ? instance.access_token.slice(0, 20) + '...' : 'MISSING',
      token_length: instance.access_token?.length || 0,
      app_id_env:  appId || 'NOT_SET',
    }))

    // Debug token via Meta Token Debugger
    try {
      const debugRes  = await fetch(`https://graph.facebook.com/debug_token?input_token=${instance.access_token}&access_token=${appId}|${process.env.META_APP_SECRET || ''}`)
      const debugData = await debugRes.json()
      console.log('[subscribe-webhook] TOKEN_DEBUG', JSON.stringify({
        app_id:      debugData?.data?.app_id,
        type:        debugData?.data?.type,
        expires_at:  debugData?.data?.expires_at,
        is_valid:    debugData?.data?.is_valid,
        scopes:      debugData?.data?.scopes,
        error:       debugData?.data?.error || debugData?.error,
      }))
    } catch (debugErr: any) {
      console.log('[subscribe-webhook] TOKEN_DEBUG_FAILED', debugErr?.message)
    }

    const r    = await fetch(url, {
      method:  'POST',
      headers: { Authorization: `Bearer ${instance.access_token}` },
    })
    const raw  = await r.text()
    let data: any = {}
    try { data = JSON.parse(raw) } catch {}

    console.log('[subscribe-webhook] RESPONSE', JSON.stringify({
      status:  r.status,
      ok:      r.ok,
      body:    raw.slice(0, 500),
    }))

    if (data?.success) {
      return res.status(200).json({ success: true, message: 'Webhook subscription active. Incoming messages should now arrive.' })
    }
    return res.status(502).json({ success: false, error: data?.error?.message || 'Subscription failed', meta_error: data?.error, meta_status: r.status })
  } catch (err: any) {
    console.error('[subscribe-webhook] EXCEPTION', err?.message, err?.stack)
    return res.status(502).json({ success: false, error: err?.message || 'Request failed', stack: err?.stack?.slice(0, 300) })
  }
}
