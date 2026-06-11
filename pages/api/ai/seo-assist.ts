import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, maxTokens = 800 } = req.body
  if (!prompt) return res.status(400).json({ error: 'prompt required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: Math.min(maxTokens, 2000),
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(502).json({ error: 'AI API error', detail: err })
    }

    const data = await response.json()
    const result = data.content?.[0]?.text || ''
    return res.status(200).json({ result })

  } catch (err: any) {
    return res.status(500).json({ error: 'AI request failed', detail: err.message })
  }
}
