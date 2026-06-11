import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// Link existing WABEK account to a Wix instance
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return

  const { wix_instance_id } = req.body
  if (!wix_instance_id) return res.status(400).json({ error: 'wix_instance_id required' })

  const db = supabaseAdmin()

  // Check if already linked to another account
  const { data: existing } = await db
    .from('wix_user_links')
    .select('user_id')
    .eq('wix_instance_id', wix_instance_id)
    .maybeSingle()

  if (existing && existing.user_id !== user.userId) {
    return res.status(409).json({ error: 'This Wix store is already linked to another account' })
  }

  // Upsert link
  await db.from('wix_installations').upsert({
    wix_instance_id,
    owner_id:    user.userId,
    updated_at:  new Date().toISOString(),
    installed_at: new Date().toISOString(),
  }, { onConflict: 'wix_instance_id' })

  await db.from('wix_user_links').upsert({
    user_id:         user.userId,
    wix_instance_id,
    connected_at:    new Date().toISOString(),
  }, { onConflict: 'user_id,wix_instance_id' })

  return res.status(200).json({ success: true })
}
