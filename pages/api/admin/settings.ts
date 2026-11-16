import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { logAction, getClientIp } from '@/lib/middleware'
import { isReservedSettingKey, redactSecrets, restoreRedacted } from '@/lib/settings'

const KEY_RE = /^[a-z0-9_]{1,64}$/

function parseValue(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  try { return JSON.parse(raw) } catch { return raw }
}

function sameJson(a: unknown, b: unknown): boolean {
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('system_settings').select('key, value')
      .not('key', 'like', 'magic_login_%')
      .not('key', 'like', 'meta_oauth_%')
      .order('key')
    const settings: Record<string, unknown> = {}
    for (const row of data || []) {
      if (isReservedSettingKey(row.key)) continue
      settings[row.key] = redactSecrets(parseValue(row.value), row.key)
    }
    return res.status(200).json({ settings })
  }

  if (req.method === 'PUT') {
    const updates = req.body
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid body' })
    }

    const keys = Object.keys(updates).filter(k => KEY_RE.test(k) && !isReservedSettingKey(k))
    const { data: existingRows } = keys.length
      ? await db.from('system_settings').select('key, value').in('key', keys)
      : { data: [] as { key: string; value: unknown }[] }
    const existing = new Map((existingRows || []).map(r => [r.key, r.value]))

    const changed: string[] = []
    for (const key of keys) {
      const prevRaw = existing.get(key)
      const prev = parseValue(prevRaw)
      const value = restoreRedacted((updates as Record<string, unknown>)[key], prev)
      if (existing.has(key) && sameJson(value, prev)) continue // unchanged → don't rewrite

      // Keep the storage style already used for this key: raw JSON for keys
      // stored as objects/flags by dedicated endpoints, JSON-encoded string
      // otherwise (what getSetting() expects for legacy keys).
      const stored = existing.has(key) && typeof prevRaw !== 'string' ? value : JSON.stringify(value)

      const row = { key, value: stored, updated_at: new Date().toISOString() }
      let { error } = await db.from('system_settings').upsert({ ...row, updated_by: user.userId }, { onConflict: 'key' })
      if (error && /updated_by/.test(error.message)) {
        // Older schema (009) has no updated_by column.
        ({ error } = await db.from('system_settings').upsert(row, { onConflict: 'key' }))
      }
      if (error) {
        console.error(`[admin settings] saving ${key} failed:`, error.message)
        return res.status(500).json({ error: 'Failed to save settings' })
      }
      changed.push(key)
    }

    if (changed.length) {
      await logAction({ userId: user.userId, action: 'admin_settings_update', resource: 'system_settings', details: { keys: changed }, ipAddress: getClientIp(req) })
    }
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
