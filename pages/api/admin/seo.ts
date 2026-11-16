import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { logAction, getClientIp } from '@/lib/middleware'
import { redactSecrets, restoreRedacted } from '@/lib/settings'

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } }

const SEO_KEY = 'seo_settings'
const BRAND_KEY = 'brand_settings'
const SMTP_KEY = 'smtp_settings'
const PUSH_KEY = 'push_settings'
const WEBMASTER_KEY = 'webmaster_settings'

/** Verification tokens / sitemap / robots.txt from the admin Integrations section. */
const WEBMASTER_FIELDS = ['google_site_verification', 'bing_site_verification', 'pinterest_verification', 'yandex_verification', 'baidu_verification', 'sitemap_url', 'robots_txt'] as const
function cleanWebmaster(v: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of WEBMASTER_FIELDS) {
    const raw = v[f]
    if (typeof raw !== 'string') continue
    out[f] = raw.trim().slice(0, f === 'robots_txt' ? 10000 : 500)
  }
  return out
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  const keys = [SEO_KEY, BRAND_KEY, SMTP_KEY, PUSH_KEY, WEBMASTER_KEY]
  const load = async () => {
    const { data: rows } = await db.from('system_settings').select('key, value').in('key', keys)
    return Object.fromEntries((rows || []).map(r => [r.key, r.value])) as Record<string, unknown>
  }

  if (req.method === 'GET') {
    const map = await load()
    return res.status(200).json({
      seo: map[SEO_KEY] || {},
      brand: map[BRAND_KEY] || {},
      // SMTP password / VAPID private key are masked; sending the mask back keeps them.
      smtp: redactSecrets(map[SMTP_KEY] || {}),
      push: redactSecrets(map[PUSH_KEY] || {}),
      webmaster: map[WEBMASTER_KEY] || {},
    })
  }

  if (req.method === 'PUT') {
    const { seo, brand, smtp, push, webmaster } = req.body || {}
    const map = await load()
    const changed: string[] = []

    const save = async (key: string, value: unknown) => {
      const { error } = await db.from('system_settings').upsert({ key, value }, { onConflict: 'key' })
      if (error) throw new Error(`${key}: ${error.message}`)
      changed.push(key)
    }

    try {
      if (isObj(seo)) await save(SEO_KEY, seo)
      if (isObj(brand)) await save(BRAND_KEY, brand)
      if (isObj(smtp)) await save(SMTP_KEY, restoreRedacted(smtp, map[SMTP_KEY]))
      if (isObj(push)) await save(PUSH_KEY, restoreRedacted(push, map[PUSH_KEY]))
      if (isObj(webmaster)) await save(WEBMASTER_KEY, cleanWebmaster(webmaster))
    } catch (e) {
      console.error('[admin seo] save failed:', (e as Error).message)
      return res.status(500).json({ error: 'Failed to save settings' })
    }

    if (changed.length) {
      await logAction({ userId: admin.userId, action: 'admin_settings_update', resource: 'system_settings', details: { keys: changed }, ipAddress: getClientIp(req) })
    }
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
