import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { GRAPH_BASE_URL, GRAPH_SUBSCRIBE_BASE_URL } from '@/lib/whatsapp'
import { consumeMetaOAuthState } from '@/lib/meta-oauth'
import { checkInstanceCreateAllowed } from '@/lib/wa-smart-send'
import { v4 as uuidv4 } from 'uuid'

/** The WABEK account (owner id for team members) of the wabek_token cookie, or ''. */
async function cookieOwnerId(req: NextApiRequest): Promise<string> {
  const token = req.cookies?.wabek_token
  if (!token) return ''
  const p = await verifyToken(token).catch(() => null)
  if (!p?.userId) return ''
  try {
    const { data: u } = await supabaseAdmin().from('users').select('sub_account_of').eq('id', p.userId).maybeSingle()
    if (u?.sub_account_of) return u.sub_account_of
  } catch {}
  return p.userId
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const { code, error } = req.query

  if (error) return res.redirect(`${appUrl}/dashboard/instances?error=cancelled`)
  if (!code)  return res.redirect(`${appUrl}/dashboard/instances?error=no_code`)

  const appId     = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) return res.redirect(`${appUrl}/dashboard/instances?error=not_configured`)

  const db       = supabaseAdmin()
  // Only a stored, unexpired, one-time state is accepted (never a state the
  // browser made up). Dashboard states must also match the logged-in user.
  const state = await consumeMetaOAuthState(req.query.state)
  if (!state) return res.redirect(`${appUrl}/dashboard/instances?error=invalid_state`)
  const userId = state.userId
  const wixInstance = state.source === 'wix' ? (state.wixInstance || '') : ''
  const savedPhoneNumberId = state.phoneNumberId || ''
  const savedWabaId = state.wabaId || ''
  if (state.source !== 'wix') {
    const owner = await cookieOwnerId(req)
    if (!owner) return res.redirect(`${appUrl}/auth/login?redirect=/dashboard/instances`)
    if (owner !== userId) return res.redirect(`${appUrl}/dashboard/instances?error=invalid_state`)
  }
  const wixRedirect = (q: string) => `${appUrl}/wix-setup?${q}&instance=${encodeURIComponent(wixInstance)}`

  console.log(`[META OAuth] userId=${userId} source=${state.source || 'dashboard'} savedPhone=${savedPhoneNumberId} savedWaba=${savedWabaId}`)

  const limit = await checkInstanceCreateAllowed(userId)
  if (!limit.allowed) {
    return res.redirect(wixInstance ? wixRedirect('error=plan_limit') : `${appUrl}/dashboard/instances?error=plan_limit`)
  }

  try {
    const redirectUri = `${appUrl}/api/whatsapp/meta-oauth-callback`

    // 1. Exchange code for token
    console.log(`[META] step 1: exchanging code`)
    const tokenRes  = await fetch(`${GRAPH_BASE_URL}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(String(code))}`)
    const tokenData = await tokenRes.json()
    console.log(`[META] token result: ${JSON.stringify({ has_token: !!tokenData.access_token, error: tokenData.error?.message })}`)
    if (!tokenData.access_token) return res.redirect(wixInstance ? wixRedirect('error=token_exchange_failed') : `${appUrl}/dashboard/instances?error=token_exchange_failed`)

    let finalToken = tokenData.access_token

    // 2. Long-lived token
    try {
      const llRes  = await fetch(`${GRAPH_BASE_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(finalToken)}`)
      const llData = await llRes.json()
      if (llData.access_token) { finalToken = llData.access_token; console.log(`[META] got long-lived token`) }
    } catch {}

    let wabaId = savedWabaId, phoneNumberId = savedPhoneNumberId, phoneNumber = '', displayName = ''

    // 3. If we have phoneNumberId from Embedded Signup, get phone details directly
    if (phoneNumberId) {
      try {
        const phoneRes  = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}?fields=id,display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${finalToken}` } })
        const phoneData = await phoneRes.json()
        console.log(`[META] phone direct:`, JSON.stringify(phoneData).slice(0, 200))
        if (phoneData?.id) {
          phoneNumber  = phoneData.display_phone_number || ''
          displayName  = phoneData.verified_name || phoneNumber
        }
      } catch {}
    }

    // 4. If no phoneNumberId, try to get via WABA
    if (!phoneNumberId && wabaId) {
      try {
        const phoneRes  = await fetch(`${GRAPH_BASE_URL}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${finalToken}` } })
        const phoneData = await phoneRes.json()
        console.log(`[META] phones via WABA:`, JSON.stringify(phoneData).slice(0, 200))
        const first = phoneData?.data?.[0]
        if (first?.id) {
          phoneNumberId = first.id
          phoneNumber   = first.display_phone_number || ''
          displayName   = first.verified_name || phoneNumber
        }
      } catch {}
    }

    // 5. Fallback: try all methods to get WABA
    if (!wabaId) {
      // Try /me/whatsapp_business_accounts
      try {
        const r = await fetch(`${GRAPH_BASE_URL}/me/whatsapp_business_accounts`, { headers: { Authorization: `Bearer ${finalToken}` } })
        const d = await r.json()
        wabaId = d?.data?.[0]?.id || ''
        console.log(`[META] waba direct:`, wabaId)
      } catch {}

      // Try via businesses
      if (!wabaId) {
        try {
          const bizRes  = await fetch(`${GRAPH_BASE_URL}/me/businesses`, { headers: { Authorization: `Bearer ${finalToken}` } })
          const bizData = await bizRes.json()
          const bizId   = bizData?.data?.[0]?.id || ''
          if (bizId) {
            const wabaRes  = await fetch(`${GRAPH_BASE_URL}/${bizId}/owned_whatsapp_business_accounts`, { headers: { Authorization: `Bearer ${finalToken}` } })
            const wabaData = await wabaRes.json()
            wabaId = wabaData?.data?.[0]?.id || ''
            console.log(`[META] wabaId via biz=${wabaId}`)
          }
        } catch {}
      }

      // Get phone via WABA
      if (wabaId && !phoneNumberId) {
        try {
          const phoneRes  = await fetch(`${GRAPH_BASE_URL}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${finalToken}` } })
          const phoneData = await phoneRes.json()
          const first = phoneData?.data?.[0]
          if (first?.id) {
            phoneNumberId = first.id
            phoneNumber   = first.display_phone_number || ''
            displayName   = first.verified_name || phoneNumber
          }
        } catch {}
      }
    }

    console.log(`[META] final: wabaId=${wabaId} phoneNumberId=${phoneNumberId} phoneNumber=${phoneNumber}`)

    // 5b. Subscribe our App to this WABA's webhooks. Without this, Meta will
    // NOT send inbound message/status webhooks for this account at all —
    // the webhook URL/verify-token config in the App Dashboard is separate
    // from this per-WABA subscription, and Embedded Signup does not do it
    // automatically.
    if (wabaId) {
      try {
        const subRes  = await fetch(`${GRAPH_SUBSCRIBE_BASE_URL}/${wabaId}/subscribed_apps`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${finalToken}` },
        })
        const subData = await subRes.json()
        console.log(`[META] subscribed_apps:`, JSON.stringify(subData).slice(0, 200))
      } catch (e: any) {
        console.error(`[META] subscribed_apps FAILED:`, e?.message)
      }
    }

    // 6. Save instance
    console.log(`[META] step 6: saving instance userId=${userId}`)
    const { error: dbErr } = await db.from('whatsapp_instances').insert({
      id:              uuidv4(),
      user_id:         userId,
      display_name:    displayName || 'WhatsApp Business',
      phone_number:    phoneNumber,
      phone_number_id: phoneNumberId,
      waba_id:         wabaId || null,
      access_token:    finalToken,
      instance_type:   'cloud_api',
      status:          phoneNumberId ? 'connected' : 'pending',
    })

    if (dbErr) {
      console.error(`[META] DB error: ${dbErr.message}`)
      return res.redirect(wixInstance ? wixRedirect('error=save_failed') : `${appUrl}/dashboard/instances?error=save_failed`)
    }

    console.log(`[META] SUCCESS ✅`)
    if (wixInstance) return res.redirect(wixRedirect('connected=1'))
    return res.redirect(`${appUrl}/dashboard/instances?success=connected`)

  } catch (err: unknown) {
    console.error('[META] callback error:', err)
    if (wixInstance) return res.redirect(wixRedirect('error=connection_failed'))
    return res.redirect(`${appUrl}/dashboard/instances?error=connection_failed`)
  }
}
