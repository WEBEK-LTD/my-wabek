import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { logAction, getClientIp } from '@/lib/middleware'
import { isRedactedPlaceholder, maskSecret } from '@/lib/settings'

function jsonVal(v: string | undefined): string {
  if (!v) return ''
  try { return JSON.parse(v) } catch { return v }
}

const AI_KEYS = [
  'ai_provider', 'ai_deepseek_api_key', 'ai_reviews_enabled',
  'ai_review_interval_hours', 'ai_inactivity_hours',
  'ai_max_messages', 'ai_daily_limit',
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAdmin(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('system_settings')
      .select('key, value').in('key', [...AI_KEYS, ...getUsageKeys()])

    const settings: Record<string, string> = {}
    for (const row of data || []) settings[row.key] = jsonVal(row.value)

    // Never return the raw API key — only a mask.
    if (settings['ai_deepseek_api_key']) {
      settings['ai_deepseek_api_key_masked'] = maskSecret(settings['ai_deepseek_api_key'])
      settings['has_ai_deepseek_api_key'] = 'true'
    }
    delete settings['ai_deepseek_api_key']

    // Monthly usage
    const monthlyUsage = getUsageKeys().reduce((sum, key) => sum + parseInt(settings[key] || '0'), 0)
    settings['ai_monthly_usage'] = String(monthlyUsage)

    return res.status(200).json({ settings })
  }

  if (req.method === 'PUT') {
    const updates = (req.body || {}) as Record<string, unknown>
    const allowed = new Set(AI_KEYS)
    const changed: string[] = []

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.has(key)) continue
      // Empty or masked API key means "keep the current key".
      if (key === 'ai_deepseek_api_key' && (!value || isRedactedPlaceholder(value) || String(value).includes('••'))) continue
      // Store as JSON string since value column is JSONB
      const { error } = await db.from('system_settings').upsert({ key, value: JSON.stringify(String(value)) }, { onConflict: 'key' })
      if (error) {
        console.error(`[ai-settings] saving ${key} failed:`, error.message)
        return res.status(500).json({ error: 'Failed to save settings' })
      }
      changed.push(key)
    }
    if (changed.length) {
      await logAction({ userId: user.userId, action: 'admin_ai_settings_update', resource: 'system_settings', details: { keys: changed }, ipAddress: getClientIp(req) })
    }
    return res.status(200).json({ success: true })
  }

  // POST: test connection
  if (req.method === 'POST') {
    const { data: keyRow } = await db.from('system_settings')
      .select('value').eq('key', 'ai_deepseek_api_key').maybeSingle()
    const { data: provRow } = await db.from('system_settings')
      .select('value').eq('key', 'ai_provider').maybeSingle()

    const apiKey  = jsonVal(keyRow?.value)
    const provider = jsonVal(provRow?.value) || 'deepseek'

    if (!apiKey) return res.status(400).json({ error: 'No API key configured' })

    try {
      const endpoint = provider === 'deepseek'
        ? 'https://api.deepseek.com/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions'
      const model = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'

      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with just the word: connected' }],
          max_tokens: 10,
        }),
      })
      if (!r.ok) {
        console.error('[ai-settings] provider test failed:', r.status, (await r.text()).slice(0, 300))
        return res.status(400).json({ error: `API error: ${r.status}` })
      }
      const data = await r.json()
      const reply = data.choices?.[0]?.message?.content || ''
      return res.status(200).json({ success: true, reply, provider, model })
    } catch (err: any) {
      console.error('[ai-settings] provider test error:', err?.message)
      return res.status(500).json({ error: 'Could not reach the AI provider' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

function getUsageKeys(): string[] {
  const keys = []
  const now = new Date()
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    keys.push(`ai_usage_${d.toISOString().split('T')[0]}`)
  }
  return keys
}
