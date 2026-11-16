import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { GRAPH_BASE_URL } from '@/lib/whatsapp'
import { checkInstanceCreateAllowed } from '@/lib/wa-smart-send'
import { createMetaOAuthState, readMetaOAuthState, updateMetaOAuthState, consumeMetaOAuthState } from '@/lib/meta-oauth'
import { v4 as uuidv4 } from 'uuid'

const isGraphId = (v: unknown) => typeof v === 'string' && /^\d{1,30}$/.test(v)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  // ── GET: return App ID + one-time state token ──────────────────
  if (req.method === 'GET') {
    const appId    = process.env.META_APP_ID
    if (!appId) return res.status(500).json({ error: 'META_APP_ID not configured in Netlify env vars' })
    const configId = process.env.META_CONFIG_ID || ''

    const limit = await checkInstanceCreateAllowed(user.userId)
    if (!limit.allowed) return res.status(403).json({ error: limit.error, code: 'PLAN_LIMIT' })

    const oauthState = await createMetaOAuthState({ userId: user.userId, source: 'dashboard' })
    return res.status(200).json({ appId, configId, oauthState })
  }

  // ── PUT: save phone_number_id + waba_id from Embedded Signup session ──
  // Called when Embedded Signup completes (before OAuth redirect)
  if (req.method === 'PUT') {
    const { oauthState, phoneNumberId, wabaId } = req.body || {}
    if (!oauthState) return res.status(400).json({ error: 'oauthState required' })

    const existing = await readMetaOAuthState(oauthState, user.userId)
    if (!existing) return res.status(404).json({ error: 'State not found' })
    await updateMetaOAuthState(oauthState, {
      phoneNumberId: isGraphId(phoneNumberId) ? phoneNumberId : '',
      wabaId: isGraphId(wabaId) ? wabaId : '',
    })
    return res.status(200).json({ success: true })
  }

  // ── POST: exchange code + save instance (from FB.login) ──
  if (req.method === 'POST') {
    const { code, oauthState, access_token, phone_number_id, waba_id, display_name } = req.body || {}

    const appId     = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET

    const limit = await checkInstanceCreateAllowed(user.userId)
    if (!limit.allowed) return res.status(403).json({ error: limit.error, code: 'PLAN_LIMIT' })

    let finalToken    = typeof access_token === 'string' ? access_token : ''
    let phoneNumberId = isGraphId(phone_number_id) ? phone_number_id : ''
    let wabaId        = isGraphId(waba_id) ? waba_id : ''

    // Exchange code for token if provided
    if (code && appId && appSecret) {
      // The state must be this user's, unexpired, and is consumed here.
      const state = oauthState ? await consumeMetaOAuthState(oauthState, user.userId) : null
      if (oauthState && !state) return res.status(400).json({ error: 'Signup session expired. Please try again.' })
      if (state) {
        if (!phoneNumberId) phoneNumberId = state.phoneNumberId || ''
        if (!wabaId)        wabaId        = state.wabaId || ''
      }

      try {
        // Exchange code — use empty redirect_uri to match FB.login behavior
        const tokenRes  = await fetch(`${GRAPH_BASE_URL}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(String(code))}`)
        const tokenData = await tokenRes.json()
        if (!tokenData.access_token) {
          console.error('[meta-signup] token exchange failed:', tokenData?.error?.message)
          return res.status(400).json({ error: 'Could not complete Meta login. Please try again.' })
        }
        finalToken = tokenData.access_token

        // Long-lived token
        const llRes  = await fetch(`${GRAPH_BASE_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(finalToken)}`)
        const llData = await llRes.json()
        if (llData.access_token) finalToken = llData.access_token
      } catch (e: any) {
        console.error('[meta-signup] token exchange error:', e?.message)
        return res.status(400).json({ error: 'Could not complete Meta login. Please try again.' })
      }
    }

    if (!finalToken || !phoneNumberId) {
      return res.status(400).json({ error: 'access_token and phone_number_id are required' })
    }

    // Get phone details (also proves the token can access this number)
    let phoneNumber = '', displayNameFinal = typeof display_name === 'string' ? display_name.slice(0, 100) : 'WhatsApp Business'
    try {
      const phoneRes  = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}?fields=id,display_phone_number,verified_name`, {
        headers: { Authorization: `Bearer ${finalToken}` },
      })
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

    if (error) {
      console.error('[meta-signup] save failed:', error.message)
      return res.status(500).json({ error: 'Failed to save the WhatsApp number' })
    }
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
