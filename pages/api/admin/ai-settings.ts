import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

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

    // Mask API key
    if (settings['ai_deepseek_api_key']) {
      const k = settings['ai_deepseek_api_key']
      settings['ai_deepseek_api_key_masked'] = k.slice(0, 6) + '••••••••' + k.slice(-4)
    }

    // Monthly usage
    const monthlyUsage = getUsageKeys().reduce((sum, key) => sum + parseInt(settings[key] || '0'), 0)
    settings['ai_monthly_usage'] = String(monthlyUsage)

    return res.status(200).json({ settings })
  }

  if (req.method === 'PUT') {
    const updates = req.body as Record<string, string>
    const allowed = new Set(AI_KEYS)

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.has(key)) continue
      // Store as JSON string since value column is JSONB
      await db.from('system_settings').upsert({ key, value: JSON.stringify(String(value)) })
    }
    return res.status(200).json({ success: true })
  }

  // POST: test connection
  if (req.method === 'POST') {
    const { data: keyRow } = await db.from('system_settings')
      .select('value').eq('key', 'ai_deepseek_api_key').maybeSingle()
    const { data: provRow } = await db.from('system_settings')
      .select('value').eq('key', 'ai_provider').maybeSingle()

    const apiKey  = keyRow?.value
    const provider = provRow?.value || 'deepseek'

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
        const err = await r.text()
        return res.status(400).json({ error: `API error: ${r.status}`, detail: err })
      }
      const data = await r.json()
      const reply = data.choices?.[0]?.message?.content || ''
      return res.status(200).json({ success: true, reply, provider, model })
    } catch (err: any) {
      return res.status(500).json({ error: err?.message })
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
