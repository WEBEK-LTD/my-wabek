import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { WIX_EVENTS, WIX_EVENT_GROUPS, WIX_PLACEHOLDERS, pickWixLanguage, isUntouchedDefault } from '@/lib/wix-events'

const KEY_RE = /^[a-z_]{1,40}$/
const MAX_TEMPLATE_LENGTH = 2000
const MAX_KEYS = 60

// Texts: system_settings `wix_templates_<userId>` (flat { event: text }, also
// read by /api/wix/webhook and /api/webhooks/wix). On/off per event:
// `wix_notify_enabled_<userId>` ({ event: boolean }), checked by
// /api/wix/webhook; an event missing from it is on.
//
// GET returns the saved maps (as before) plus the full event catalogue
// (lib/wix-events.ts) merged with them, so the UI can render every event.
// POST merges into the saved maps: events the caller does not send keep
// their saved text / switch (an older UI that knows fewer events cannot
// wipe the others). An empty string resets an event to its default text.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const db = supabaseAdmin()
  const tplKey = `wix_templates_${user.userId}`
  const enaKey = `wix_notify_enabled_${user.userId}`

  const loadSaved = async () => {
    const { data } = await db.from('system_settings').select('key, value').in('key', [tplKey, enaKey])
    const byKey = new Map((data || []).map(r => [r.key as string, r.value]))
    return {
      templates: (byKey.get(tplKey) || {}) as Record<string, string>,
      enabled: (byKey.get(enaKey) || {}) as Record<string, boolean>,
    }
  }

  if (req.method === 'GET') {
    const { templates, enabled } = await loadSaved()
    const { data: u } = await db.from('users').select('language').eq('id', user.userId).maybeSingle()
    const language = pickWixLanguage(u?.language)
    const events = WIX_EVENTS.map(e => {
      const saved = typeof templates[e.key] === 'string' && templates[e.key].trim() ? templates[e.key] : null
      return {
        key: e.key,
        group: e.group,
        audience: e.audience,
        wixWebhooks: e.wixWebhooks,
        placeholders: e.placeholders,
        label: e.label,
        description: e.description,
        defaults: e.defaults,
        /** The default the webhook would send for this merchant. */
        default: e.defaults[language],
        /** Saved custom text, or null when the default is used. */
        text: saved && !(language !== 'en' && isUntouchedDefault(e.key, saved)) ? saved : null,
        enabled: enabled[e.key] !== false,
      }
    })
    return res.status(200).json({ templates, enabled, language, events, groups: WIX_EVENT_GROUPS, placeholders: WIX_PLACEHOLDERS })
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

    const saved = await loadSaved()
    const cleanTemplates: Record<string, string> = { ...saved.templates }
    for (const [k, v] of Object.entries(templates as Record<string, unknown>).slice(0, MAX_KEYS)) {
      if (!KEY_RE.test(k) || typeof v !== 'string') continue
      if (v.trim()) cleanTemplates[k] = v.slice(0, MAX_TEMPLATE_LENGTH)
      else delete cleanTemplates[k]
    }
    const now = new Date().toISOString()
    const rows: Array<{ key: string; value: unknown; updated_at: string }> = [
      { key: tplKey, value: cleanTemplates, updated_at: now },
    ]
    if (enabled) {
      const cleanEnabled: Record<string, boolean> = { ...saved.enabled }
      for (const [k, v] of Object.entries(enabled as Record<string, unknown>).slice(0, MAX_KEYS)) {
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
