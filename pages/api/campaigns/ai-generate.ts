import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return

  const { prompt, tone, type } = req.body
  if (!prompt) return res.status(400).json({ error: 'prompt required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(400).json({ error: 'ANTHROPIC_API_KEY not configured in environment variables' })

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || 'Claude API error')
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || '[]'

    // Parse JSON blocks
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Invalid AI response format')

    const blocks = JSON.parse(jsonMatch[0]).map((b: { type: string; content: string }, i: number) => ({
      ...b,
      id: `ai-${Date.now()}-${i}`,
    }))

    return res.status(200).json({ blocks, raw: text })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI generation failed'
    return res.status(500).json({ error: message })
  }
}
