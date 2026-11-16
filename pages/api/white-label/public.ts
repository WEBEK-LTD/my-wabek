import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

const LEGACY_LOGO = /res\.cloudinary\.com\/dkl7ntpgw\//
/** Official logo as an absolute URL (this response is also read by plugins on other origins). */
const defaultLogo = () => `${(process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com').replace(/\/+$/, '')}/brand/logo-mark.png`
const notLegacy = (v: unknown) => (typeof v === 'string' && v && !LEGACY_LOGO.test(v) ? v : null)

// Public endpoint - no auth needed
// Returns white label settings for a given domain
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const domain = (req.query.domain as string) || req.headers.host || ''
  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0]

  const db = supabaseAdmin()

  // For main domain — return global brand settings from admin
  const mainDomains = ['waabek.com', 'www.waabek.com', 'localhost', '127.0.0.1']
  if (mainDomains.some(d => cleanDomain === d || cleanDomain.endsWith('.' + d))) {
    const { data: brandRow } = await db
      .from('system_settings')
      .select('value')
      .eq('key', 'brand_settings')
      .maybeSingle()

    if (brandRow?.value) {
      const brand = brandRow.value as any
      const settings = {
        brand_name:  brand.app_name || null,
        brand_logo:  notLegacy(brand.logo_url) || notLegacy(brand.brand_logo) || defaultLogo(),
        favicon_url: notLegacy(brand.favicon_url),
        brand_color: brand.primary_color || brand.brand_color || null,
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      return res.status(200).json({ settings: settings.brand_logo || settings.brand_name ? settings : null })
    }
    return res.status(200).json({ settings: null })
  }

  if (!/^[a-z0-9.-]{1,253}$/.test(cleanDomain)) return res.status(200).json({ settings: null })

  // Branding columns only — never user_id or anything account-related.
  const { data } = await db
    .from('white_label_settings')
    .select('brand_name, brand_logo, brand_color, brand_secondary_color, custom_domain, favicon_url, support_email, support_whatsapp, hide_powered_by, custom_css, custom_footer')
    .ilike('custom_domain', cleanDomain)
    .limit(1)
    .maybeSingle()

  // Cache for 5 minutes
  res.setHeader('Cache-Control', 'public, s-maxage=300')
  return res.status(200).json({ settings: data || null })
}
