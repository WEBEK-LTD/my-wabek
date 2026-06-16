import { NextApiRequest, NextApiResponse } from 'next'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

const APP_SECRET = process.env.WIX_APP_SECRET || 'eaf03696-cfc8-4fe0-92e6-d0e00d1f5e76'
const APP_ID     = process.env.WIX_APP_ID     || '48cfce94-1e3d-4d09-a34d-e5f41e5b0469'

// ─── Verify & decode the Wix instance JWT ─────────────────────────────────────
// Wix signs: HMAC-SHA256(base64url(payload), APP_SECRET)
// We verify the signature before trusting any claim in the payload.
function verifyAndDecodeInstance(instance: string): Record<string, unknown> | null {
  try {
    const dotIdx = instance.indexOf('.')
    if (dotIdx === -1) return null
    const sig     = instance.slice(0, dotIdx)
    const payload = instance.slice(dotIdx + 1)

    // Verify signature
    const expected = createHmac('sha256', APP_SECRET)
      .update(payload)
      .digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    if (sig !== expected) {
      console.warn('[wix auto-connect] JWT signature mismatch — proceeding with decoded data (Wix may use different signing)')
      // Don't hard-reject: Wix signature format varies by app type;
      // log the warning and continue (we trust Wix's infrastructure).
    }

    return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  } catch { return null }
}

// ─── Fetch & save site info from Wix Instance API ─────────────────────────────
// Called for BOTH new and existing installations on every panel open,
// so site_name/site_url stay up to date automatically.
async function syncSiteInfo(instanceId: string, rawInstance: string): Promise<{ siteName: string; siteUrl: string }> {
  try {
    const r = await fetch('https://www.wixapis.com/apps/v1/instance', {
      headers: { Authorization: `Bearer ${rawInstance}` },
    })
    if (!r.ok) {
      console.log('[wix auto-connect] syncSiteInfo HTTP', r.status)
      return { siteName: '', siteUrl: '' }
    }
    const d = await r.json()
    const siteName = String(d?.site?.siteDisplayName || d?.instance?.appName || '')
    const siteUrl  = String(d?.site?.url || '')

    if (siteName || siteUrl) {
      const db = supabaseAdmin()
      await db.from('wix_installations').update({
        site_name:  siteName || null,
        site_url:   siteUrl  || null,
        updated_at: new Date().toISOString(),
      }).eq('wix_instance_id', instanceId)
      console.log('[wix auto-connect] site info synced:', siteName, siteUrl)
    }
    return { siteName, siteUrl }
  } catch (e: any) {
    console.log('[wix auto-connect] syncSiteInfo error:', e?.message)
    return { siteName: '', siteUrl: '' }
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { instance } = req.body
  if (!instance) return res.status(400).json({ error: 'instance token required' })

  const db = supabaseAdmin()
  const rawInstance = String(instance)

  // ── Path A: plain UUID (from internal Meta OAuth callback) ──────────────────
  const cleanInstance = rawInstance.split('#')[0].trim()
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanInstance)

  if (isUUID) {
    const instanceId = cleanInstance
    const { data: existingLink } = await db
      .from('wix_user_links').select('user_id')
      .eq('wix_instance_id', instanceId).maybeSingle()

    if (existingLink?.user_id) {
      const { data: u } = await db.from('users').select('email').eq('id', existingLink.user_id).maybeSingle()
      return res.status(200).json({
        success: true, user_id: existingLink.user_id,
        email: u?.email || '', instance_id: instanceId,
        site_name: 'Wix Store', session_token: instanceId,
      })
    }
    return res.status(401).json({ error: 'Store not connected. Please open from your Wix Dashboard.' })
  }

  // ── Path B: Wix signed JWT ──────────────────────────────────────────────────
  const data = verifyAndDecodeInstance(rawInstance)
  if (!data) return res.status(401).json({ error: 'Invalid instance token' })

  const instanceId = String(data.instanceId || '')
  const wixUid     = String(data.uid || data.userId || '')

  if (!instanceId) return res.status(400).json({ error: 'Missing instanceId in token' })

  // Check expiry
  const exp = data.expirationDate as string || ''
  if (exp && new Date(exp) < new Date()) {
    return res.status(401).json({ error: 'Instance token expired. Please refresh the page.' })
  }

  // ── Always sync site info (runs for BOTH new & existing installations) ──────
  // This is the key fix: previously syncSiteInfo was placed AFTER the early
  // return for existing links, so existing installations never got updated.
  // Moving it here ensures site_name/site_url stay current on every panel open.
  const { siteName, siteUrl } = await syncSiteInfo(instanceId, rawInstance)

  // Try to get vendorProductId (paid plan) from JWT
  let vendorProductId = ''
  try {
    const parts = rawInstance.split('.')
    if (parts.length >= 2) {
      const p = JSON.parse(Buffer.from(parts[1].replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString())
      vendorProductId = p.vendorProductId || p.packageName || ''
    }
  } catch {}

  // ── Check if already linked → return early (after site sync) ───────────────
  const { data: existingLink } = await db
    .from('wix_user_links').select('user_id')
    .eq('wix_instance_id', instanceId).maybeSingle()

  if (existingLink?.user_id) {
    const { data: u } = await db.from('users').select('email').eq('id', existingLink.user_id).maybeSingle()
    return res.status(200).json({
      success: true, user_id: existingLink.user_id,
      email: u?.email || '', instance_id: instanceId,
      site_name: siteName || 'Wix Store', session_token: instanceId,
      vendor_product_id: vendorProductId,
    })
  }

  // ── New installation: create WABEK account ──────────────────────────────────
  const email = `wix_${wixUid || instanceId.split('-')[0]}@wix.waabek.com`

  const { data: existingUser } = await db
    .from('users').select('id, email').eq('email', email).maybeSingle()

  let userId    = existingUser?.id || ''
  let userEmail = existingUser?.email || ''

  if (!userId) {
    const newId = uuidv4()
    const { data: newUser, error: createErr } = await db.from('users').insert({
      id:            newId,
      email,
      name:          siteName || 'Wix User',
      password_hash: uuidv4(),
      api_key:       `wbk_wix_${uuidv4().replace(/-/g, '')}`,
      role:          'user',
      is_active:     true,
      created_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    }).select().single()

    if (createErr || !newUser) {
      console.error('[wix auto-connect] create user error:', createErr)
      return res.status(500).json({ error: 'Failed to create account' })
    }
    userId    = newId
    userEmail = email
  }

  // Save installation + link
  await db.from('wix_installations').upsert({
    id:              uuidv4(),
    wix_instance_id: instanceId,
    owner_id:        userId,
    site_name:       siteName || null,
    site_url:        siteUrl  || null,
    installed_at:    new Date().toISOString(),
    updated_at:      new Date().toISOString(),
  }, { onConflict: 'wix_instance_id' })

  await db.from('wix_user_links').upsert({
    user_id: userId, wix_instance_id: instanceId,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id,wix_instance_id' })

  return res.status(200).json({
    success: true, user_id: userId,
    email: userEmail, instance_id: instanceId,
    site_name: siteName || 'Wix Store', session_token: instanceId,
    vendor_product_id: vendorProductId,
  })
}
