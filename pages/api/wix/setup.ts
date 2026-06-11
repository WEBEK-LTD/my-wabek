import { NextApiRequest, NextApiResponse } from 'next'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { api_key, wix_instance_id } = req.body
  if (!api_key) return res.status(400).json({ error: 'API key required' })

  const db = supabaseAdmin()

  // Verify API key by hash
  const keyHash = createHash('sha256').update(api_key).digest('hex')
  const { data: keyRow } = await db
    .from('api_keys')
    .select('user_id, is_active')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .maybeSingle()

  if (!keyRow) return res.status(401).json({ error: 'Invalid API key. Please check and try again.' })

  const userId = keyRow.user_id

  // Save Wix installation
  if (wix_instance_id) {
    await db.from('wix_installations').upsert({
      id:              uuidv4(),
      wix_instance_id,
      owner_id:        userId,
      installed_at:    new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'wix_instance_id' })

    await db.from('wix_user_links').upsert({
      user_id:         userId,
      wix_instance_id,
      connected_at:    new Date().toISOString(),
    }, { onConflict: 'user_id,wix_instance_id' })
  }

  return res.status(200).json({ success: true, user_id: userId })
}
