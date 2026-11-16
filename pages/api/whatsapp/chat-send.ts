/**
 * /api/whatsapp/chat-send
 * Live Chat send endpoint — source=live_chat
 *
 * Inside 24h window  → send agent message as text
 * Outside 24h window → 403 outside_window (the agent must wait for the
 *                       customer, or send an approved template)
 * { template: { name, language, params } } → approved Meta template
 *                       (Cloud API numbers only; works in or out of the window)
 *
 * All sends go through lib/wa-smart-send (plan limit, opt-out, SSRF check).
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { smartSend, smartSendWAWeb, smartSendMedia, resolveProvider, isInWindow } from '@/lib/wa-smart-send'
import { sanitizeDisplayFilename } from '@/lib/media-storage'
import { getMessageTemplates } from '@/lib/whatsapp'
import { cleanTemplateParam } from '@/lib/campaign-templates'

const TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/
const TEMPLATE_LANG = /^[a-z]{2,3}(_[A-Za-z]{2,4})?$/
const PARAM_NAME = /^[a-z0-9_]{1,60}$/
const MAX_PARAMS = 20

type TemplateParams = { kind: 'positional'; values: string[] } | { kind: 'named'; values: Record<string, string> }

/** Validates `{ name, language, params }`; params is an array ({{1}}…) or an object ({{name}}…). */
function parseTemplate(raw: unknown): { name: string; language: string; params: TemplateParams } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'template must be an object' }
  const t = raw as Record<string, unknown>
  if (typeof t.name !== 'string' || !TEMPLATE_NAME.test(t.name)) return { error: 'Invalid template name' }
  if (typeof t.language !== 'string' || !TEMPLATE_LANG.test(t.language)) return { error: 'Invalid template language' }
  const p = t.params
  if (p === undefined || p === null) return { name: t.name, language: t.language, params: { kind: 'positional', values: [] } }
  if (Array.isArray(p)) {
    if (p.length > MAX_PARAMS) return { error: 'Too many template parameters' }
    if (p.some(v => typeof v !== 'string' && typeof v !== 'number')) return { error: 'Template parameters must be strings' }
    return { name: t.name, language: t.language, params: { kind: 'positional', values: p.map(v => cleanTemplateParam(String(v))) } }
  }
  if (typeof p === 'object') {
    const entries = Object.entries(p as Record<string, unknown>)
    if (entries.length > MAX_PARAMS) return { error: 'Too many template parameters' }
    const values: Record<string, string> = {}
    for (const [k, v] of entries) {
      if (!PARAM_NAME.test(k)) return { error: 'Invalid template parameter name' }
      if (typeof v !== 'string' && typeof v !== 'number') return { error: 'Template parameters must be strings' }
      values[k] = cleanTemplateParam(String(v))
    }
    return { name: t.name, language: t.language, params: { kind: 'named', values } }
  }
  return { error: 'params must be an array or an object' }
}

/** Body text with the parameters filled in — stored as the message content shown in the inbox. */
function renderTemplateBody(body: string, params: TemplateParams): string {
  return body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (m, key: string) => {
    if (params.kind === 'positional') {
      const i = parseInt(key, 10)
      return Number.isFinite(i) && params.values[i - 1] !== undefined ? params.values[i - 1] : m
    }
    return params.values[key] ?? m
  })
}

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'ptt', 'document', 'sticker'])

const OUTSIDE_WINDOW = {
  success: false,
  inWindow: false,
  outside_window: true,
  error: 'outside_window',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireMemberAccess(req, res, 'inbox')
  if (!user) return

  const { to, text, instance_id, contact_id, media_url, media_type, media_mime_type, media_filename, template } = req.body || {}
  // A text message, a media message (with optional caption=text) or a template is required.
  if (!to || typeof to !== 'string') return res.status(400).json({ error: 'to required' })
  if (!text && !media_url && !template) return res.status(400).json({ error: 'text, media_url or template required' })
  if (text !== undefined && typeof text !== 'string') return res.status(400).json({ error: 'text must be a string' })

  const db = supabaseAdmin()

  // Get instance
  const { data: instance } = await db
    .from('whatsapp_instances')
    .select('id,user_id,phone_number_id,access_token,waba_id,instance_type,type,status')
    .eq('id', instance_id)
    .eq('user_id', user.userId)
    .maybeSingle()

  if (!instance) return res.status(404).json({ error: 'Instance not found' })

  const provider = resolveProvider(instance)
  const isJid = /@(lid|g\.us|s\.whatsapp\.net|broadcast)$/.test(to)
  const cleanPhone = isJid ? to : to.replace(/[^0-9]/g, '')
  const sentBy = user.actualUserId || user.userId

  // ── Template send path (Cloud API) ──
  if (template !== undefined) {
    if (provider !== 'cloud_api') {
      return res.status(400).json({ error: 'Templates can only be sent from WhatsApp Cloud API numbers', code: 'templates_cloud_only' })
    }
    const parsed = parseTemplate(template)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })

    // Confirm the template is approved in this language (and get its body for
    // the stored preview). If Meta can't be reached, Meta itself rejects an
    // unknown template on send.
    let body = ''
    if (instance.waba_id) {
      try {
        const list = await getMessageTemplates(instance.waba_id, instance.access_token)
        const found = ((list?.data || []) as any[]).find(t => t?.name === parsed.name && t?.language === parsed.language)
        if (!found || found.status !== 'APPROVED') {
          return res.status(400).json({ error: 'Template not found or not approved for this number', code: 'template_not_approved' })
        }
        body = (found.components || []).find((c: any) => c?.type === 'BODY')?.text || ''
      } catch (e: any) {
        console.warn('[live_chat] template lookup failed:', e?.response?.data?.error?.message || e?.message)
      }
    }

    const parameters = parsed.params.kind === 'positional'
      ? parsed.params.values.map(v => ({ type: 'text', text: v }))
      : Object.entries(parsed.params.values).map(([k, v]) => ({ type: 'text', parameter_name: k, text: v }))
    const preview = (body ? renderTemplateBody(body, parsed.params) : '') || `[${parsed.name}]`

    console.log(`[live_chat] template send to=${cleanPhone} template=${parsed.name} lang=${parsed.language} instance=${instance.id}`)
    const r = await smartSend({
      userId: user.userId,
      instanceId: instance.id,
      phoneNumberId: instance.phone_number_id,
      accessToken: instance.access_token,
      to: cleanPhone,
      text: preview,
      contactId: contact_id || null,
      source: 'live_chat',
      forceTemplate: true,
      templateNameOverride: parsed.name,
      templateLanguage: parsed.language,
      templateComponents: parameters.length ? [{ type: 'body', parameters }] : [],
      sentBy,
    })
    if (r.error) return res.status(r.blocked ? 403 : 502).json({ error: r.error, code: r.blocked })
    return res.status(200).json({ success: true, wa_message_id: r.messageId, method: 'template', template: parsed.name, content: preview })
  }
  // ── End template send path ──

  // ── Media send path ──
  if (media_url) {
    if (typeof media_url !== 'string') return res.status(400).json({ error: 'media_url must be a string' })
    const type = MEDIA_TYPES.has(media_type) ? media_type : 'document'
    console.log(`[live_chat] media send to=${cleanPhone} type=${type} provider=${provider.toUpperCase()} instance=${instance.id}`)

    const r = await smartSendMedia({
      userId: user.userId,
      instance,
      to: cleanPhone,
      mediaUrl: media_url,
      mediaType: type,
      caption: text || undefined,
      mimeType: typeof media_mime_type === 'string' ? media_mime_type.slice(0, 100) : undefined,
      filename: media_filename ? sanitizeDisplayFilename(media_filename) : undefined,
      contactId: contact_id || null,
      source: 'live_chat',
      sentBy,
    })
    if (r.error === 'outside_window') {
      return res.status(403).json({
        ...OUTSIDE_WINDOW,
        message: 'This contact is outside the 24-hour messaging window. You can only send media after the customer messages you first.',
      })
    }
    if (r.error) return res.status(r.blocked ? 403 : 502).json({ error: r.error, code: r.blocked })
    return res.status(200).json({ success: true, wa_message_id: r.messageId, method: 'media', inWindow: r.inWindow })
  }
  // ── End media send path ──

  console.log(`[live_chat] send to=${cleanPhone} provider=${provider.toUpperCase()} instance=${instance.id}`)

  // WA Web — always send text directly, no window restriction
  if (provider === 'wa_web') {
    const r = await smartSendWAWeb({
      userId: user.userId,
      instanceId: instance.id,
      to: cleanPhone,
      text,
      contactId: contact_id || null,
      source: 'live_chat',
      sentBy,
    })
    console.log(`[live_chat] WA_WEB result: msgId=${r.messageId} error=${r.error || 'none'}`)
    if (r.error) return res.status(r.blocked ? 403 : 400).json({ error: r.error, code: r.blocked })
    return res.status(200).json({ success: true, wa_message_id: r.messageId, method: 'text' })
  }

  // Cloud API — check the 24h window for THIS number on THIS instance
  const inWindow = await isInWindow(user.userId, cleanPhone, instance.id)

  console.log(`[live_chat] inWindow=${inWindow} phone=${cleanPhone}`)

  if (inWindow) {
    // Inside window — send text directly
    const r = await smartSend({
      userId: user.userId,
      instanceId: instance.id,
      phoneNumberId: instance.phone_number_id,
      accessToken: instance.access_token,
      to: cleanPhone,
      text,
      contactId: contact_id || null,
      source: 'live_chat',
      forceTemplate: false,
      sentBy,
    })
    console.log(`[live_chat] IN_WINDOW result: method=${r.method} msgId=${r.messageId}`)
    if (r.error) return res.status(r.blocked ? 403 : 400).json({ error: r.error, code: r.blocked, inWindow: true })
    return res.status(200).json({ success: true, wa_message_id: r.messageId, method: 'text', inWindow: true })
  }

  // Outside 24h window — cannot send free text
  // Return 403 so the UI shows the agent a clear notice
  console.log(`[live_chat] OUTSIDE_WINDOW — blocking send, notifying agent`)
  return res.status(403).json({
    ...OUTSIDE_WINDOW,
    message: 'This contact is outside the 24-hour messaging window. You can only reply after the customer sends you a message first.',
  })
}
