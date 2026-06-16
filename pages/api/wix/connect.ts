import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// WABEK user clicks "Connect Wix" → we save the link between user and Wix instance
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const db = supabaseAdmin()

    // Get all links for this user
    const { data: links } = await db
      .from('wix_user_links')
      .select('user_id, wix_instance_id, connected_at')
      .eq('user_id', user.userId)

    if (!links?.length) return res.status(200).json({ connections: [] })

    // Manually join wix_installations (no FK exists → PostgREST can't do it automatically)
    const instanceIds = links.map(l => l.wix_instance_id)
    const { data: installations } = await db
      .from('wix_installations')
      .select('wix_instance_id, site_name, site_url, installed_at')
      .in('wix_instance_id', instanceIds)

    const installMap = Object.fromEntries((installations || []).map(i => [i.wix_instance_id, i]))

    const connections = links.map(link => ({
      ...link,
      wix_installations: installMap[link.wix_instance_id] || null,
    }))

    return res.status(200).json({ connections })
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
