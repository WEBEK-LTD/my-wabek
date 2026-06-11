import { smartSend, TEMPLATES } from '@/lib/wa-smart-send'
// @ts-nocheck
import { supabaseAdmin } from './supabase'
import { sendWAWebMessage } from './wa-web'
import { sendTextMessage } from './whatsapp'
import { v4 as uuidv4 } from 'uuid'

async function getDeepSeek() {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new Error('DEEPSEEK_API_KEY not set in environment variables')
  const { default: OpenAI } = await import('openai')
  return new OpenAI({
    apiKey: key,
    baseURL: 'https://api.deepseek.com',
  })
}

async function getHistory(userId: string, phone: string) {
  try {
    const db = supabaseAdmin()
    const { data: contact } = await db.from('contacts').select('id').eq('user_id', userId).eq('phone', phone).maybeSingle()
    if (!contact) return []
    const { data: msgs } = await db.from('messages').select('direction, content').eq('user_id', userId).eq('contact_id', contact.id).neq('content', null).order('created_at', { ascending: false }).limit(10)
    if (!msgs?.length) return []
    return msgs.reverse().map(m => ({ role: (m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.content as string }))
  } catch { return [] }
}

export async function checkAILimit(userId: string) {
  const db = supabaseAdmin()
  const { data: user } = await db.from('users').select('plan_id').eq('id', userId).single()
  if (!user?.plan_id) return { allowed: false, used: 0, limit: 0 }
  const { data: plan } = await db.from('plans').select('max_ai_replies, name').eq('id', user.plan_id).single()
  const limit = plan?.max_ai_replies ?? 0
  if (limit === 0) return { allowed: false, used: 0, limit: 0 }
  const { data: settings } = await db.from('ai_settings').select('replies_this_month').eq('user_id', userId)
  const used = (settings || []).reduce((s, r) => s + (r.replies_this_month || 0), 0)
  return { allowed: limit === -1 || used < limit, used, limit }
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

  console.log(`[AI] START userId=${userId} instanceId=${instanceId} from=${from} message="${message.substring(0, 40)}"`)

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
  } catch (e: any) {
    console.log(`[AI] SKIP: ai_settings table not found — run migration 010_ai_settings.sql`)
    return false
  }

  console.log(`[AI] settings: ${JSON.stringify({ found: !!settings, is_enabled: settings?.is_enabled, instance_id: instanceId, user_id: userId })}`)

  if (!settings || !settings.is_enabled) {
    console.log(`[AI] SKIP: no settings found for this instance — go to Dashboard → AI Assistant and enable it for instance ${instanceId}`)
    return false
  }

  // 2. Check limit
  const { allowed, used, limit } = await checkAILimit(userId)
  console.log(`[AI] limit: allowed=${allowed} used=${used} limit=${limit}`)
  if (!allowed) {
    console.log(`[AI] SKIP: limit reached`)
    return false
  }

  // 3. Contact opt-out
  if (contactId) {
    const { data: ct } = await db.from('contacts').select('ai_opted_out').eq('id', contactId).maybeSingle()
    if (ct?.ai_opted_out) { console.log(`[AI] SKIP: contact opted out`); return false }
  }

  // 4. Escalation
  const escWords = (settings.escalation_keywords || 'agent,human,انسان,موظف,بشري').split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)
  if (escWords.some((kw: string) => message.toLowerCase().includes(kw))) {
    console.log(`[AI] escalation triggered`)
    if (contactId) await db.from('contacts').update({ ai_opted_out: true }).eq('id', contactId)
    await db.from('notifications').insert({ user_id: userId, type: 'warning', title: '👤 Customer requested human agent', body: `${contactName || from} wants a human`, link: '/dashboard/chat' })
    return false
  }

  // 5. Call OpenAI
  const history = await getHistory(userId, from)
  const systemPrompt = settings.system_prompt || `You are a helpful customer support assistant for ${settings.company_name || 'our company'}. Be friendly, concise. Reply in the same language the customer uses.`

  console.log(`[AI] calling DeepSeek model=${settings.model || 'deepseek-chat'}`)
  let deepseek
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
      max_tokens: settings.max_tokens || 300,
      temperature: settings.temperature ?? 0.7,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...history,
        { role: 'user' as const, content: message },
      ] as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    })
    aiReply = completion.choices[0]?.message?.content?.trim() ?? undefined
    console.log(`[AI] reply: "${aiReply?.substring(0, 80) ?? ''}"`)
  } catch (e: any) {
    console.error(`[AI] error: ${e.message}`)
    return false
  }

  if (!aiReply) { console.log(`[AI] empty reply from DeepSeek`); return false }

  // 6. Send via WhatsApp
  const instType = (instance.instance_type || instance.type || 'cloud_api') as string
  console.log(`[AI] sending via ${instType} to ${from}`)

  let waMessageId: string | null = null
  try {
    if (instType === 'wa_web' || instType === 'baileys') {
      const r = await sendWAWebMessage({ instanceId, to: from, text: aiReply })
      waMessageId = r?.messageId || null
    } else {
      const r = await smartSend({ userId, instanceId, phoneNumberId: instance.phone_number_id as string, accessToken: instance.access_token as string, to: from, text: aiReply, contactId: contactId || null, templateKey: 'AI_FOLLOWUP', templateLanguage: 'en' })
      waMessageId = r?.messageId ?? null
    }
    console.log(`[AI] sent OK waMessageId=${waMessageId}`)
  } catch (e: any) {
    console.error(`[AI] send error: ${e?.message || String(e)}`)
    return false
  }

  // 7. Save message
  const msgType = 'ai_reply'
  const { error: insErr } = await db.from('messages').insert({ id: uuidv4(), user_id: userId, instance_id: instanceId, contact_id: contactId || null, wa_message_id: waMessageId, direction: 'outbound', type: msgType, content: aiReply, status: 'sent' })
  if (insErr) {
    console.error(`[AI] message insert err: ${insErr.message} — trying text type`)
    const { error: fallbackErr } = await db.from('messages').insert({ id: uuidv4(), user_id: userId, instance_id: instanceId, contact_id: contactId || null, wa_message_id: waMessageId, direction: 'outbound', type: 'text', content: `🤖 ${aiReply}`, status: 'sent' })
    if (fallbackErr) console.error(`[AI] fallback insert err: ${fallbackErr.message}`)
  }

  // 8. Increment counter
  await db.from('ai_settings').update({ replies_this_month: (settings.replies_this_month || 0) + 1, updated_at: new Date().toISOString() }).eq('id', settings.id)

  console.log(`[AI] DONE ✅`)
  return true
}
