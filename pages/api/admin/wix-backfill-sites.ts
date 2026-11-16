import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'

// Admin-only: backfill site_name/site_url for Wix installations that have
// access_tokens but no site info. Call once from Dashboard → Admin.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  const db = supabaseAdmin()
  const { data: installs } = await db
    .from('wix_installations')
    .select('wix_instance_id, access_token, site_name')
    .is('site_name', null)

  if (!installs?.length) return res.status(200).json({ message: 'Nothing to backfill', updated: 0 })

  let updated = 0
  const results: any[] = []

  for (const inst of installs) {
    if (!inst.access_token) {
      results.push({ id: inst.wix_instance_id, status: 'skipped - no access_token' })
      continue
    }

    try {
      // Try Wix Instance API
      const r = await fetch('https://www.wixapis.com/apps/v1/instance', {
        headers: { Authorization: inst.access_token },
      })
      if (r.ok) {
        const d = await r.json()
        const siteName = d?.site?.siteDisplayName || d?.instance?.appName || ''
        const siteUrl  = d?.site?.url || ''
        if (siteName || siteUrl) {
          await db.from('wix_installations').update({
            site_name: siteName || null,
            site_url:  siteUrl  || null,
            updated_at: new Date().toISOString(),
          }).eq('wix_instance_id', inst.wix_instance_id)
          updated++
          results.push({ id: inst.wix_instance_id, status: 'ok', siteName, siteUrl })
          continue
        }
      }
      results.push({ id: inst.wix_instance_id, status: `api ${r.status}` })
    } catch (e: any) {
      console.error('[wix-backfill] error:', e?.message)
      results.push({ id: inst.wix_instance_id, status: 'error', error: 'failed' })
    }
  }

  return res.status(200).json({ message: `Backfilled ${updated}/${installs.length}`, updated, results })
}
