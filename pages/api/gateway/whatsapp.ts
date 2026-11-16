import { smartSend, smartSendWAWeb, resolveProvider, isInWindow, checkSendAllowed } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { handleCors, rateLimitAsync, rateLimitByKey } from '@/lib/middleware'
import { authenticateApiKey, apiKeyHasPermission, apiPlanAllowed, PLAN_NO_API_ERROR, permissionDeniedError } from '@/lib/api-key-auth'
import { insertMessage } from '@/lib/message-insert'

const ipLimiter = rateLimitAsync({ maxRequests: 300, windowMs: 60 * 1000 })
const KEY_LIMIT = { maxRequests: 100, windowMs: 60 * 1000 }

// Compatible with Digits WordPress Plugin Custom Gateway
// Configure in Digits:
//   URL: https://waabek.com/api/gateway/whatsapp
//   Method: POST or GET
//   Headers: X-API-Key:YOUR_KEY
//   Params: to:{to}, message:{message}
// (?api_key= / ?key= / body api_key still work for existing installs but are
// deprecated — see lib/api-key-auth.)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleCors(req, res)) return
  if (!(await ipLimiter(req, res))) return

  const auth = await authenticateApiKey(req, { allowBody: true, route: '/api/gateway/whatsapp' })
  if (!auth) return res.status(401).json({ error: 'Invalid API key', code: 'UNAUTHORIZED' })
  if (!(await rateLimitByKey(res, `gw:${auth.keyId || auth.userId}`, KEY_LIMIT))) return
  if (!(await apiPlanAllowed(auth))) return res.status(403).json(PLAN_NO_API_ERROR)
  if (!apiKeyHasPermission(auth, 'send')) return res.status(403).json(permissionDeniedError('send'))
  const userId = auth.userId

  // Support both GET and POST (Digits uses both)
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const params: Record<string, unknown> = req.method === 'GET' ? req.query : { ...req.query, ...body }
  const pickStr = (...keys: string[]) => {
    for (const k of keys) { const v = params[k]; if (typeof v === 'string' && v) return v }
    return ''
  }

  const to = pickStr('to', 'phone', 'mobile')
  const message = pickStr('message', 'text', 'msg')
  const instanceId = pickStr('instance_id', 'sender_id', 'sender')

  if (!to) return res.status(400).json({ error: 'Phone number required (to)', code: 'MISSING_TO' })
  if (!message) return res.status(400).json({ error: 'Message required (message)', code: 'MISSING_MESSAGE' })

  const db = supabaseAdmin()

  // Get instance (always the key owner's)
  let instanceQuery = db.from('whatsapp_instances')
    .select('id, user_id, status, instance_type, type, phone_number_id, access_token')
    .eq('user_id', userId).eq('status', 'connected')
  if (instanceId) instanceQuery = instanceQuery.eq('id', instanceId)
  const { data: instances } = await instanceQuery.limit(1)
  const instance = instances?.[0]

  if (!instance) {
    return res.status(404).json({ error: 'No connected WhatsApp instance found', code: 'NO_INSTANCE' })
  }

  // Clean phone number
  const cleanPhone = to.replace(/[^0-9]/g, '')

  let result: { messageId?: string | null; error?: string; blocked?: string }
  const otpMatch = message.length <= 300 && /code|otp|verif|رمز|كود|تحقق/i.test(message) ? message.match(/\b(\d{4,8})\b/) : null
  if (resolveProvider(instance) !== 'wa_web' && otpMatch && !(await isInWindow(userId, cleanPhone, instance.id))) {
    // Digits / OTP plugins send the code as plain text. Outside the 24h
    // window plain text cannot be delivered — send the code through the
    // approved Authentication template instead (never an unrelated template).
    const guard = await checkSendAllowed(userId, cleanPhone)
    if (!guard.allowed) return res.status(403).json({ error: guard.error, code: (guard.code || 'blocked').toUpperCase() })
    const { sendOtpTemplate } = await import('@/lib/otp-template')
    const { getSetting } = await import('@/lib/settings')
    const otpTemplateName = await getSetting('otp_template_name', 'wabek_otp') as string
    const otp = await sendOtpTemplate({ phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: cleanPhone, templateName: otpTemplateName, code: otpMatch[1] })
    if (otp.sent) {
      // Store without the code itself
      await insertMessage({ user_id: userId, instance_id: instance.id, contact_id: null, direction: 'outbound', type: 'text', content: '[OTP]', wa_message_id: otp.messageId || null, status: 'sent', meta: { source: 'api', method: 'template', template: otp.usedTemplateName } })
      result = { messageId: otp.messageId || null }
    } else {
      result = { error: 'outside_window' }
    }
  } else {
    result = resolveProvider(instance) === 'wa_web'
      ? await smartSendWAWeb({ userId, instanceId: instance.id, to: cleanPhone, text: message, source: 'api' })
      : await smartSend({ userId, instanceId: instance.id, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: cleanPhone, text: message, source: 'api' })
  }

  if (result.error === 'outside_window') {
    return res.status(422).json({
      error: 'Recipient is outside the 24-hour WhatsApp window: plain text cannot be delivered. Use /api/v1/send with an approved template, or configure an Authentication template for codes.',
      code: 'OUTSIDE_WINDOW',
    })
  }
  if (result.error) {
    return res.status(result.blocked ? 403 : 502).json({ error: result.error, code: result.blocked ? result.blocked.toUpperCase() : 'SEND_FAILED' })
  }
  const messageId = result.messageId || ''

  // Digits expects specific response format
  return res.status(200).json({
    success: true,
    status: 'sent',
    message_id: messageId,
    to: cleanPhone,
    // Digits compatibility
    data: { message_id: messageId },
  })
}
