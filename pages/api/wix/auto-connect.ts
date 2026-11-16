import { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyWixInstance, getLinkedUserId } from '@/lib/wix-auth'
import { v4 as uuidv4 } from 'uuid'

// Called by /wix-setup with the `instance` param Wix gives the app page.
// Only a correctly SIGNED Wix instance is accepted (plain instance UUIDs are
// rejected); the WABEK account is derived from the verified instance id.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { instance } = req.body || {}
  if (!instance || typeof instance !== 'string') return res.status(400).json({ error: 'instance token required' })

  const data = verifyWixInstance(instance)
  if (!data) return res.status(401).json({ error: 'Invalid or expired Wix session. Please open the app from your Wix Dashboard.' })

  const db = supabaseAdmin()
  const instanceId = data.instanceId
  const wixUid = String(data.uid || data.siteOwnerId || '')
  const vendorProductId = String(data.vendorProductId || '')

  // Already linked → that account
  const linkedUserId = await getLinkedUserId(instanceId)
  if (linkedUserId) {
    const { data: u } = await db.from('users').select('email').eq('id', linkedUserId).maybeSingle()
    return res.status(200).json({
      success: true, user_id: linkedUserId,
      email: u?.email || '', instance_id: instanceId,
      site_name: 'Wix Store', vendor_product_id: vendorProductId,
    })
  }

  // Create new WABEK account for this Wix user
  const safeUid = (wixUid || instanceId.split('-')[0]).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
  const email = `wix_${safeUid}@wix.waabek.com`

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
      // Not a usable bcrypt hash: this account can only be entered via the Wix app
      password_hash: `!wix-${randomBytes(16).toString('hex')}`,
      api_key:       `wbk_wix_${randomBytes(16).toString('hex')}`,
      role:          'user',
      is_active:     true,
      created_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    }).select('id').single()

    if (createErr || !newUser) {
      console.error('[wix auto-connect] create user error:', createErr?.message)
      return res.status(500).json({ error: 'Failed to create account' })
    }
    userId    = newId
    userEmail = email
  }

  // Save installation (never overwrite an existing owner) + link
  const { data: install } = await db.from('wix_installations').select('id, owner_id').eq('wix_instance_id', instanceId).maybeSingle()
  if (!install) {
    await db.from('wix_installations').insert({
      id:              uuidv4(),
      wix_instance_id: instanceId,
      owner_id:        userId,
      installed_at:    new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    })
  }

  await db.from('wix_user_links').upsert({
    user_id: userId, wix_instance_id: instanceId,
    connected_at: new Date().toISOString(),
  }, { onConflict: 'user_id,wix_instance_id' })

  // Try to fetch site name/URL from Wix API and save them
  try {
    const { data: inst } = await db.from('wix_installations')
      .select('access_token').eq('wix_instance_id', instanceId).maybeSingle()
    const token = inst?.access_token
    if (token) {
      const siteRes = await fetch('https://www.wixapis.com/site-properties/v4/properties', {
        headers: { Authorization: token },
      })
      if (siteRes.ok) {
        const siteData = await siteRes.json()
        const siteName = siteData?.properties?.name || siteData?.site?.displayName || ''
        const siteUrl  = siteData?.properties?.url  || ''
        if (siteName || siteUrl) {
          await db.from('wix_installations').update({
            site_name: siteName || null,
            site_url:  siteUrl  || null,
            updated_at: new Date().toISOString(),
          }).eq('wix_instance_id', instanceId)
        }
      }
    }
  } catch (e: any) {
    console.log('[wix auto-connect] site info fetch failed:', e?.message)
  }

  return res.status(200).json({
    success: true, user_id: userId,
    email: userEmail, instance_id: instanceId,
    site_name: 'Wix Store',
    vendor_product_id: vendorProductId,
  })
}
