// @ts-nocheck
import { GetServerSideProps } from 'next'
import { docsSitemapPaths } from '@/components/docs/lib/manifest'

const BASE_URL = 'https://waabek.com'

const STATIC_PAGES = [
  { url: '/', priority: '1.0', changefreq: 'weekly' },
  { url: '/auth/login', priority: '0.8', changefreq: 'monthly' },
  { url: '/auth/register', priority: '0.9', changefreq: 'monthly' },
  { url: '/auth/forgot-password', priority: '0.3', changefreq: 'yearly' },
  { url: '/blog', priority: '0.9', changefreq: 'weekly' },
  { url: '/blog/whatsapp-automation-guide-2026', priority: '0.8', changefreq: 'monthly' },
  { url: '/blog/whatsapp-chatbot-setup-2026', priority: '0.8', changefreq: 'monthly' },
  { url: '/blog/ai-whatsapp-replies-2026', priority: '0.8', changefreq: 'monthly' },
  { url: '/blog/whatsapp-bulk-campaigns-2026', priority: '0.7', changefreq: 'monthly' },
  { url: '/blog/whatsapp-cloud-api-vs-web-2026', priority: '0.7', changefreq: 'monthly' },
  { url: '/blog/whatsapp-reseller-business-2026', priority: '0.7', changefreq: 'monthly' },
  { url: '/blog/whmcs-whatsapp-integration-2026', priority: '0.7', changefreq: 'monthly' },
  { url: '/legal/terms', priority: '0.5', changefreq: 'monthly' },
  { url: '/legal/privacy', priority: '0.5', changefreq: 'monthly' },
  { url: '/legal/refund', priority: '0.4', changefreq: 'monthly' },
  { url: '/legal/accessibility', priority: '0.3', changefreq: 'yearly' },
  // Public documentation (Arabic + English), from content/docs/manifest.json
  ...docsSitemapPaths().map(p => ({ url: p.path, priority: p.priority, changefreq: p.changefreq })),
]

function generateSitemap(pages: typeof STATIC_PAGES): string {
  const today = new Date().toISOString().split('T')[0]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${pages.map(p => `  <url>
    <loc>${BASE_URL}${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const sitemap = generateSitemap(STATIC_PAGES)
  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.write(sitemap)
  res.end()
  return { props: {} }
}

export default function Sitemap() { return null }
