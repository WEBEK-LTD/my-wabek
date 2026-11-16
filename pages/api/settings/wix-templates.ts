import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const KEY_RE = /^[a-z_]{1,40}$/
const MAX_TEMPLATE_LENGTH = 2000

// Texts: system_settings `wix_templates_<userId>` (flat { event: text }, also
// read by /api/wix/webhook and /api/webhooks/wix). On/off per event:
// `wix_notify_enabled_<userId>` ({ event: boolean }), checked by
// /api/wix/webhook; an event missing from it is on.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const db = supabaseAdmin()
  const tplKey = `wix_templates_${user.userId}`
  const enaKey = `wix_notify_enabled_${user.userId}`

  if (req.method === 'GET') {
    const { data } = await db.from('system_settings').select('key, value').in('key', [tplKey, enaKey])
    const byKey = new Map((data || []).map(r => [r.key as string, r.value]))
    return res.status(200).json({ templates: byKey.get(tplKey) || {}, enabled: byKey.get(enaKey) || {} })
  }

  if (req.method === 'POST') {
    if (user.actualUserId && user.memberRole !== 'admin') {
      return res.status(403).json({ error: 'Only the account owner can do this' })
    }
    const { templates, enabled } = req.body || {}
    if (!templates || typeof templates !== 'object' || Array.isArray(templates) || JSON.stringify(templates).length > 100_000) {
      return res.status(400).json({ error: 'Invalid templates' })
    }
    if (enabled !== undefined && (enabled === null || typeof enabled !== 'object' || Array.isArray(enabled))) {
      return res.status(400).json({ error: 'Invalid enabled flags' })
    }

    const cleanTemplates: Record<string, string> = {}
    for (const [k, v] of Object.entries(templates as Record<string, unknown>).slice(0, 30)) {
      if (KEY_RE.test(k) && typeof v === 'string') cleanTemplates[k] = v.slice(0, MAX_TEMPLATE_LENGTH)
    }
    const now = new Date().toISOString()
    const rows: Array<{ key: string; value: unknown; updated_at: string }> = [
      { key: tplKey, value: cleanTemplates, updated_at: now },
    ]
    if (enabled) {
      const cleanEnabled: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(enabled as Record<string, unknown>).slice(0, 30)) {
        if (KEY_RE.test(k)) cleanEnabled[k] = v !== false
      }
      rows.push({ key: enaKey, value: cleanEnabled, updated_at: now })
    }

    const { error } = await db.from('system_settings').upsert(rows, { onConflict: 'key' })
    if (error) {
      console.error('[settings/wix-templates] save failed:', error.message)
      return res.status(500).json({ error: 'Could not save templates' })
    }
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
