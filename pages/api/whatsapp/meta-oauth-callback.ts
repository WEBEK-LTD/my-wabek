import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyToken } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const { code, error, error_description } = req.query

  if (error) return res.redirect(`${appUrl}/dashboard/instances?error=${encodeURIComponent(error_description as string || 'cancelled')}`)
  if (!code)  return res.redirect(`${appUrl}/dashboard/instances?error=no_code`)

  const appId     = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) return res.redirect(`${appUrl}/dashboard/instances?error=META_APP_SECRET+not+configured`)

  const db       = supabaseAdmin()
  const stateStr = (req.query.state as string) || ''
  let userId = '', wixInstance = '', savedPhoneNumberId = '', savedWabaId = ''

  // Get userId + pre-saved phone_number_id/waba_id from state
  try {
    const { data: stateRecord } = await db.from('system_settings').select('value').eq('key', `meta_oauth_${stateStr}`).single()
    if (stateRecord?.value) {
      const v = stateRecord.value as { userId: string; wixInstance?: string; phoneNumberId?: string; wabaId?: string }
      userId           = v.userId || ''
      wixInstance      = v.wixInstance || ''
      savedPhoneNumberId = v.phoneNumberId || ''
      savedWabaId      = v.wabaId || ''
      await db.from('system_settings').delete().eq('key', `meta_oauth_${stateStr}`)
    }
  } catch {}

  if (!userId && stateStr) {
    try { const obj = JSON.parse(decodeURIComponent(stateStr)); userId = obj.userId || '' } catch {}
  }
  if (!userId) {
    const token = req.cookies?.auth_token
    if (token) { try { const p = await verifyToken(token); userId = p?.userId || '' } catch {} }
  }

  console.log(`[META OAuth] state=${stateStr} userId=${userId} savedPhone=${savedPhoneNumberId} savedWaba=${savedWabaId}`)
  if (!userId) return res.redirect(`${appUrl}/auth/login?redirect=/dashboard/instances`)

  try {
    const redirectUri = `${appUrl}/api/whatsapp/meta-oauth-callback`

    // 1. Exchange code for token
    console.log(`[META] step 1: exchanging code`)
    const tokenRes  = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`)
    const tokenData = await tokenRes.json()
    console.log(`[META] token result: ${JSON.stringify({ has_token: !!tokenData.access_token, error: tokenData.error?.message })}`)
    if (!tokenData.access_token) return res.redirect(`${appUrl}/dashboard/instances?error=${encodeURIComponent(tokenData.error?.message || 'token_exchange_failed')}`)

    let finalToken = tokenData.access_token

    // 2. Long-lived token
    try {
      const llRes  = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${finalToken}`)
      const llData = await llRes.json()
      if (llData.access_token) { finalToken = llData.access_token; console.log(`[META] got long-lived token`) }
    } catch {}

    let wabaId = savedWabaId, phoneNumberId = savedPhoneNumberId, phoneNumber = '', displayName = ''

    // 3. If we have phoneNumberId from Embedded Signup, get phone details directly
    if (phoneNumberId) {
      try {
        const phoneRes  = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}?fields=id,display_phone_number,verified_name&access_token=${finalToken}`)
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
        const phoneRes  = await fetch(`https://graph.facebook.com/v19.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${finalToken}`)
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
        const r = await fetch(`https://graph.facebook.com/v19.0/me/whatsapp_business_accounts?access_token=${finalToken}`)
        const d = await r.json()
        wabaId = d?.data?.[0]?.id || ''
        console.log(`[META] waba direct:`, wabaId)
      } catch {}

      // Try via businesses
      if (!wabaId) {
        try {
          const bizRes  = await fetch(`https://graph.facebook.com/v19.0/me/businesses?access_token=${finalToken}`)
          const bizData = await bizRes.json()
          const bizId   = bizData?.data?.[0]?.id || ''
          if (bizId) {
            const wabaRes  = await fetch(`https://graph.facebook.com/v19.0/${bizId}/owned_whatsapp_business_accounts?access_token=${finalToken}`)
            const wabaData = await wabaRes.json()
            wabaId = wabaData?.data?.[0]?.id || ''
            console.log(`[META] wabaId via biz=${wabaId}`)
          }
        } catch {}
      }

      // Get phone via WABA
      if (wabaId && !phoneNumberId) {
        try {
          const phoneRes  = await fetch(`https://graph.facebook.com/v19.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${finalToken}`)
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
      return res.redirect(`${appUrl}/dashboard/instances?error=${encodeURIComponent(dbErr.message)}`)
    }

    console.log(`[META] SUCCESS ✅`)
    if (wixInstance) return res.redirect(`${appUrl}/wix-setup?connected=1&instance=${wixInstance}`)
    return res.redirect(`${appUrl}/dashboard/instances?success=connected`)

  } catch (err: unknown) {
    console.error('[META] callback error:', err)
    if (wixInstance) return res.redirect(`${appUrl}/wix-setup?error=connection_failed&instance=${wixInstance}`)
    return res.redirect(`${appUrl}/dashboard/instances?error=connection_failed`)
  }
}
