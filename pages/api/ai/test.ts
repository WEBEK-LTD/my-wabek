import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return

  const { message, system_prompt, company_name, model, max_tokens, temperature } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured in Netlify environment variables' })
  }

  try {
    const { default: OpenAI } = await import('openai') as any
    const deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    })

    const systemPrompt = system_prompt ||
      `You are a helpful customer support assistant for ${company_name || 'our company'}. Be friendly, concise. Reply in the same language the customer uses.`

    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-v4-flash',
      max_tokens: max_tokens || 300,
      temperature: temperature ?? 0.7,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
    })

    const reply = completion.choices[0]?.message?.content?.trim()
    return res.status(200).json({ reply, model: 'deepseek-v4-flash' })
  } catch (e: any) {
    console.error('AI test error:', e)
    return res.status(500).json({ error: e.message })
  }
}
