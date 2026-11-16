import type { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { checkPlanFeature } from '@/lib/middleware'
import { clampMaxTokens, clampTemperature, consumeAiQuota } from '@/lib/ai-engine'
import { getAllowedInstances } from '@/lib/inbox-access'

/**
 * POST /api/ai/suggest { conversation_id } | { contact_id, instance_id? }
 *
 * One suggested agent reply for an inbox conversation, written with the
 * account's AI settings (system prompt / company name of the conversation's
 * number, else the account default) from the last 15 messages. Nothing is
 * sent: the agent reviews and edits the suggestion in the composer.
 * Gated by the plan's allow_ai flag and the per-user daily AI quota.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HISTORY = 15
const SUGGEST_MAX_TOKENS = 300
const MEDIA_PLACEHOLDER = /^\[(image|video|audio|document|sticker|ptt)\]$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const user = await requireMemberAccess(req, res, 'inbox')
  if (!user) return

  const { conversation_id, contact_id, instance_id } = req.body || {}
  if (conversation_id !== undefined && (typeof conversation_id !== 'string' || !UUID.test(conversation_id))) {
    return res.status(400).json({ error: 'Invalid conversation_id' })
  }
  if (contact_id !== undefined && (typeof contact_id !== 'string' || !UUID.test(contact_id))) {
    return res.status(400).json({ error: 'Invalid contact_id' })
  }
  if (instance_id !== undefined && instance_id !== null && (typeof instance_id !== 'string' || !UUID.test(instance_id))) {
    return res.status(400).json({ error: 'Invalid instance_id' })
  }
  if (!conversation_id && !contact_id) return res.status(400).json({ error: 'conversation_id or contact_id required' })

  const db = supabaseAdmin()
  const ownerId = user.userId

  // Resolve the conversation (contact + number), scoped to this account.
  let contactId: string | null = contact_id || null
  let instanceId: string | null = instance_id || null
  if (conversation_id) {
    const { data: conv } = await db.from('conversation_assignments')
      .select('id, contact_id, instance_id')
      .eq('id', conversation_id).eq('owner_id', ownerId).maybeSingle()
    if (!conv) return res.status(404).json({ error: 'Conversation not found' })
    contactId = conv.contact_id
    instanceId = conv.instance_id || instanceId
  }
  if (!contactId) return res.status(404).json({ error: 'Contact not found' })

  const { data: contact } = await db.from('contacts').select('id, name')
    .eq('id', contactId).eq('user_id', ownerId).maybeSingle()
  if (!contact) return res.status(404).json({ error: 'Contact not found' })

  // Team members restricted to some inboxes only get suggestions there.
  const allowed = await getAllowedInstances(db, user.actualUserId || user.userId, ownerId)
  if (allowed && (!instanceId || !allowed.includes(instanceId))) {
    return res.status(403).json({ error: 'Access denied to this inbox' })
  }

  if (!(await checkPlanFeature(ownerId, 'allow_ai'))) {
    return res.status(403).json({
      error: 'Upgrade required',
      detail: 'AI Agents are available on Pro and Business plans.',
      upgrade_required: true,
    })
  }
  if (!process.env.DEEPSEEK_API_KEY) return res.status(500).json({ error: 'AI is not configured' })

  let q = db.from('messages').select('direction, content, type')
    .eq('user_id', ownerId).eq('contact_id', contactId)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(HISTORY)
  if (instanceId) q = q.eq('instance_id', instanceId)
  const { data: rows, error: msgErr } = await q
  if (msgErr) {
    console.error('[ai/suggest] history failed:', msgErr.message)
    return res.status(500).json({ error: 'Failed to load the conversation' })
  }
  const history = (rows || []).reverse()
    .map(m => ({ direction: m.direction as string, content: String(m.content || '').trim().slice(0, 1500) }))
    .filter(m => m.content && !MEDIA_PLACEHOLDER.test(m.content))
  if (!history.some(m => m.direction === 'inbound')) {
    return res.status(422).json({ error: 'No customer message to reply to', code: 'no_inbound' })
  }

  // Settings of this number, else the account-wide row, else the first one.
  let cfg: { system_prompt?: string | null; company_name?: string | null; temperature?: number | null } = {}
  try {
    const { data: settings } = await db.from('ai_settings')
      .select('instance_id, system_prompt, company_name, temperature')
      .eq('user_id', ownerId)
    const list = settings || []
    cfg = list.find(s => instanceId && s.instance_id === instanceId) || list.find(s => !s.instance_id) || list[0] || {}
  } catch { /* table missing → defaults */ }

  if (!(await consumeAiQuota(user.userId))) {
    return res.status(429).json({ error: 'Daily AI limit reached. Please try again tomorrow.' })
  }

  const company = String(cfg.company_name || 'our company').slice(0, 200)
  const base = (cfg.system_prompt && String(cfg.system_prompt).slice(0, 8000)) ||
    `You are a helpful customer support assistant for ${company}. Be friendly and concise.`
  const systemPrompt = `${base}\n\nYou are drafting the next reply a human support agent will send on WhatsApp. ` +
    'Reply in the language the customer uses. Output only the message text — no quotes, labels or explanations.'
  const transcript = history
    .map(m => `${m.direction === 'inbound' ? 'Customer' : 'Agent'}: ${m.content}`)
    .join('\n')
    .slice(-6000)

  try {
    const { default: OpenAI } = await import('openai') as any
    const deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
      timeout: 20000,
      maxRetries: 0,
    })
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-v4-flash',
      max_tokens: clampMaxTokens(SUGGEST_MAX_TOKENS, SUGGEST_MAX_TOKENS),
      temperature: clampTemperature(cfg.temperature),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${contact.name ? `Customer name: ${String(contact.name).slice(0, 100)}\n\n` : ''}${transcript}\n\nWrite the agent's next reply.` },
      ],
    })
    const reply = completion.choices?.[0]?.message?.content?.trim()
    if (!reply) return res.status(502).json({ error: 'AI returned no suggestion' })
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ suggestion: reply, reply })
  } catch (e: any) {
    console.error('[ai/suggest] error:', e?.message)
    return res.status(502).json({ error: 'AI request failed' })
  }
}
