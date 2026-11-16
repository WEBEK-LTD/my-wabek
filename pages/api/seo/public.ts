import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/seo/public — the SEO/brand values every public page needs in its
 * <head> (title, description, share image, analytics ID, site-verification
 * metas, JSON-LD schemas, favicon, VAPID public key).
 *
 * Read-only and unauthenticated: only an allow-list of non-secret fields is
 * returned (never SMTP, the VAPID private key, custom head code or any other
 * admin setting). Cached at the edge for a few minutes.
 */

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Accepts a bare token or a pasted `<meta ... content="token">` / `content="token"`. */
const verificationToken = (v: unknown) => {
  const s = str(v, 500)
  if (!s) return ''
  const m = s.match(/content\s*=\s*["']([^"']+)["']/i)
  const token = (m ? m[1] : s).trim()
  return /^[A-Za-z0-9_\-.:=+/]{1,200}$/.test(token) ? token : ''
}

const SCHEMA_KEY = /^schema_[a-z0-9_]{1,40}$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let map: Record<string, unknown> = {}
  try {
    const { data: rows } = await supabaseAdmin().from('system_settings')
      .select('key, value')
      .in('key', ['seo_settings', 'brand_settings', 'webmaster_settings', 'push_settings'])
    map = Object.fromEntries((rows || []).map(r => [r.key, r.value]))
  } catch (e) {
    console.error('[seo/public] load failed:', (e as Error).message)
  }

  const seo = isObj(map.seo_settings) ? map.seo_settings : {}
  const brand = isObj(map.brand_settings) ? map.brand_settings : {}
  const web = isObj(map.webmaster_settings) ? map.webmaster_settings : {}
  const push = isObj(map.push_settings) ? map.push_settings : {}

  const schemas: Record<string, string> = {}
  for (const [k, v] of Object.entries(seo)) {
    if (SCHEMA_KEY.test(k) && typeof v === 'string' && v.trim()) {
      // Only valid JSON is served (it is injected into ld+json script tags).
      try { JSON.parse(v); schemas[k] = v.slice(0, 20000) } catch { /* skip invalid */ }
    }
  }

  const body = {
    seo: {
      site_title: str(seo.site_title, 200) || str(seo.meta_title, 200),
      title_template: str(seo.title_template, 200),
      site_description: str(seo.site_description, 500) || str(seo.meta_description, 500),
      canonical: str(seo.canonical, 300),
      og_image: str(seo.og_image, 1000),
      twitter_handle: str(seo.twitter_handle, 60),
      ga_id: str(seo.ga_id, 40),
      index_site: seo.index_site !== false,
      ...schemas,
    },
    brand: {
      app_name: str(brand.app_name, 120),
      logo_url: str(brand.logo_url, 200000),
      favicon_url: str(brand.favicon_url, 200000),
    },
    webmaster: {
      google_site_verification: verificationToken(web.google_site_verification) || verificationToken(seo.gsc_verify),
      bing_site_verification: verificationToken(web.bing_site_verification),
      pinterest_verification: verificationToken(web.pinterest_verification),
      yandex_verification: verificationToken(web.yandex_verification),
      baidu_verification: verificationToken(web.baidu_verification),
    },
    push: {
      vapid_public: str(push.vapid_public, 200),
    },
  }

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
  return res.status(200).json(body)
}
