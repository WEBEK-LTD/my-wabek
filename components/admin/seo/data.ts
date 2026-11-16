// Static SEO reference data (moved out of pages/admin/seo.tsx).

export interface PublicPage { path: string; label: string; priority: string; changefreq: string }

export const PUBLIC_PAGES: PublicPage[] = [
  { path: '/', label: 'Homepage', priority: '1.0', changefreq: 'daily' },
  { path: '/features', label: 'Features', priority: '0.9', changefreq: 'weekly' },
  { path: '/integrations', label: 'Integrations', priority: '0.9', changefreq: 'weekly' },
  { path: '/pricing', label: 'Pricing', priority: '0.9', changefreq: 'weekly' },
  { path: '/about', label: 'About Us', priority: '0.7', changefreq: 'monthly' },
  { path: '/support', label: 'Support', priority: '0.8', changefreq: 'weekly' },
  { path: '/blog', label: 'Blog Index', priority: '0.8', changefreq: 'daily' },
  { path: '/blog/whatsapp-automation-guide-2026', label: 'Blog: Automation Guide', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whatsapp-chatbot-setup-2026', label: 'Blog: Chatbot Setup', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/ai-whatsapp-replies-2026', label: 'Blog: AI Replies', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whatsapp-bulk-campaigns-2026', label: 'Blog: Bulk Campaigns', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whatsapp-cloud-api-vs-web-2026', label: 'Blog: Cloud API vs Web', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whatsapp-reseller-business-2026', label: 'Blog: Reseller Business', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whmcs-whatsapp-integration-2026', label: 'Blog: WHMCS Integration', priority: '0.8', changefreq: 'monthly' },
  { path: '/legal/privacy', label: 'Privacy Policy', priority: '0.3', changefreq: 'yearly' },
  { path: '/legal/terms', label: 'Terms of Service', priority: '0.3', changefreq: 'yearly' },
  { path: '/legal/license', label: 'License', priority: '0.2', changefreq: 'yearly' },
]

/** Keyword targets. Volume/difficulty are manual estimates, not live data. */
export const KEYWORD_DATA = [
  { kw: 'WhatsApp automation platform', vol: 4400, diff: 42, page: '/' },
  { kw: 'WhatsApp business automation', vol: 3600, diff: 38, page: '/' },
  { kw: 'automate WhatsApp messages', vol: 2900, diff: 35, page: '/' },
  { kw: 'WhatsApp chatbot builder', vol: 2400, diff: 45, page: '/features' },
  { kw: 'WhatsApp bulk messaging', vol: 3600, diff: 40, page: '/features' },
  { kw: 'WhatsApp AI auto reply', vol: 1900, diff: 33, page: '/features' },
  { kw: 'WhatsApp team inbox', vol: 720, diff: 28, page: '/features' },
  { kw: 'WhatsApp automation pricing', vol: 880, diff: 30, page: '/pricing' },
  { kw: 'WhatsApp business API cost', vol: 1300, diff: 36, page: '/pricing' },
  { kw: 'WhatsApp automation guide 2026', vol: 2200, diff: 25, page: '/blog' },
  { kw: 'how to automate WhatsApp', vol: 1800, diff: 28, page: '/blog' },
  { kw: 'Wix WhatsApp integration', vol: 1100, diff: 22, page: '/integrations' },
  { kw: 'WordPress WhatsApp plugin', vol: 2800, diff: 32, page: '/integrations' },
  { kw: 'WHMCS WhatsApp notifications', vol: 590, diff: 18, page: '/integrations' },
  { kw: 'WhatsApp reseller business', vol: 480, diff: 20, page: '/blog' },
]

export const LONGTAIL = [
  'how to send bulk whatsapp messages without ban',
  'whatsapp business chatbot free',
  'whatsapp automation for woocommerce',
  'whatsapp otp verification integration',
  'best whatsapp marketing tool 2026',
  'whatsapp cloud api tutorial',
  'white label whatsapp platform',
  'whmcs whatsapp notifications setup',
  'whatsapp abandoned cart recovery',
  'zapier whatsapp integration',
]

export const SCHEMA_TEMPLATES: Record<string, string> = {
  Organization: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "WABEK",
  "url": "https://waabek.com",
  "logo": "https://waabek.com/logo.png",
  "sameAs": [],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "availableLanguage": ["English", "Arabic", "French", "Turkish"]
  }
}`,
  SoftwareApplication: `{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "WABEK",
  "applicationCategory": "BusinessApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "operatingSystem": "Web"
}`,
  WebSite: `{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "WABEK",
  "url": "https://waabek.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://waabek.com/blog?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}`,
  FAQPage: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is WABEK?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "WABEK is an all-in-one WhatsApp Business platform..."
    }
  }]
}`,
}

export const OG_TEMPLATES: Record<string, { title: string; desc: string; type: string }> = {
  homepage: { title: 'WABEK — WhatsApp Business Automation Platform', desc: 'Send bulk campaigns, build AI chatbots, manage team inbox, and automate WhatsApp. Integrates with Wix, WordPress, WHMCS and more.', type: 'website' },
  features: { title: 'All WhatsApp Business Features — WABEK', desc: 'Bulk campaigns, AI auto-reply, team inbox, chatbot builder, analytics and more. Everything for WhatsApp automation.', type: 'website' },
  pricing: { title: 'WhatsApp Automation Pricing — WABEK', desc: 'Free plan available. No hidden fees. Start free and scale as you grow.', type: 'website' },
  blog: { title: 'WhatsApp Business Blog — WABEK', desc: 'Tutorials, guides, and best practices for WhatsApp automation and business growth.', type: 'website' },
}

export const DEFAULT_TRACKING = [
  { kw: 'WhatsApp automation platform', target: '/', tracked: true },
  { kw: 'WhatsApp chatbot builder', target: '/features', tracked: true },
  { kw: 'WhatsApp bulk messaging', target: '/features', tracked: true },
  { kw: 'WhatsApp automation pricing', target: '/pricing', tracked: true },
  { kw: 'WordPress WhatsApp plugin', target: '/integrations', tracked: true },
  { kw: 'WHMCS WhatsApp notifications', target: '/integrations', tracked: true },
]

/** Competitor seed list. Figures are rough manual estimates (labelled as such in the UI). */
export const DEFAULT_COMPETITORS = [
  { domain: 'wati.io', name: 'WATI', da: 42, traffic: 85000, keywords: 1200, backlinks: 3400 },
  { domain: 'respond.io', name: 'Respond.io', da: 55, traffic: 210000, keywords: 3800, backlinks: 8900 },
  { domain: 'manychat.com', name: 'ManyChat', da: 68, traffic: 980000, keywords: 12000, backlinks: 42000 },
  { domain: 'twilio.com', name: 'Twilio', da: 88, traffic: 5200000, keywords: 85000, backlinks: 320000 },
]

export const DEFAULT_REDIRECTS = [
  { from: '/home', to: '/', type: '301', active: true },
  { from: '/whatsapp-automation', to: '/features', type: '301', active: true },
  { from: '/contact', to: '/support', type: '302', active: true },
]

export const DEFAULT_FORM = {
  site_title: 'WABEK — WhatsApp Business Automation Platform',
  title_template: '%page% | WABEK',
  site_description: 'Send bulk campaigns, build AI chatbots, manage a shared team inbox, and automate WhatsApp messages. Integrates with Wix, WordPress, WHMCS and more.',
  focus_kw: 'WhatsApp automation, WhatsApp business platform, WhatsApp chatbot',
  canonical: 'https://waabek.com',
  og_image: 'https://waabek.com/og-image.jpg',
  twitter_handle: '@waabek',
  ga_id: '',
  gsc_verify: '',
  fb_pixel: '',
  hotjar_id: '',
  robots_txt: 'User-agent: *\nAllow: /\nDisallow: /dashboard/\nDisallow: /admin/\nDisallow: /api/\nSitemap: https://waabek.com/sitemap.xml',
  custom_head: '',
  redirect_www: true,
  force_https: true,
  index_site: true,
}

export const NETLIFY_HEADERS = `[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Cache-Control = "public, max-age=3600"

[[headers]]
  for = "/sitemap.xml"
  [headers.values]
    Content-Type = "application/xml"`

export const NETLIFY_HEADERS_COPY = `[[headers]]\n  for = "/*"\n  [headers.values]\n    X-Frame-Options = "SAMEORIGIN"\n    Cache-Control = "public, max-age=3600"`
