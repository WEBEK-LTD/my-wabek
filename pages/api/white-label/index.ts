import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

async function addDomainToNetlify(domain: string): Promise<{ success: boolean; error?: string; alreadyExists?: boolean }> {
  const siteId = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_API_TOKEN

  if (!siteId || !token) {
    return { success: false, error: 'NETLIFY_SITE_ID or NETLIFY_API_TOKEN not configured' }
  }

  try {
    // Get current aliases
    const siteRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const site = await siteRes.json()
    const aliases: string[] = site.domain_aliases || []

    if (aliases.includes(domain)) {
      return { success: true, alreadyExists: true }
    }

    // Add new alias
    const updateRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain_aliases: [...aliases, domain] }),
    })

    if (!updateRes.ok) {
      console.error('[white-label] Netlify add failed:', updateRes.status)
      return { success: false, error: 'Netlify API error' }
    }

    return { success: true }
  } catch (e) {
    console.error('[white-label] Netlify add failed:', e)
    return { success: false, error: 'Netlify API error' }
  }
}

async function removeDomainFromNetlify(domain: string): Promise<void> {
  const siteId = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_API_TOKEN
  if (!siteId || !token) return

  try {
    const siteRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const site = await siteRes.json()
    const aliases: string[] = (site.domain_aliases || []).filter((a: string) => a !== domain)

    await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain_aliases: aliases }),
    })
  } catch {}
}

const HOSTNAME_RE = /^(?=.{4,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/

function cleanDomainInput(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  return v.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/\.$/, '')
}

function isReservedDomain(domain: string): boolean {
  const hosts = [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_NETLIFY_URL, 'waabek.com']
    .filter(Boolean)
    .map(h => String(h).replace(/^https?:\/\//, '').split('/')[0].toLowerCase())
  return hosts.some(h => domain === h || domain.endsWith('.' + h)) || domain.endsWith('.netlify.app')
}

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

function color(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback
}

// Image URLs: http(s) or inline data:image/* only (no javascript: etc.).
function httpsUrl(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  const s = v.trim()
  if (/^https?:\/\//i.test(s) && s.length <= 2000) return s
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,/i.test(s) && s.length <= 500_000) return s
  return null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'settings')
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('white_label_settings').select('*').eq('user_id', user.userId).maybeSingle()
    return res.status(200).json({ settings: data || {} })
  }

  if (req.method === 'PUT') {
    if (user.actualUserId) return res.status(403).json({ error: 'Only the account owner can do this' })

    const body = req.body || {}
    const cleanDomain = cleanDomainInput(body.custom_domain)
    if (cleanDomain) {
      if (!HOSTNAME_RE.test(cleanDomain)) return res.status(400).json({ error: 'Invalid domain' })
      if (isReservedDomain(cleanDomain)) return res.status(400).json({ error: 'This domain cannot be used' })
      // One domain ↔ one account (case-insensitive). HOSTNAME_RE excludes % and _,
      // so ilike here is an exact case-insensitive match.
      const { data: claimed } = await db.from('white_label_settings')
        .select('user_id').ilike('custom_domain', cleanDomain).neq('user_id', user.userId).limit(1)
      if (claimed?.length) return res.status(409).json({ error: 'This domain is already in use by another account' })
    }

    // Sanitize custom_css — strip </style> injection attempts
    const safeCss = (typeof body.custom_css === 'string' ? body.custom_css : '')
      .slice(0, 50_000).replace(/<\/style>/gi, '').replace(/<script/gi, '')

    const { data: existing } = await db.from('white_label_settings').select('id, custom_domain').eq('user_id', user.userId).maybeSingle()
    const oldDomain = cleanDomainInput(existing?.custom_domain)

    const { data, error } = await db.from('white_label_settings').upsert({
      id: existing?.id || uuidv4(),
      user_id: user.userId,
      brand_name:            str(body.brand_name, 100),
      brand_logo:            httpsUrl(body.brand_logo),
      brand_color:           color(body.brand_color, '#00D46A'),
      brand_secondary_color: color(body.brand_secondary_color, '#F8FAFC'),
      custom_domain:         cleanDomain,
      favicon_url:           httpsUrl(body.favicon_url),
      support_email:         str(body.support_email, 254),
      support_whatsapp:      str(body.support_whatsapp, 32),
      hide_powered_by:       body.hide_powered_by === true,
      custom_css:            safeCss || null,
      custom_footer:         str(body.custom_footer, 2000),
      updated_at:            new Date().toISOString(),
    }, { onConflict: 'user_id' }).select().single()

    if (error) {
      console.error('[white-label] save failed:', error.message)
      // Unique index from migration 027 (race between two accounts).
      if ((error as { code?: string }).code === '23505') return res.status(409).json({ error: 'This domain is already in use by another account' })
      return res.status(500).json({ error: 'Could not save settings' })
    }

    // Only remove a Netlify alias this user owned and nobody else claims.
    const canRemove = async (domain: string): Promise<boolean> => {
      if (isReservedDomain(domain)) return false
      const { data: others } = await db.from('white_label_settings')
        .select('user_id').ilike('custom_domain', domain).neq('user_id', user.userId).limit(1)
      return !others?.length
    }

    const netlifyStatus: { added?: boolean; removed?: boolean; error?: string; configured?: boolean } = {}

    if (oldDomain && oldDomain !== cleanDomain && HOSTNAME_RE.test(oldDomain) && await canRemove(oldDomain)) {
      await removeDomainFromNetlify(oldDomain)
      netlifyStatus.removed = true
    }

    if (cleanDomain) {
      const result = await addDomainToNetlify(cleanDomain)
      if (result.success) {
        netlifyStatus.added = true
        netlifyStatus.configured = true
      } else {
        netlifyStatus.error = result.error
      }
    }

    return res.status(200).json({
      settings: data,
      netlify: netlifyStatus,
      domain_status: cleanDomain
        ? netlifyStatus.configured
          ? 'configured'
          : netlifyStatus.error
            ? 'netlify_error'
            : 'pending'
        : 'none',
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
