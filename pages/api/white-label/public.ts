import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

// Public endpoint - no auth needed
// Returns white label settings for a given domain
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const domain = (req.query.domain as string) || req.headers.host || ''
  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0]

  const db = supabaseAdmin()

  // For main domain — return global brand settings from admin
  const mainDomains = ['waabek.com', 'www.waabek.com', 'localhost', '127.0.0.1']
  if (mainDomains.some(d => cleanDomain.includes(d))) {
    const { data: brandRow } = await db
      .from('system_settings')
      .select('value')
      .eq('key', 'brand_settings')
      .maybeSingle()

    if (brandRow?.value) {
      const brand = brandRow.value as any
      const settings = {
        brand_name:  brand.app_name || null,
        brand_logo:  brand.logo_url || brand.brand_logo || 'https://res.cloudinary.com/dkl7ntpgw/image/upload/f_auto,q_auto/%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86_1_kejdrs',
        favicon_url: brand.favicon_url || null,
        brand_color: brand.primary_color || brand.brand_color || null,
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      return res.status(200).json({ settings: settings.brand_logo || settings.brand_name ? settings : null })
    }
    return res.status(200).json({ settings: null })
  }

  const { data } = await db
    .from('white_label_settings')
    .select('*')
    .eq('custom_domain', cleanDomain)
    .single()

  // Cache for 5 minutes
  res.setHeader('Cache-Control', 'public, s-maxage=300')
  return res.status(200).json({ settings: data || null })
}
