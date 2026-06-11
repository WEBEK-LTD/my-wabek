import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, wix_instance } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  const appId    = process.env.META_APP_ID
  const configId = process.env.META_CONFIG_ID || ''

  if (!appId) return res.status(500).json({ error: 'META_APP_ID not configured' })

  // Store oauthState → userId mapping (same as main system)
  const db = supabaseAdmin()
  const oauthState = uuidv4()
  await db.from('system_settings').upsert({
    key:        `meta_oauth_${oauthState}`,
    value:      { userId: user_id, wixInstance: wix_instance, created_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })

  return res.status(200).json({ appId, configId, oauthState })
}
