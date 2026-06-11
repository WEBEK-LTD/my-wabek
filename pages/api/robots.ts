import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_ROBOTS = `User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /admin/
Disallow: /api/
Disallow: /auth/

Sitemap: https://waabek.com/sitemap.xml`

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const db = supabaseAdmin()
    const { data } = await db
      .from('system_settings')
      .select('value')
      .eq('key', 'seo_settings')
      .maybeSingle()

    const seoSettings = (data?.value as any) || {}
    const robotsTxt = seoSettings.robots_txt || DEFAULT_ROBOTS

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.status(200).send(robotsTxt)
  } catch {
    res.setHeader('Content-Type', 'text/plain')
    res.status(200).send(DEFAULT_ROBOTS)
  }
}
