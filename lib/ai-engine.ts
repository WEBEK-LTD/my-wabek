import { smartSend, smartSendWAWeb } from '@/lib/wa-smart-send'
import { supabaseAdmin } from './supabase'
import { v4 as uuidv4 } from 'uuid'

// ── Cost guards ───────────────────────────────────────────────────────────────
export const AI_MAX_TOKENS_CAP = 500
export const AI_DEFAULT_MAX_TOKENS = 300

export function clampMaxTokens(v: unknown, fallback = AI_DEFAULT_MAX_TOKENS): number {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n <= 0) return Math.min(fallback, AI_MAX_TOKENS_CAP)
  return Math.min(Math.max(n, 16), AI_MAX_TOKENS_CAP)
}

export function clampTemperature(v: unknown, fallback = 0.7): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, 0), 1.5)
}

/** Per-user daily cap on interactive AI calls (ai/test, campaign generator, support AI reply). */
export function aiUserDailyLimit(): number {
  const n = parseInt(process.env.AI_USER_DAILY_LIMIT || '', 10)
  return Number.isFinite(n) && n > 0 ? n : 100
}

/**
 * Atomically consumes one unit of the user's daily AI quota (migration 026,
 * `consume_ai_quota`). Returns false when the cap is reached. If the function
 * is not deployed yet we allow the call (and log) rather than break AI
 * features before the migration is applied; any other DB error denies.
 */
export async function consumeAiQuota(userId: string): Promise<boolean> {
  const db = supabaseAdmin()
  const { data, error } = await db.rpc('consume_ai_quota', { p_user: userId, p_limit: aiUserDailyLimit() })
  if (error) {
    const missing = error.code === 'PGRST202' || error.code === '42883'
    console.error(`[AI] consume_ai_quota error code=${error.code}${missing ? ' (migration 026 not applied — allowing)' : ''}`)
    return missing
  }
  return data === true
}

async function getDeepSeek() {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new Error('DEEPSEEK_API_KEY not set in environment variables')
  const { default: OpenAI } = await import('openai')
  return new OpenAI({
    apiKey: key,
    baseURL: 'https://api.deepseek.com',
    timeout: 20000,
    maxRetries: 1,
  })
}

type ChatTurn = { role: 'user' | 'assistant'; content: string }

async function getHistory(userId: string, phone: string): Promise<ChatTurn[]> {
  try {
    const db = supabaseAdmin()
    const { data: contact } = await db.from('contacts').select('id').eq('user_id', userId).eq('phone', phone).maybeSingle()
    if (!contact) return []
    const { data: msgs } = await db.from('messages').select('direction, content').eq('user_id', userId).eq('contact_id', contact.id).not('content', 'is', null).order('created_at', { ascending: false }).limit(10)
    if (!msgs?.length) return []
    return msgs.reverse().map((m: { direction: string; content: string | null }) => ({
      role: (m.direction === 'inbound' ? 'user' : 'assistant') as ChatTurn['role'],
      content: String(m.content || '').slice(0, 2000),
    }))
  } catch { return [] }
}

export async function checkAILimit(userId: string) {
  const db = supabaseAdmin()
  const { data: user } = await db.from('users').select('plan_id').eq('id', userId).single()
  if (!user?.plan_id) return { allowed: false, used: 0, limit: 0 }
  const { data: plan } = await db.from('plans').select('max_ai_replies, name').eq('id', user.plan_id).single()
  const limit = (plan?.max_ai_replies as number | null) ?? 0
  if (limit === 0) return { allowed: false, used: 0, limit: 0 }
  const { data: settings } = await db.from('ai_settings').select('replies_this_month').eq('user_id', userId)
  const used = (settings || []).reduce((s: number, r: { replies_this_month: number | null }) => s + (r.replies_this_month || 0), 0)
  return { allowed: limit === -1 || used < limit, used, limit }
}

/** Atomic increment of the AI reply counter (migration 026). Falls back to read-modify-write if missing. */
async function incrementAiUsage(userId: string, settingsId: string, current: number) {
  const db = supabaseAdmin()
  const { error } = await db.rpc('increment_ai_usage', { p_user: userId, p_settings_id: settingsId })
  if (error) {
    console.error(`[AI] increment_ai_usage error code=${error.code} — falling back`)
    await db.from('ai_settings').update({ replies_this_month: (current || 0) + 1, updated_at: new Date().toISOString() }).eq('id', settingsId).eq('user_id', userId)
  }
}

export async function processAIReply(params: {
  userId: string
  instanceId: string
  instance: Record<string, unknown>
  from: string
  message: string
  contactName?: string
  contactId?: string | null
}): Promise<boolean> {
  const { userId, instanceId, instance, from, message, contactName, contactId } = params
  const db = supabaseAdmin()

  console.log(`[AI] START userId=${userId} instanceId=${instanceId}`)

  // 1. Load ai_settings — try instance-specific first, then user default
  let settings: any = null
  try {
    const { data: instanceSettings } = await db.from('ai_settings').select('*').eq('user_id', userId).eq('instance_id', instanceId).maybeSingle()
    if (instanceSettings) {
      settings = instanceSettings
    } else {
      // Fallback: any enabled settings for this user
      const { data: userSettings } = await db.from('ai_settings').select('*').eq('user_id', userId).eq('is_enabled', true).limit(1).maybeSingle()
      if (userSettings) settings = userSettings
    }
  } catch {
    console.log(`[AI] SKIP: ai_settings table not found — run migration 010_ai_settings.sql`)
    return false
  }

  if (!settings || !settings.is_enabled) {
    console.log(`[AI] SKIP: AI not enabled for instance ${instanceId}`)
    return false
  }

  // 2. Check limit
  const { allowed, used, limit } = await checkAILimit(userId)
  if (!allowed) {
    console.log(`[AI] SKIP: limit reached used=${used} limit=${limit}`)
    return false
  }

  // 3. Contact opt-out
  if (contactId) {
    const { data: ct } = await db.from('contacts').select('ai_opted_out').eq('id', contactId).eq('user_id', userId).maybeSingle()
    if (ct?.ai_opted_out) { console.log(`[AI] SKIP: contact opted out`); return false }
  }

  // 4. Escalation
  const escWords = String(settings.escalation_keywords || 'agent,human,انسان,موظف,بشري').split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)
  if (escWords.some((kw: string) => message.toLowerCase().includes(kw))) {
    console.log(`[AI] escalation triggered`)
    if (contactId) await db.from('contacts').update({ ai_opted_out: true }).eq('id', contactId).eq('user_id', userId)
    await db.from('notifications').insert({ user_id: userId, type: 'warning', title: '👤 Customer requested human agent', body: `${contactName || from} wants a human`, link: '/dashboard/chat' })
    return false
  }

  // 5. Call DeepSeek
  const history = await getHistory(userId, from)
  const systemPrompt: string = settings.system_prompt || `You are a helpful customer support assistant for ${settings.company_name || 'our company'}. Be friendly, concise. Reply in the same language the customer uses.`

  let deepseek: Awaited<ReturnType<typeof getDeepSeek>>
  try {
    deepseek = await getDeepSeek()
  } catch (e: any) {
    console.error(`[AI] init error: ${e.message}`)
    return false
  }

  let aiReply: string | undefined
  try {
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-v4-flash',
      max_tokens: clampMaxTokens(settings.max_tokens),
      temperature: clampTemperature(settings.temperature),
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...history,
        { role: 'user' as const, content: message.slice(0, 4000) },
      ],
    })
    aiReply = completion.choices[0]?.message?.content?.trim() ?? undefined
  } catch (e: any) {
    console.error(`[AI] error: ${e.message}`)
    return false
  }

  if (!aiReply) { console.log(`[AI] empty reply from DeepSeek`); return false }

  // 6. Send via WhatsApp
  const instType = (instance.instance_type || instance.type || 'cloud_api') as string

  try {
    if (instType === 'wa_web' || instType === 'baileys') {
      // Guarded send (plan limit / opt-out); smartSendWAWeb persists the row.
      const r = await smartSendWAWeb({ userId, instanceId, to: from, text: aiReply, contactId: contactId || null, source: 'ai_assistant' })
      if (r.error && !r.messageId) {
        console.error(`[AI] send failed: ${r.error}`)
        return false
      }
    } else {
      // smartSend persists the outbound message itself — no second insert.
      const r = await smartSend({ userId, instanceId, phoneNumberId: instance.phone_number_id as string, accessToken: instance.access_token as string, to: from, text: aiReply, contactId: contactId || null, templateKey: 'AI_FOLLOWUP', templateLanguage: 'en', source: 'ai_assistant' })
      if (r.error && !r.messageId) {
        console.error(`[AI] send failed: ${r.error}`)
        return false
      }
    }
  } catch (e: any) {
    console.error(`[AI] send error: ${e?.message || String(e)}`)
    return false
  }

  // 7. Increment counter (atomic)
  await incrementAiUsage(userId, settings.id, settings.replies_this_month)

  console.log(`[AI] DONE`)
  return true
}
