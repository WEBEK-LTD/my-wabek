import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { checkPlanFeature } from '@/lib/middleware'
import { consumeAiQuota, AI_MAX_TOKENS_CAP } from '@/lib/ai-engine'

const TONES = ['friendly', 'professional', 'urgent', 'casual', 'formal', 'playful', 'persuasive']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireMemberAccess(req, res, 'campaigns')
  if (!user) return

  const { prompt } = req.body || {}
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' })
  if (prompt.length > 2000) return res.status(400).json({ error: 'prompt too long' })
  const tone = TONES.includes(String(req.body?.tone)) ? String(req.body.tone) : 'friendly'
  const type = String(req.body?.type || 'promotional').replace(/[^\w -]/g, '').slice(0, 40) || 'promotional'

  if (!(await checkPlanFeature(user.userId, 'allow_ai'))) {
    return res.status(403).json({
      error: 'Upgrade required',
      detail: 'AI generation is available on Pro and Business plans.',
      upgrade_required: true,
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI is not configured' })

  if (!(await consumeAiQuota(user.userId))) {
    return res.status(429).json({ error: 'Daily AI limit reached. Please try again tomorrow.' })
  }

  try {
    const systemPrompt = `You are a WhatsApp marketing expert. Generate a WhatsApp campaign message.

IMPORTANT RULES:
- WhatsApp supports: *bold*, _italic_, ~strikethrough~, emojis
- NO HTML, NO markdown headers (#), NO bullet points with -
- Use ✅ 📌 🔥 etc for visual structure
- Keep it concise and mobile-friendly
- Use {{name}}, {{phone}}, {{company}}, {{amount}}, {{date}}, {{link}} as personalization variables

Respond with ONLY a JSON array of blocks. Each block has: { "type": "header"|"text"|"button"|"divider", "content": "..." }

Example:
[
  {"type": "header", "content": "🔥 Special Deal for {{name}}!"},
  {"type": "text", "content": "Hi {{name}}, we have something amazing for you today."},
  {"type": "text", "content": "✅ *50% OFF* all products\\n✅ Valid until {{date}}\\n✅ Limited time!"},
  {"type": "button", "content": "🛒 Shop Now → {{link}}"},
  {"type": "divider", "content": ""},
  {"type": "text", "content": "_Reply STOP to unsubscribe_"}
]`

    const userPrompt = `Create a ${type} WhatsApp campaign message with ${tone} tone.
Campaign description: ${prompt}
Generate 4-7 blocks maximum. Make it compelling and action-oriented.`

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 20000)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: AI_MAX_TOKENS_CAP,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    }).finally(() => clearTimeout(timer))

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('[ai-generate] upstream error:', response.status, err?.error?.message)
      throw new Error('upstream')
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || '[]'

    // Parse JSON blocks
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Invalid AI response format')

    const parsedBlocks = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsedBlocks)) throw new Error('Invalid AI response format')
    const blocks = parsedBlocks.slice(0, 20).map((b: { type: string; content: string }, i: number) => ({
      type: String(b?.type || 'text'),
      content: String(b?.content ?? ''),
      id: `ai-${Date.now()}-${i}`,
    }))

    return res.status(200).json({ blocks, raw: text })
  } catch (err: unknown) {
    console.error('[ai-generate] error:', err instanceof Error ? err.message : err)
    return res.status(500).json({ error: 'AI generation failed' })
  }
}
