import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireEnv, verifyState } from '@/lib/security'
import { v4 as uuidv4 } from 'uuid'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'

// Step 2 of the Wix install: Wix redirects here with ?code&state&instanceId.
// `state` was signed by /api/wix/install and must verify.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query

  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Missing code' })
  const st = verifyState<{ purpose?: string }>(req.query.state)
  if (st?.purpose !== 'wix_install') {
    return res.status(400).json({ error: 'Invalid or expired install session. Please install the app again from Wix.' })
  }

  let APP_ID: string, APP_SECRET: string
  try {
    APP_ID = requireEnv('WIX_APP_ID')
    APP_SECRET = requireEnv('WIX_APP_SECRET')
  } catch (e) {
    console.error('[Wix OAuth]', (e as Error).message)
    return res.status(503).json({ error: 'Wix app not configured', code: 'wix_not_configured' })
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://www.wixapis.com/oauth/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'authorization_code',
        client_id:     APP_ID,
        client_secret: APP_SECRET,
        code,
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      console.error('[Wix OAuth] token exchange failed: status', tokenRes.status)
      return res.redirect(`${APP_URL}/dashboard/wix?error=token_failed`)
    }

    const accessToken  = tokenData.access_token
    const refreshToken = tokenData.refresh_token

    // 2. Get site info
    const siteRes = await fetch('https://www.wixapis.com/site-properties/v4/properties', {
      headers: { Authorization: accessToken },
    })
    const siteData = await siteRes.json().catch(() => ({}))
    const props = siteData?.properties
    const siteName = (Array.isArray(props) ? props.find((p: { name: string }) => p.name === 'siteName')?.value : props?.name) || 'Wix Store'
    const siteUrl  = (Array.isArray(props) ? props.find((p: { name: string }) => p.name === 'url')?.value : props?.url) || ''

    // 3. Get instance info — the instance id comes from Wix (bound to this
    // token), never from the query string.
    const instanceRes = await fetch('https://www.wixapis.com/apps/v1/instance', {
      headers: { Authorization: accessToken },
    })
    const instanceData = await instanceRes.json().catch(() => ({}))
    const wixInstanceId = instanceData?.instance?.instanceId
    if (!wixInstanceId) {
      console.error('[Wix OAuth] no instanceId from Wix')
      return res.redirect(`${APP_URL}/dashboard/wix?error=install_failed`)
    }

    const db = supabaseAdmin()

    // 4. Save Wix installation tokens (owner mapping is managed by the
    // verified auto-connect / link flows, not here)
    const { data: existing } = await db.from('wix_installations').select('id').eq('wix_instance_id', wixInstanceId).maybeSingle()
    const now = new Date().toISOString()
    if (existing) {
      await db.from('wix_installations').update({
        access_token: accessToken, refresh_token: refreshToken,
        site_name: siteName, site_url: siteUrl, updated_at: now,
      }).eq('wix_instance_id', wixInstanceId)
    } else {
      await db.from('wix_installations').insert({
        id: uuidv4(), wix_instance_id: wixInstanceId,
        owner_id: instanceData?.site?.ownerInfo?.uid || null,
        access_token: accessToken, refresh_token: refreshToken,
        site_name: siteName, site_url: siteUrl, installed_at: now, updated_at: now,
      })
    }

    // 5. Register webhooks on Wix for this installation
    await registerWixWebhooks(accessToken)

    // 6. Close the Wix consent window. The access token is NOT put in the
    // redirect URL (it would land in browser history and logs). Set
    // WIX_CLOSE_WINDOW_WITH_TOKEN=1 only if Wix refuses to finish installs
    // without it (legacy OAuth docs).
    if (process.env.WIX_CLOSE_WINDOW_WITH_TOKEN === '1') {
      return res.redirect(`https://www.wix.com/installer/close-window?access_token=${encodeURIComponent(accessToken)}`)
    }
    return res.redirect('https://www.wix.com/installer/close-window')

  } catch (err: unknown) {
    console.error('[Wix OAuth callback] error:', err instanceof Error ? err.message : err)
    return res.redirect(`${APP_URL}/dashboard/wix?error=install_failed`)
  }
}

async function registerWixWebhooks(accessToken: string): Promise<void> {
  const callbackBase = `${APP_URL}/api/wix/webhook`

  const events = [
    { topic: 'ecommerce/v1/orders/created',   callback: `${callbackBase}?event=order_placed` },
    { topic: 'ecommerce/v1/orders/paid',      callback: `${callbackBase}?event=order_paid` },
    { topic: 'ecommerce/v1/orders/fulfilled', callback: `${callbackBase}?event=order_shipped` },
    { topic: 'ecommerce/v1/orders/cancelled', callback: `${callbackBase}?event=order_cancelled` },
  ]

  for (const ev of events) {
    try {
      await fetch('https://www.wixapis.com/events/v3/subscriptions', {
        method: 'POST',
        headers: {
          Authorization:  accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: {
            topic:       ev.topic,
            callbackUrl: ev.callback,
          },
        }),
      })
    } catch (e) {
      console.error(`[Wix] failed to register webhook ${ev.topic}:`, e instanceof Error ? e.message : e)
    }
  }
}
