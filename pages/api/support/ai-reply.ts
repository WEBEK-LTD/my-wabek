import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { checkPlanFeature } from '@/lib/middleware'
import { consumeAiQuota, AI_MAX_TOKENS_CAP } from '@/lib/ai-engine'

const DEFAULT_KNOWLEDGE = `
You are WABEK AI, the support assistant for WABEK — a WhatsApp Business automation platform owned by webek.org.

ABOUT WABEK:
- WABEK is a SaaS platform that lets businesses manage WhatsApp at scale
- Features: Bulk campaigns, Team inbox, Chatbot builder, AI auto-reply, Campaign analytics, Integrations (Wix, WordPress, WHMCS)
- Supports both Meta WhatsApp Cloud API and WhatsApp Web (Baileys)
- Plans: Starter, Pro, Business, Enterprise — visit waabek.com/pricing for details
- Business hours: 9 AM – 6 PM daily (our team replies during these hours)
- Support email: support@waabek.com
- Website: waabek.com

HOW TO HELP:
- Answer questions about WABEK features, pricing, setup, and troubleshooting
- If you don't know the answer, say: "Our support team will follow up during business hours (9AM–6PM)"
- Never share internal system details or admin credentials
- Always be polite, helpful, and concise
- Reply in the same language the user writes in
`

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return

  const { ticket_id, message } = req.body || {}
  if (!ticket_id || !message || typeof message !== 'string') return res.status(400).json({ error: 'ticket_id and message required' })
  if (message.length > 4000) return res.status(400).json({ error: 'message too long' })

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI not configured' })

  if (!(await checkPlanFeature(user.userId, 'allow_ai'))) {
    return res.status(403).json({
      error: 'Upgrade required',
      detail: 'AI replies are available on Pro and Business plans. Our support team will reply during business hours.',
      upgrade_required: true,
    })
  }

  const db = supabaseAdmin()

  // Check table
  const { error: tableCheck } = await db.from('support_tickets').select('id').limit(1)
  if (tableCheck?.message?.includes('relation') || tableCheck?.message?.includes('schema cache')) {
    return res.status(503).json({ error: 'Run migration 012_support_tickets.sql first' })
  }

  const { data: ticket } = await db
    .from('support_tickets')
    .select('subject')
    .eq('id', ticket_id)
    .eq('user_id', user.userId)
    .maybeSingle()
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  if (!(await consumeAiQuota(user.userId))) {
    return res.status(429).json({ error: 'Daily AI limit reached. Our support team will reply during business hours.' })
  }

  // Load admin-defined custom knowledge
  const { data: settingsRow } = await db
    .from('system_settings')
    .select('value')
    .eq('key', 'support_ai_knowledge')
    .maybeSingle()
  const customKnowledge = settingsRow?.value as string || ''

  // Load conversation history
  const { data: history } = await db
    .from('support_messages')
    .select('sender_type,content')
    .eq('ticket_id', ticket_id)
    .order('created_at')
    .limit(10)

  const messages = (history || []).map(m => ({
    role: m.sender_type === 'user' ? 'user' : 'assistant',
    content: m.content,
  }))
  messages.push({ role: 'user', content: message })

  const systemPrompt = `${DEFAULT_KNOWLEDGE}${customKnowledge ? `\n\nADDITIONAL KNOWLEDGE:\n${customKnowledge}` : ''}\n\nCurrent ticket subject: "${ticket.subject}"`

  try {
    const { default: OpenAI } = await import('openai') as any
    const deepseek = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com', timeout: 20000, maxRetries: 1 })
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-v4-flash',
      max_tokens: AI_MAX_TOKENS_CAP,
      temperature: 0.6,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    })
    const reply = completion.choices[0]?.message?.content?.trim()
    if (!reply) return res.status(500).json({ error: 'Empty AI response' })

    // Save AI message to ticket
    await db.from('support_messages').insert({
      ticket_id,
      sender_type: 'ai',
      content: reply,
    })

    return res.status(200).json({ reply })
  } catch (e: any) {
    console.error('[support AI] error:', e.message)
    return res.status(500).json({ error: 'AI reply failed' })
  }
}
