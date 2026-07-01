import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
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
      const err = await updateRes.json()
      return { success: false, error: err.message || 'Netlify API error' }
    }

    return { success: true }
  } catch (e) {
    return { success: false, error: String(e) }
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('white_label_settings').select('*').eq('user_id', user.userId).maybeSingle()
    return res.status(200).json({ settings: data || {} })
  }

  if (req.method === 'PUT') {
    const {
      brand_name, brand_logo, brand_color, brand_secondary_color,
      custom_domain, favicon_url, support_email, support_whatsapp,
      hide_powered_by, custom_css, custom_footer,
    } = req.body

    // Sanitize custom_css — strip </style> injection attempts
    const safeCss = (custom_css || '').replace(/<\/style>/gi, '').replace(/<script/gi, '')

    // Get old domain to remove if changed
    const { data: existing } = await db.from('white_label_settings').select('custom_domain').eq('user_id', user.userId).maybeSingle()
    const oldDomain = existing?.custom_domain

    // Save settings
    const { data, error } = await db.from('white_label_settings').upsert({
      id: uuidv4(),
      user_id: user.userId,
      brand_name:            brand_name || null,
      brand_logo:            brand_logo || null,
      brand_color:           brand_color || '#00D46A',
      brand_secondary_color: brand_secondary_color || '#F8FAFC',
      custom_domain:         custom_domain?.trim().toLowerCase() || null,
      favicon_url:           favicon_url || null,
      support_email:         support_email || null,
      support_whatsapp:      support_whatsapp || null,
      hide_powered_by:       hide_powered_by || false,
      custom_css:            safeCss || null,
      custom_footer:         custom_footer || null,
      updated_at:            new Date().toISOString(),
    }, { onConflict: 'user_id' }).select().single()

    if (error) return res.status(500).json({ error: error.message })

    // Handle Netlify domain management
    let netlifyStatus: { added?: boolean; removed?: boolean; error?: string; configured?: boolean } = {}

    if (custom_domain?.trim()) {
      const cleanDomain = custom_domain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]

      // Remove old domain if changed
      if (oldDomain && oldDomain !== cleanDomain) {
        await removeDomainFromNetlify(oldDomain)
        netlifyStatus.removed = true
      }

      // Add new domain
      const result = await addDomainToNetlify(cleanDomain)
      if (result.success) {
        netlifyStatus.added = true
        netlifyStatus.configured = true
      } else {
        netlifyStatus.error = result.error
      }
    } else if (oldDomain) {
      // Domain removed — clean up Netlify
      await removeDomainFromNetlify(oldDomain)
      netlifyStatus.removed = true
    }

    return res.status(200).json({
      settings: data,
      netlify: netlifyStatus,
      domain_status: custom_domain?.trim()
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
