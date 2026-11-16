import { smartSend, smartSendWAWeb, resolveProvider, isInWindow, checkSendAllowed } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { handleCors, apiRateLimit } from '@/lib/middleware'
import { authenticateApiKey } from '@/lib/api-key-auth'
import { insertMessage } from '@/lib/message-insert'
import { v4 as uuidv4 } from 'uuid'

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
  if (!apiRateLimit(req, res)) return

  const auth = await authenticateApiKey(req, { allowJwt: true, route: '/api/v1' })
  if (!auth) return res.status(401).json({ error: 'Invalid API key' })

  const { action } = req.query
  const db = supabaseAdmin()

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
    const { data: instances } = await instanceQuery.order('created_at', { ascending: true }).limit(5)
    // Prefer connected, fallback to any
    const instance = instances?.find(i => i.status === 'connected') || instances?.[0] || null

    if (!instance) {
      return res.status(404).json({ error: 'No connected WhatsApp instance' })
    }

    // Plan limit + opt-out, checked once here because some paths below send
    // templates directly (the inner smartSend calls are told it is done).
    const guard = await checkSendAllowed(auth.userId, to)
    if (!guard.allowed) return res.status(403).json({ error: guard.error, code: guard.code })

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
            return res.status(422).json({
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
          const codeMatch = message.match(/\b(\d{4,8})\b/)
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
              return res.status(422).json({
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
            if (explicitTemplate && body.template_params) {
              const params = Object.entries(body.template_params).map(([k, v]) => ({
                type: 'text', parameter_name: k, text: String(v),
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

            const tmplLanguages = ['en', 'en_US']
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
                }
              }
              if (sent) break
            }

            if (!sent) {
              const lastAttempt = tmplAttempts[tmplAttempts.length - 1]
              return res.status(422).json({
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
      if (result?.error) return res.status(502).json({ error: 'Failed to send message', detail: result.error })
      // Template paths above send directly — store their row once here
      if (!saved) {
        await insertMessage({ user_id: auth.userId, instance_id: instance.id, contact_id: null, direction: 'outbound', type: 'text', content: message, wa_message_id: result?.messageId || null, status: 'sent', meta: { source: 'api' } })
      }
      return res.status(200).json({ success: true, message_id: result?.messageId })
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { data?: unknown } }
      console.error('[v1/send] error:', e?.message, e?.response?.data)
      return res.status(500).json({ error: 'Failed to send message' })
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
    if (!phone) return res.status(400).json({ error: 'phone required' })
    const { data, error } = await db.from('contacts').upsert({ id: uuidv4(), user_id: auth.userId, phone, name, email, tags: tags || [] }, { onConflict: 'user_id,phone' }).select().single()
    if (error) return res.status(500).json({ error: 'Failed to save contact' })
    return res.status(200).json({ contact: data })
  }

  // POST /api/v1/otp - Send OTP
  if (req.method === 'POST' && action === 'otp') {
    const { phone, purpose } = req.body
    if (!phone) return res.status(400).json({ error: 'phone required' })
    const { sendOTP } = await import('@/lib/otp')
    const result = await sendOTP({ userId: auth.userId, phone, purpose: purpose || 'verification' })
    return res.status(200).json(result)
  }

  // POST /api/v1/otp/verify - Verify OTP
  if (req.method === 'POST' && action === 'otp-verify') {
    const { otp_id, otp } = req.body
    if (!otp_id || !otp) return res.status(400).json({ error: 'otp_id and otp required' })
    // Only OTPs issued for this API key's account can be verified with it
    const { data: owned } = await db.from('otp_codes').select('id').eq('id', String(otp_id)).eq('user_id', auth.userId).maybeSingle()
    if (!owned) return res.status(200).json({ valid: false, reason: 'OTP not found' })
    const { verifyOTP } = await import('@/lib/otp')
    const result = await verifyOTP({ otpId: otp_id, otp })
    return res.status(200).json(result)
  }

  // POST /api/v1/whmcs-webhook - WHMCS webhook receiver
  if (req.method === 'POST' && action === 'whmcs-webhook') {
    const { processWHMCSWebhook } = await import('@/lib/whmcs')
    try {
      await processWHMCSWebhook(auth.userId, req.body)
    } catch (e: any) {
      console.error('[v1/whmcs-webhook] error:', e?.message)
      return res.status(502).json({ success: false, error: 'Failed to process webhook' })
    }
    return res.status(200).json({ success: true })
  }

  return res.status(404).json({ error: 'Unknown action' })
}
