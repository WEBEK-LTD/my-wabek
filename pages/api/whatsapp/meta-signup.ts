import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  // ── GET: return App ID + one-time state token ──────────────────
  if (req.method === 'GET') {
    const appId    = process.env.META_APP_ID
    if (!appId) return res.status(500).json({ error: 'META_APP_ID not configured in Netlify env vars' })
    const configId = process.env.META_CONFIG_ID || ''

    const db = supabaseAdmin()
    const oauthState = uuidv4()
    await db.from('system_settings').upsert({
      key:        `meta_oauth_${oauthState}`,
      value:      { userId: user.userId, created_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

    return res.status(200).json({ appId, configId, oauthState })
  }

  // ── PUT: save phone_number_id + waba_id from Embedded Signup session ──
  // Called when Embedded Signup completes (before OAuth redirect)
  if (req.method === 'PUT') {
    const { oauthState, phoneNumberId, wabaId } = req.body
    if (!oauthState) return res.status(400).json({ error: 'oauthState required' })

    const db = supabaseAdmin()
    const { data: existing } = await db.from('system_settings').select('value').eq('key', `meta_oauth_${oauthState}`).single()
    
    if (existing?.value) {
      const updated = { ...(existing.value as object), phoneNumberId: phoneNumberId || '', wabaId: wabaId || '' }
      await db.from('system_settings').update({ value: updated, updated_at: new Date().toISOString() }).eq('key', `meta_oauth_${oauthState}`)
      return res.status(200).json({ success: true })
    }
    return res.status(404).json({ error: 'State not found' })
  }

  // ── POST: exchange code + save instance (from FB.login) ──
  if (req.method === 'POST') {
    const { code, oauthState, redirectUri, access_token, phone_number_id, waba_id, display_name } = req.body

    const appId     = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET

    let finalToken  = access_token || ''
    let phoneNumberId = phone_number_id || ''
    let wabaId      = waba_id || ''

    // Exchange code for token if provided
    if (code && appId && appSecret) {
      try {
        // Get saved phone_number_id from state
        const db2 = supabaseAdmin()
        if (oauthState) {
          const { data: stateRec } = await db2.from('system_settings').select('value').eq('key', `meta_oauth_${oauthState}`).single()
          if (stateRec?.value) {
            const v = stateRec.value as any
            if (!phoneNumberId) phoneNumberId = v.phoneNumberId || ''
            if (!wabaId)        wabaId        = v.wabaId || ''
            await db2.from('system_settings').delete().eq('key', `meta_oauth_${oauthState}`)
          }
        }

        // Exchange code — use empty redirect_uri to match FB.login behavior
        const tokenRes  = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`)
        const tokenData = await tokenRes.json()
        if (!tokenData.access_token) return res.status(400).json({ error: tokenData.error?.message || 'token_exchange_failed' })
        finalToken = tokenData.access_token

        // Long-lived token
        const llRes  = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${finalToken}`)
        const llData = await llRes.json()
        if (llData.access_token) finalToken = llData.access_token
      } catch (e: any) {
        return res.status(400).json({ error: e.message || 'token_exchange_failed' })
      }
    }

    if (!finalToken || !phoneNumberId) {
      return res.status(400).json({ error: 'access_token and phone_number_id are required' })
    }

    // Get phone details
    let phoneNumber = '', displayNameFinal = display_name || 'WhatsApp Business'
    try {
      const phoneRes  = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}?fields=id,display_phone_number,verified_name&access_token=${finalToken}`)
      const phoneData = await phoneRes.json()
      phoneNumber       = phoneData.display_phone_number || ''
      displayNameFinal  = phoneData.verified_name || displayNameFinal
    } catch {}

    const db = supabaseAdmin()
    const { error } = await db.from('whatsapp_instances').insert({
      id:              uuidv4(),
      user_id:         user.userId,
      display_name:    displayNameFinal,
      phone_number:    phoneNumber,
      phone_number_id: phoneNumberId,
      waba_id:         wabaId || null,
      access_token:    finalToken,
      instance_type:   'cloud_api',
      status:          'connected',
    })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
