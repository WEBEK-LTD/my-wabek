import { NextApiRequest, NextApiResponse } from 'next'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

const APP_SECRET = process.env.WIX_APP_SECRET || 'eaf03696-cfc8-4fe0-92e6-d0e00d1f5e76'

function decodeInstance(instance: string): Record<string, unknown> | null {
  try {
    const dotIdx = instance.indexOf('.')
    if (dotIdx === -1) return null
    const payload = instance.slice(dotIdx + 1)
    return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  } catch { return null }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { instance } = req.body
  if (!instance) return res.status(400).json({ error: 'instance token required' })

  const db = supabaseAdmin()

  // Check if it's a plain UUID (from Meta OAuth callback)
  const cleanInstance = instance.split('#')[0].trim()
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanInstance)

  let instanceId = ''
  let wixUid     = ''
  let metaSiteId = ''

  if (isUUID) {
    instanceId = cleanInstance
    // Look up existing link
    const { data: existingLink } = await db
      .from('wix_user_links')
      .select('user_id')
      .eq('wix_instance_id', instanceId)
      .maybeSingle()

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

  // JWT — decode it
  const data = decodeInstance(instance)
  if (!data) return res.status(401).json({ error: 'Invalid instance token' })

  instanceId = String(data.instanceId || '')
  wixUid     = String(data.uid || data.userId || '')

  if (!instanceId) return res.status(400).json({ error: 'Missing instanceId in token' })

  // Check expiry
  const exp = data.expirationDate as string || ''
  if (exp && new Date(exp) < new Date()) {
    return res.status(401).json({ error: 'Instance token expired. Please refresh the page.' })
  }

  // Check if already linked
  const { data: existingLink } = await db
    .from('wix_user_links')
    .select('user_id')
    .eq('wix_instance_id', instanceId)
    .maybeSingle()

  if (existingLink?.user_id) {
    const { data: u } = await db.from('users').select('email').eq('id', existingLink.user_id).maybeSingle()
    return res.status(200).json({
      success: true, user_id: existingLink.user_id,
      email: u?.email || '', instance_id: instanceId,
      site_name: 'Wix Store', session_token: instanceId,
    })
  }

  // Create new WABEK account for this Wix user
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
      name:          'Wix User',
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
    meta_site_id:    metaSiteId || null,
    installed_at:    new Date().toISOString(),
    updated_at:      new Date().toISOString(),
  }, { onConflict: 'wix_instance_id' })

  await db.from('wix_user_links').upsert({
    user_id: userId, wix_instance_id: instanceId,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id,wix_instance_id' })

  // Try to fetch site name via Wix Instance API using the raw instance JWT.
  // This is available in the auto-connect flow (unlike the OAuth access_token).
  // We use it to populate site_name for the Connected Stores display.
  try {
    const rawInstance = req.body?.instance || ''
    const instanceRes = await fetch('https://www.wixapis.com/apps/v1/instance', {
      headers: { Authorization: `Bearer ${rawInstance}` },
    })
    if (instanceRes.ok) {
      const instanceData = await instanceRes.json()
      const siteName = instanceData?.site?.siteDisplayName || instanceData?.instance?.appName || ''
      const siteUrl  = instanceData?.site?.url || ''
      if (siteName || siteUrl) {
        await db.from('wix_installations').update({
          site_name:  siteName || null,
          site_url:   siteUrl  || null,
          updated_at: new Date().toISOString(),
        }).eq('wix_instance_id', instanceId)
        console.log('[wix auto-connect] site info saved:', siteName, siteUrl)
      }
    }
  } catch (e: any) {
    console.log('[wix auto-connect] site info fetch failed:', e?.message)
  }

  // Try to get vendorProductId (paid plan) from JWT
  let vendorProductId = ''
  try {
    const parts = (typeof req.body?.instance === 'string' ? req.body.instance : '').split('.')
    if (parts.length >= 2) {
      const p = JSON.parse(Buffer.from(parts[1].replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString())
      vendorProductId = p.vendorProductId || p.packageName || ''
    }
  } catch {}

  return res.status(200).json({
    success: true, user_id: userId,
    email: userEmail, instance_id: instanceId,
    site_name: 'Wix Store', session_token: instanceId,
    vendor_product_id: vendorProductId,
  })
}
