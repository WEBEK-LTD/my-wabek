import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// WABEK user clicks "Connect Wix" → we save the link between user and Wix instance
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const db = supabaseAdmin()

    const { data: links } = await db
      .from('wix_user_links')
      .select('user_id, wix_instance_id, connected_at')
      .eq('user_id', user.userId)

    if (!links?.length) return res.status(200).json({ connections: [] })

    const instanceIds = links.map(l => l.wix_instance_id)
    const { data: installations } = await db
      .from('wix_installations')
      .select('wix_instance_id, site_name, site_url, installed_at, access_token')
      .in('wix_instance_id', instanceIds)

    // For any installation missing site_name, try to fetch from Wix API
    const updatedInstalls = await Promise.all((installations || []).map(async (inst) => {
      if (inst.site_name) return inst  // already have it

      // Try Wix Instance API with stored access_token
      const token = inst.access_token
      if (!token) return inst

      try {
        const r = await fetch('https://www.wixapis.com/apps/v1/instance', {
          headers: { Authorization: token },
        })
        if (r.ok) {
          const d = await r.json()
          const siteName = String(d?.site?.siteDisplayName || d?.instance?.appName || '')
          const siteUrl  = String(d?.site?.url || '')
          if (siteName || siteUrl) {
            await db.from('wix_installations').update({
              site_name: siteName || null,
              site_url:  siteUrl  || null,
              updated_at: new Date().toISOString(),
            }).eq('wix_instance_id', inst.wix_instance_id)
            return { ...inst, site_name: siteName, site_url: siteUrl }
          }
        }
      } catch {}
      return inst
    }))

    const installMap = Object.fromEntries(updatedInstalls.map(i => [i.wix_instance_id, i]))

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
