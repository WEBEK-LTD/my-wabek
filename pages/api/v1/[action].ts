import { smartSend, smartSendWAWeb, resolveProvider, isInWindow, checkSendAllowed } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { handleCors, rateLimitAsync, rateLimitByKey, checkPlanLimit, contactLimitError } from '@/lib/middleware'
import {
  authenticateApiKey, apiKeyHasPermission, apiPlanAllowed, ApiKeyPermission,
  PLAN_NO_API_ERROR, permissionDeniedError,
} from '@/lib/api-key-auth'
import { insertMessage } from '@/lib/message-insert'
import { emitWebhookEvent } from '@/lib/outgoing-webhooks'
import { isMissingDbObject, warnMissingOnce } from '@/lib/db-compat'

// Per-IP ceiling before authentication (slows key guessing), then the
// per-API-key limit. Both are shared across serverless instances and answer
// 429 with a Retry-After header.
const ipLimiter = rateLimitAsync({ maxRequests: 300, windowMs: 60 * 1000 })
const KEY_LIMIT = { maxRequests: 100, windowMs: 60 * 1000 }

// Permission each action needs on an API key (api_keys.permissions).
function requiredPermission(method: string | undefined, action: string): ApiKeyPermission | null {
  switch (action) {
    case 'send': case 'message-status': case 'instances': case 'whmcs-webhook': return 'send'
    case 'contacts': return method === 'GET' ? 'contacts:read' : 'contacts:write'
    case 'contacts-opt-out': case 'opt-out': return 'contacts:write'
    case 'otp': case 'otp-verify': return 'otp'
    default: return null
  }
}

// Auth: `X-API-Key: <key>` or `Authorization: Bearer <key|session JWT>`.
// `?api_key=` still works for existing installs (deprecated, logged) unless
// ALLOW_QUERY_API_KEY=0.

/**
 * The verification code of an OTP send: the `code` field (4-8 digits), or
 * the code found in `message` when the caller says `type: "otp"`. Null for
 * every other message.
 */
function otpCode(body: Record<string, any>): string | null {
  const explicit = typeof body.code === 'string' || typeof body.code === 'number' ? String(body.code).trim() : ''
  if (/^\d{4,8}$/.test(explicit)) return explicit
  if (body.type === 'otp' && typeof body.message === 'string') {
    const match = body.message.match(/\b(\d{4,8})\b/)
    if (match) return match[1]
  }
  return null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleCors(req, res)) return
  if (!(await ipLimiter(req, res))) return

  const auth = await authenticateApiKey(req, { allowJwt: true, route: '/api/v1' })
  if (!auth) return res.status(401).json({ error: 'Invalid API key' })

  if (!(await rateLimitByKey(res, `v1:${auth.keyId || auth.userId}`, KEY_LIMIT))) return

  const { action } = req.query
  const db = supabaseAdmin()

  if (!(await apiPlanAllowed(auth))) return res.status(403).json(PLAN_NO_API_ERROR)

  const needed = requiredPermission(req.method, String(action || ''))
  if (needed && !apiKeyHasPermission(auth, needed)) return res.status(403).json(permissionDeniedError(needed))

  // ── Robust body parsing ─────────────────────────────────────────────
  // Some HTTP clients (e.g. PHP cURL with the wrong Content-Type, or
  // form-encoded posts) result in `req.body` being a raw string, or the
  // values being nested under `fields` / sent with different casing.
  // Normalize everything into a single plain object so handlers below
  // can rely on `req.body.<field>` always working.
  let body: Record<string, any> = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  if (!body || typeof body !== 'object') body = {}
  // Also fall back to query-string params (?phone=..., ?to=..., etc.)
  const { api_key: _k, key: _k2, ...queryParams } = req.query
  body = { ...queryParams, ...body }
  delete body.api_key
  req.body = body

  // Accept "phone" and "to" interchangeably across all actions in this file
  if (!body.phone && body.to) body.phone = body.to
  if (!body.to && body.phone) body.to = body.phone

  // POST /api/v1/send - Send a message
  if (req.method === 'POST' && action === 'send') {
    const { to, message, instance_id } = req.body
    if (!to || !message || typeof to !== 'string' || typeof message !== 'string') return res.status(400).json({ error: 'to and message required' })

    // Get instance — specific or first available (any status)
    let instanceQuery = db.from('whatsapp_instances').select('*')
      .eq('user_id', auth.userId)
    if (instance_id) {
      instanceQuery = instanceQuery.eq('id', instance_id)
    }
    const { data: instances } = await instanceQuery.order('created_at', { ascending: true }).limit(instance_id ? 1 : 50)
    // Prefer the account's default connected number, then any connected, then any
    const instance = instances?.find(i => i.is_default && i.status === 'connected')
      || instances?.find(i => i.status === 'connected')
      || instances?.[0] || null

    if (!instance) {
      return res.status(404).json({ error: 'No connected WhatsApp instance' })
    }

    // Plan limit + opt-out, checked once here because some paths below send
    // templates directly (the inner smartSend calls are told it is done).
    const guard = await checkSendAllowed(auth.userId, to)
    if (!guard.allowed) return res.status(403).json({ error: guard.error, code: guard.code })

    // Optional Idempotency-Key: a retried request with the same key returns
    // the first result instead of sending the message twice.
    const idemHeader = req.headers['idempotency-key']
    let idemKey = typeof idemHeader === 'string' && /^[A-Za-z0-9._:-]{8,100}$/.test(idemHeader) ? idemHeader : null
    if (idemKey) {
      // Best effort: if api_idempotency_keys (migration 031) is missing or
      // unreachable, the send goes ahead without idempotency (old behaviour)
      // instead of failing with 409.
      const { data: prior, error: priorErr } = await db.from('api_idempotency_keys')
        .select('response, created_at')
        .eq('user_id', auth.userId).eq('key', idemKey)
        .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .maybeSingle()
      if (priorErr) {
        if (isMissingDbObject(priorErr)) warnMissingOnce('api_idempotency_keys', priorErr)
        else console.error('[v1/send] idempotency lookup failed (sending without it):', priorErr.message)
        idemKey = null
      } else {
        if (prior?.response) return res.status(200).json({ ...(prior.response as object), idempotent_replay: true })
        if (prior) return res.status(409).json({ error: 'A request with this Idempotency-Key is still in progress', code: 'idempotency_in_progress' })
        const { error: claimErr } = await db.from('api_idempotency_keys').insert({ user_id: auth.userId, key: idemKey })
        if (claimErr) {
          // Only a unique violation means another request holds the key.
          if (claimErr.code === '23505') return res.status(409).json({ error: 'A request with this Idempotency-Key is still in progress', code: 'idempotency_in_progress' })
          if (isMissingDbObject(claimErr)) warnMissingOnce('api_idempotency_keys', claimErr)
          else console.error('[v1/send] idempotency claim failed (sending without it):', claimErr.message)
          idemKey = null
        }
      }
    }
    const releaseIdem = async () => {
      if (idemKey) await db.from('api_idempotency_keys').delete().eq('user_id', auth.userId).eq('key', idemKey).is('response', null)
    }
    const respondSent = async (payload: Record<string, unknown>) => {
      if (idemKey) await db.from('api_idempotency_keys').update({ response: payload }).eq('user_id', auth.userId).eq('key', idemKey)
      return res.status(200).json(payload)
    }

    try {
      let result: { messageId?: string | null; error?: string } | undefined
      // true when smartSend / smartSendWAWeb already stored the message row
      let saved = false
      if (resolveProvider(instance) === 'wa_web') {
        result = await smartSendWAWeb({ userId: auth.userId, instanceId: instance.id, to, text: message, source: 'api', bypassLimits: true /* checked above */ })
        saved = true
      } else if (otpCode(body)) {
        // A sign-in code (`type: "otp"` or a `code` field): always through the
        // approved Authentication template, which WhatsApp delivers inside or
        // outside the 24h window. Plain text is only a fallback inside the
        // window, when no Authentication template works on this account.
        const code = otpCode(body) as string
        const { sendOtpTemplate } = await import('@/lib/otp-template')
        const { getSetting } = await import('@/lib/settings')
        const otpTemplateName = await getSetting('otp_template_name', 'wabek_otp') as string
        const otpResult = await sendOtpTemplate({
          phoneNumberId: instance.phone_number_id,
          accessToken:   instance.access_token,
          to,
          templateName:  otpTemplateName,
          code,
        })
        if (otpResult.sent) {
          result = { messageId: otpResult.messageId }
        } else {
          const inWindow = await isInWindow((instance as any)?.user_id || (instance as any)?.userId || '', to, (instance as any)?.id || '')
          if (!inWindow) {
            const lastAttempt = otpResult.attempts[otpResult.attempts.length - 1]
            await releaseIdem(); return res.status(422).json({
              error: 'Failed to deliver the verification code',
              detail: `Tried the Authentication template(s), but all attempts failed. Last error: ${lastAttempt?.error || 'Unknown error'}. Configure "OTP Template Name" in Settings → Security & OTP to match an Approved Authentication template in Meta Business Manager.`,
              attempts: otpResult.attempts,
            })
          }
          console.error('[v1/send] OTP template failed, sending text inside the 24h window:', JSON.stringify(otpResult.attempts))
          result = await smartSend({ userId: auth.userId, instanceId: instance.id, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: to, text: message, source: 'api', bypassLimits: true /* checked above */ })
          saved = true
        }
      } else {
        // Outside the 24h customer-service window, WhatsApp requires an
        // approved TEMPLATE message — plain text cannot be delivered.
        // Sending a generic "broadcast_notification" template here would
        // deliver the WRONG message to the recipient (not the intended
        // text), so we reject with clear guidance instead.
        const inWindow = await isInWindow((instance as any)?.user_id || (instance as any)?.userId || '', to, (instance as any)?.id || '')
        if (!inWindow) {
          // OTP/verification messages are designed to bypass the 24h window
          // entirely via an Authentication template. If the message text
          // contains a numeric code, send it through the OTP template
          // automatically instead of rejecting or sending an unrelated
          // broadcast template.
          // Legacy heuristic, kept ONLY for old integrations that send codes as
          // plain text without `type`. Any caller that declares a `type` (e.g.
          // "notification") or names a `template` never goes down this path —
          // otherwise order numbers/totals would be sent as fake OTP codes.
          const legacyUntyped = !body.type && !body.template
          const codeMatch = legacyUntyped && message.length <= 300 && /code|otp|verif|رمز|كود|تحقق/i.test(message)
            ? message.match(/\b(\d{4,8})\b/)
            : null
          if (codeMatch) {
            const { sendOtpTemplate } = await import('@/lib/otp-template')
            const { getSetting } = await import('@/lib/settings')
            const otpTemplateName = await getSetting('otp_template_name', 'wabek_otp') as string

            const otpResult = await sendOtpTemplate({
              phoneNumberId: instance.phone_number_id,
              accessToken:   instance.access_token,
              to,
              templateName:  otpTemplateName,
              code:          codeMatch[1],
            })

            if (otpResult.sent) {
              result = { messageId: otpResult.messageId }
            } else {
              const lastAttempt = otpResult.attempts[otpResult.attempts.length - 1]
              await releaseIdem(); return res.status(422).json({
                error: 'Failed to deliver message outside the 24h window',
                detail: `Detected a verification code (${codeMatch[1]}) and tried sending via Authentication template(s), but all attempts failed. Last error: ${lastAttempt?.error || 'Unknown error'}. Configure "OTP Template Name" in Settings → Security & OTP to match an Approved Authentication template in Meta Business Manager.`,
                attempts: otpResult.attempts,
              })
            }
          } else {
            // Not an OTP code. Outside the window we still need an approved
            // TEMPLATE to deliver anything. Use either:
            //  - an explicit `template` + `template_params` provided by the caller, or
            //  - the configured "Marketing" template (e.g. marketing_offer) with a
            //    `customer_name` parameter, as a sensible default for campaigns.
            const { sendTemplateMessage } = await import('@/lib/whatsapp')
            const { getTemplateName } = await import('@/lib/wa-smart-send')

            const explicitTemplate: string | undefined = body.template
            const customerName: string = body.template_params?.customer_name || body.customer_name || 'Customer'
            // Sanitize for use as a Meta template parameter (no newlines/tabs/4+ spaces)
            const offerDetails: string = (message || 'We have a special offer for you.')
              .replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 1024)

            const templateName = explicitTemplate || await getTemplateName('MARKETING')

            // Build component variants to try -- different Marketing templates may
            // use a NAMED parameter (e.g. {{customer_name}}) or a POSITIONAL one
            // ({{1}}). Also try "en" and "en_US" since approved language can vary.
            let variantList: { label: string; components: any[] }[]
            if (explicitTemplate && Array.isArray(body.template_params)) {
              // Positional parameters: ["Ahmed", "#4821"] → {{1}}, {{2}}
              const params = (body.template_params as unknown[]).slice(0, 20).map(v => ({ type: 'text', text: String(v).slice(0, 1024) }))
              variantList = [
                { label: 'positional params (explicit)', components: [{ type: 'body', parameters: params }] },
              ]
            } else if (explicitTemplate && body.template_params && typeof body.template_params === 'object') {
              const params = Object.entries(body.template_params).slice(0, 20).map(([k, v]) => ({
                type: 'text', parameter_name: k, text: String(v).slice(0, 1024),
              }))
              variantList = [
                { label: 'named params (explicit)', components: [{ type: 'body', parameters: params }] },
              ]
            } else {
              variantList = [
                { label: '2 named params: customer_name + offer_details', components: [{ type: 'body', parameters: [
                  { type: 'text', parameter_name: 'customer_name', text: customerName },
                  { type: 'text', parameter_name: 'offer_details', text: offerDetails },
                ] }] },
                { label: 'named param: customer_name', components: [{ type: 'body', parameters: [{ type: 'text', parameter_name: 'customer_name', text: customerName }] }] },
                { label: 'positional {{1}}',           components: [{ type: 'body', parameters: [{ type: 'text', text: customerName }] }] },
              ]
            }

            // Caller may name the template's approved language (e.g. "ar");
            // otherwise try the common defaults.
            const requestedLang = typeof body.template_language === 'string' && /^[a-z]{2,3}(_[A-Z]{2,4})?$/.test(body.template_language)
              ? body.template_language
              : null
            const { templateLanguageOrder } = await import('@/lib/wa-smart-send')
            // The given language first, then 'ar' -> 'en' -> 'en_US'
            const tmplLanguages = templateLanguageOrder(requestedLang)
            const tmplAttempts: { language: string; components: string; ok: boolean; status?: number; error?: string }[] = []
            let sent = false

            for (const language of tmplLanguages) {
              for (const variant of variantList) {
                try {
                  const tmplResult: any = await sendTemplateMessage({
                    phoneNumberId: instance.phone_number_id,
                    accessToken:   instance.access_token,
                    to,
                    templateName,
                    languageCode: language,
                    components: variant.components,
                  })
                  result = { messageId: tmplResult?.messages?.[0]?.id }
                  tmplAttempts.push({ language, components: variant.label, ok: true })
                  sent = true
                  break
                } catch (tmplErr: any) {
                  const status = tmplErr?.response?.status
                  const errMsg = tmplErr?.response?.data?.error?.message || tmplErr?.message || 'Unknown error'
                  tmplAttempts.push({ language, components: variant.label, ok: false, status, error: errMsg })
                  // 132001: no template in this language - other shapes cannot help
                  if (tmplErr?.response?.data?.error?.code === 132001) break
                }
              }
              if (sent) break
            }

            if (!sent) {
              const lastAttempt = tmplAttempts[tmplAttempts.length - 1]
              await releaseIdem(); return res.status(422).json({
                error: 'Recipient is outside the 24-hour messaging window',
                detail: `Plain text cannot be delivered outside the 24h window. Tried sending via the "${templateName}" template (customer_name="${customerName}"), but all attempts failed. Last error: ${lastAttempt?.error || 'Unknown error'}. ` +
                  'Make sure this template is Approved on Meta Business Manager and its body has either a {{customer_name}} named parameter or a single {{1}} positional parameter. ' +
                  'Alternatively, pass a "template" + "template_params" in the request to use a specific Approved template.',
                attempts: tmplAttempts,
              })
            }
          }
        } else {
          result = await smartSend({ userId: auth.userId, instanceId: instance.id, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: to, text: message, source: 'api', bypassLimits: true /* checked above */ })
          saved = true
        }
      }
      if (result?.error) { await releaseIdem(); return res.status(502).json({ error: 'Failed to send message', detail: result.error }) }
      // Template paths above send directly — store their row once here
      if (!saved) {
        const row = await insertMessage({ user_id: auth.userId, instance_id: instance.id, contact_id: null, direction: 'outbound', type: 'text', content: message, wa_message_id: result?.messageId || null, status: 'sent', meta: { source: 'api' } })
        if (!row.error) {
          await emitWebhookEvent(auth.userId, 'message_sent', {
            message_id: result?.messageId || null, id: row.id, to: String(to).replace(/[^0-9]/g, ''), instance_id: instance.id,
            contact_id: null, type: 'text', message, source: 'api', method: 'template', campaign_id: null,
          })
        }
      }
      return respondSent({ success: true, message_id: result?.messageId })
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { data?: unknown } }
      console.error('[v1/send] error:', e?.message, e?.response?.data)
      await releaseIdem(); return res.status(500).json({ error: 'Failed to send message' })
    }
  }

  // GET /api/v1/contacts - List contacts
  if (req.method === 'GET' && action === 'contacts') {
    const { data } = await db.from('contacts').select('*').eq('user_id', auth.userId).limit(100)
    return res.status(200).json({ contacts: data })
  }

  // POST /api/v1/contacts - Create contact
  if (req.method === 'POST' && action === 'contacts') {
    const { phone, name, email, tags } = req.body
    if (!phone || typeof phone !== 'string') return res.status(400).json({ error: 'phone required' })
    // Never send `id` in the upsert: on conflict it would replace the existing
    // contact's id and break its conversations/messages.
    const row: Record<string, unknown> = { user_id: auth.userId, phone }
    if (typeof name === 'string') row.name = name.slice(0, 200)
    if (typeof email === 'string') row.email = email.slice(0, 200)
    if (Array.isArray(tags)) row.tags = tags.filter(t => typeof t === 'string').slice(0, 50)
    const { data: before } = await db.from('contacts').select('id').eq('user_id', auth.userId).eq('phone', phone).limit(1)
    const isNew = !before?.length
    if (isNew) {
      const lim = await checkPlanLimit(auth.userId, 'contacts')
      if (!lim.allowed) return res.status(403).json(contactLimitError(lim.limit))
    }
    const { data, error } = await db.from('contacts').upsert(row, { onConflict: 'user_id,phone' }).select().single()
    if (error) return res.status(500).json({ error: 'Failed to save contact' })
    if (isNew) {
      await emitWebhookEvent(auth.userId, 'contact_created', {
        contact_id: data.id, phone: data.phone, name: data.name || null, email: data.email || null,
        tags: data.tags || [], source: 'api',
      })
    }
    return res.status(200).json({ contact: data, created: isNew })
  }

  // POST /api/v1/contacts-opt-out - {phone, opted_out: boolean}
  // Records the recipient's choice so every send path on the platform honours it.
  if (req.method === 'POST' && (action === 'contacts-opt-out' || action === 'opt-out')) {
    const { phone, opted_out } = req.body
    if (!phone || typeof phone !== 'string') return res.status(400).json({ error: 'phone required' })
    const optedOut = opted_out === undefined ? true : (opted_out === true || opted_out === 'true' || opted_out === 1 || opted_out === '1')
    const { phoneVariants } = await import('@/lib/wa-smart-send')
    const variants = phoneVariants(phone)
    const { data: existing } = await db.from('contacts').select('id, opted_out').eq('user_id', auth.userId).in('phone', variants)
    let contactId: string | null = null
    let changed = false
    if (existing && existing.length) {
      const { error } = await db.from('contacts').update({ opted_out: optedOut }).eq('user_id', auth.userId).in('id', existing.map(r => r.id))
      if (error) return res.status(500).json({ error: 'Failed to update contact' })
      contactId = existing[0].id
      changed = existing.some(r => (r.opted_out === true) !== optedOut)
    } else {
      const lim = await checkPlanLimit(auth.userId, 'contacts')
      if (!lim.allowed) return res.status(403).json(contactLimitError(lim.limit))
      const { data: created, error } = await db.from('contacts').insert({ user_id: auth.userId, phone, opted_out: optedOut }).select('id, phone').maybeSingle()
      if (error) return res.status(500).json({ error: 'Failed to save contact' })
      contactId = created?.id || null
      changed = true
      if (created) await emitWebhookEvent(auth.userId, 'contact_created', { contact_id: created.id, phone: created.phone, name: null, source: 'api' })
    }
    // Opt-out / opt-in recorded by a plugin (e.g. a checkout checkbox):
    // opt_out / opt_in webhook, and `opt_in` automations on (re)subscribe.
    if (changed) {
      const { onSubscriptionChanged } = await import('@/lib/opt-out')
      await onSubscriptionChanged({ userId: auth.userId, phone, contactId, optedOut, source: 'api' })
    }
    return res.status(200).json({ success: true, opted_out: optedOut })
  }

  // GET /api/v1/message-status?id=<message_id> - delivery status of a message sent by this account
  if (req.method === 'GET' && action === 'message-status') {
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!id || id.length > 200) return res.status(400).json({ error: 'id required' })
    const { data } = await db.from('messages')
      .select('status, created_at, meta')
      .eq('user_id', auth.userId)
      .eq('wa_message_id', id)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return res.status(404).json({ error: 'Message not found' })
    const meta = (data.meta || {}) as Record<string, unknown>
    return res.status(200).json({ id, status: data.status, error: data.status === 'failed' ? (meta.error_title || meta.error || null) : null })
  }

  // GET /api/v1/instances - List this account's WhatsApp numbers (safe fields only)
  if (req.method === 'GET' && action === 'instances') {
    const { data, error } = await db.from('whatsapp_instances')
      .select('id, display_name, phone_number, status, instance_type, is_default, created_at')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: 'Failed to load instances' })
    return res.status(200).json({ instances: data || [] })
  }

  // POST /api/v1/otp - Send OTP from the account's own number
  if (req.method === 'POST' && action === 'otp') {
    const { phone, purpose, instance_id, brand_name } = req.body
    if (!phone || typeof phone !== 'string') return res.status(400).json({ error: 'phone required' })
    const allowedPurposes = ['verification', 'login', 'transaction'] as const
    const safePurpose = (allowedPurposes as readonly string[]).includes(purpose) ? purpose : 'verification'
    // Recipients who opted out / are blocked get no codes either (OTP sends
    // are not counted against the monthly message limit).
    const guard = await checkSendAllowed(auth.userId, phone)
    if (!guard.allowed && guard.code !== 'plan_limit') {
      return res.status(403).json({ success: false, error: guard.error, code: guard.code })
    }
    const { sendOTP, OtpSendError } = await import('@/lib/otp')
    try {
      const result = await sendOTP({
        userId: auth.userId,
        phone,
        purpose: safePurpose as typeof allowedPurposes[number],
        instanceId: typeof instance_id === 'string' ? instance_id : undefined,
        brandName: typeof brand_name === 'string' ? brand_name : undefined,
      })
      return res.status(200).json(result)
    } catch (e: unknown) {
      if (e instanceof OtpSendError) {
        const status = e.code === 'no_instance' ? 409 : e.code === 'internal' ? 500 : 502
        console.error('[v1/otp]', e.code, e.message)
        return res.status(status).json({ success: false, error: 'Failed to send verification code', code: e.code })
      }
      console.error('[v1/otp] unexpected:', (e as Error)?.message)
      return res.status(500).json({ success: false, error: 'Failed to send verification code', code: 'internal' })
    }
  }

  // POST /api/v1/otp-verify - Verify OTP  { otp_id | otpId, otp | code }
  if (req.method === 'POST' && action === 'otp-verify') {
    const otp_id = req.body.otp_id ?? req.body.otpId
    const otp = req.body.otp ?? req.body.code
    if (!otp_id || !otp || (typeof otp_id !== 'string' && typeof otp_id !== 'number') || (typeof otp !== 'string' && typeof otp !== 'number')) {
      return res.status(400).json({ error: 'otp_id and otp required' })
    }
    // Only OTPs issued for this API key's account can be verified with it
    const { data: owned } = await db.from('otp_codes').select('id').eq('id', String(otp_id)).eq('user_id', auth.userId).maybeSingle()
    if (!owned) return res.status(200).json({ valid: false, reason: 'OTP not found' })
    const { verifyOTP } = await import('@/lib/otp')
    const result = await verifyOTP({ otpId: String(otp_id), otp: String(otp), userId: auth.userId })
    return res.status(200).json(result)
  }

  // POST /api/v1/whmcs-webhook - WHMCS webhook receiver
  if (req.method === 'POST' && action === 'whmcs-webhook') {
    const { processWHMCSWebhook } = await import('@/lib/whmcs')
    try {
      const r = await processWHMCSWebhook(auth.userId, req.body)
      if (!r.sent) {
        if (r.reason === 'ignored') return res.status(200).json({ success: true, sent: false, reason: r.detail || 'ignored' })
        const status = r.blocked ? 403 : r.reason === 'outside_window' ? 422 : 502
        return res.status(status).json({ success: false, sent: false, error: r.error || 'Failed to send notification', code: r.blocked || r.reason })
      }
      return res.status(200).json({ success: true, sent: true, message_id: r.messageId || null })
    } catch (e: any) {
      console.error('[v1/whmcs-webhook] error:', e?.message)
      return res.status(502).json({ success: false, error: 'Failed to process webhook' })
    }
  }

  return res.status(404).json({ error: 'Unknown action' })
}
