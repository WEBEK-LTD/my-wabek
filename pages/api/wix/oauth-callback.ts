import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

const APP_ID     = '48cfce94-1e3d-4d09-a34d-e5f41e5b0469'
const APP_SECRET = 'eaf03696-cfc8-4fe0-92e6-d0e00d1f5e76'
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, instanceId } = req.query

  if (!code) return res.status(400).json({ error: 'Missing code' })

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
      console.error('[Wix OAuth] token exchange failed:', tokenData)
      return res.redirect(`${APP_URL}/dashboard/wix?error=token_failed`)
    }

    const accessToken  = tokenData.access_token
    const refreshToken = tokenData.refresh_token

    // 2. Get site info
    const siteRes = await fetch('https://www.wixapis.com/site-properties/v4/properties', {
      headers: { Authorization: accessToken },
    })
    const siteData = await siteRes.json()
    const siteName = siteData?.properties?.find((p: { name: string }) => p.name === 'siteName')?.value || 'Wix Store'
    const siteUrl  = siteData?.properties?.find((p: { name: string }) => p.name === 'url')?.value || ''

    // 3. Get instance info (identifies which site/user)
    const instanceRes = await fetch('https://www.wixapis.com/apps/v1/instance', {
      headers: { Authorization: accessToken },
    })
    const instanceData = await instanceRes.json()
    const wixInstanceId = instanceData?.instance?.instanceId || instanceId || uuidv4()
    const ownerId = instanceData?.site?.ownerInfo?.uid || ''

    const db = supabaseAdmin()

    // 4. Save Wix installation to DB
    await db.from('wix_installations').upsert({
      id:            uuidv4(),
      wix_instance_id: wixInstanceId,
      owner_id:      ownerId,
      access_token:  accessToken,
      refresh_token: refreshToken,
      site_name:     siteName,
      site_url:      siteUrl,
      installed_at:  new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'wix_instance_id' })

    // 5. Register webhooks on Wix for this installation
    await registerWixWebhooks(accessToken, wixInstanceId)

    // 6. Redirect to Wix completion URL
    return res.redirect(`https://www.wix.com/installer/close-window?access_token=${accessToken}`)

  } catch (err: unknown) {
    console.error('[Wix OAuth callback] error:', err)
    return res.redirect(`${APP_URL}/dashboard/wix?error=install_failed`)
  }
}

async function registerWixWebhooks(accessToken: string, instanceId: string): Promise<void> {
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
      console.error(`[Wix] failed to register webhook ${ev.topic}:`, e)
    }
  }
}
