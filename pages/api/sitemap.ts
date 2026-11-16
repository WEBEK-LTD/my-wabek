import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { docsSitemapPaths } from '@/components/docs/lib/manifest'

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/features', priority: '0.9', changefreq: 'weekly' },
  { path: '/integrations', priority: '0.9', changefreq: 'weekly' },
  { path: '/pricing', priority: '0.9', changefreq: 'weekly' },
  { path: '/about', priority: '0.7', changefreq: 'monthly' },
  { path: '/support', priority: '0.8', changefreq: 'weekly' },
  { path: '/blog', priority: '0.8', changefreq: 'daily' },
  { path: '/blog/whatsapp-automation-guide-2026', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whatsapp-chatbot-setup-2026', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/ai-whatsapp-replies-2026', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whatsapp-bulk-campaigns-2026', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whatsapp-cloud-api-vs-web-2026', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whatsapp-reseller-business-2026', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whmcs-whatsapp-integration-2026', priority: '0.8', changefreq: 'monthly' },
  { path: '/legal/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/legal/terms', priority: '0.3', changefreq: 'yearly' },
  { path: '/legal/license', priority: '0.2', changefreq: 'yearly' },
  // Public documentation (Arabic + English), from content/docs/manifest.json
  ...docsSitemapPaths(),
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get canonical domain from DB settings
    const db = supabaseAdmin()
    const { data } = await db
      .from('system_settings')
      .select('value')
      .eq('key', 'seo_settings')
      .maybeSingle()

    const seoSettings = (data?.value as any) || {}
    const baseUrl = (seoSettings.canonical || process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com').replace(/\/$/, '')
    const now = new Date().toISOString().split('T')[0]

    const urlEntries = STATIC_PAGES.map(page => `
  <url>
    <loc>${baseUrl}${page.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urlEntries}
</urlset>`

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    res.status(200).send(xml)
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate sitemap' })
  }
}
