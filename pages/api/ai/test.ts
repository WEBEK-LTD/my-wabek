import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { checkPlanFeature } from '@/lib/middleware'
import { clampMaxTokens, clampTemperature, consumeAiQuota } from '@/lib/ai-engine'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireMemberAccess(req, res, 'ai')
  if (!user) return

  const { message, system_prompt, company_name, max_tokens, temperature } = req.body || {}
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message required' })
  if (message.length > 4000) return res.status(400).json({ error: 'message too long' })
  if (system_prompt !== undefined && system_prompt !== null && (typeof system_prompt !== 'string' || system_prompt.length > 8000)) {
    return res.status(400).json({ error: 'system_prompt too long' })
  }

  if (!(await checkPlanFeature(user.userId, 'allow_ai'))) {
    return res.status(403).json({
      error: 'Upgrade required',
      detail: 'AI Agents are available on Pro and Business plans.',
      upgrade_required: true,
    })
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'AI is not configured' })
  }

  if (!(await consumeAiQuota(user.userId))) {
    return res.status(429).json({ error: 'Daily AI limit reached. Please try again tomorrow.' })
  }

  try {
    const { default: OpenAI } = await import('openai') as any
    const deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
      timeout: 20000,
      maxRetries: 1,
    })

    const systemPrompt = system_prompt ||
      `You are a helpful customer support assistant for ${String(company_name || 'our company').slice(0, 200)}. Be friendly, concise. Reply in the same language the customer uses.`

    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-v4-flash',
      max_tokens: clampMaxTokens(max_tokens),
      temperature: clampTemperature(temperature),
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
    })

    const reply = completion.choices[0]?.message?.content?.trim()
    return res.status(200).json({ reply, model: 'deepseek-v4-flash' })
  } catch (e: any) {
    console.error('AI test error:', e?.message)
    return res.status(500).json({ error: 'AI request failed' })
  }
}
