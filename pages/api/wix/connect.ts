import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// WABEK user clicks "Connect Wix" → we save the link between user and Wix instance
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const db = supabaseAdmin()
    const { data } = await db
      .from('wix_user_links')
      .select('*, wix_installations(site_name, site_url, installed_at)')
      .eq('user_id', user.userId)

    return res.status(200).json({ connections: data || [] })
  }

  if (req.method === 'POST') {
    const { wix_instance_id } = req.body
    if (!wix_instance_id) return res.status(400).json({ error: 'wix_instance_id required' })

    const db = supabaseAdmin()

    // Verify the installation exists
    const { data: install } = await db
      .from('wix_installations')
      .select('id')
      .eq('wix_instance_id', wix_instance_id)
      .maybeSingle()

    if (!install) return res.status(404).json({ error: 'Wix installation not found' })

    await db.from('wix_user_links').upsert({
      user_id:          user.userId,
      wix_instance_id,
      connected_at:     new Date().toISOString(),
    }, { onConflict: 'user_id,wix_instance_id' })

    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const { wix_instance_id } = req.body
    const db = supabaseAdmin()
    await db.from('wix_user_links')
      .delete()
      .eq('user_id', user.userId)
      .eq('wix_instance_id', wix_instance_id)

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
