import { smartSend, smartSendWAWeb, resolveProvider, isInWindow } from '@/lib/wa-smart-send'
import { sendWAWebMessage } from '@/lib/wa-web'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { handleCors, apiRateLimit } from '@/lib/middleware'
import { sendTextMessage } from '@/lib/whatsapp'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

async function authenticateApiKey(req: NextApiRequest): Promise<{ userId: string } | null> {
  const authHeader = req.headers.authorization
  let bearerToken: string | null = null

  // Support JWT auth (from dashboard)
  if (authHeader?.startsWith('Bearer ')) {
    bearerToken = authHeader.slice(7).trim()
    const { verifyToken } = await import('@/lib/auth')
    const payload = await verifyToken(bearerToken)
    if (payload) return { userId: payload.userId }
  }

  // External integrations (e.g. WHMCS) commonly send `Authorization: Bearer <api_key>`
  // instead of `x-api-key`. If the Bearer token wasn't a valid JWT, also try it
  // as a raw API key below.
  const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string) || bearerToken
  if (!apiKey) return null

  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
  const db = supabaseAdmin()

  // Check api_keys table
  const { data: keyRecord } = await db.from('api_keys').select('*').eq('key_hash', keyHash).eq('is_active', true).single()
  if (keyRecord) {
    await db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id)
    return { userId: keyRecord.user_id }
  }

  // Also check user's default api_key
  const { data: user } = await db.from('users').select('id').eq('api_key', apiKey).eq('is_active', true).single()
  if (user) return { userId: user.id }

  return null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleCors(req, res)) return
  if (!apiRateLimit(req, res)) return

  const auth = await authenticateApiKey(req)
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
  body = { ...req.query, ...body }
  req.body = body

  // Accept "phone" and "to" interchangeably across all actions in this file
  if (!body.phone && body.to) body.phone = body.to
  if (!body.to && body.phone) body.to = body.phone

  // POST /api/v1/send - Send a message
  if (req.method === 'POST' && action === 'send') {
    const { to, message, instance_id } = req.body
    if (!to || !message) return res.status(400).json({ error: 'to and message required' })

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
      // Debug: return what we found
      const { data: allInstances } = await db.from('whatsapp_instances').select('id,status,user_id').eq('user_id', auth.userId)
      return res.status(404).json({ 
        error: 'No connected WhatsApp instance',
        debug: { userId: auth.userId, instancesFound: allInstances?.length || 0, instances: allInstances }
      })
    }

    try {
      let result
      if ((instance.instance_type || instance.type) === 'wa_web') {
        const { sendWAWebMessage } = await import('@/lib/wa-web')
        const webResult = await sendWAWebMessage({ instanceId: instance.id, to, text: message })
        result = { messages: [{ id: webResult.messageId }] }
      } else {
        // Outside the 24h customer-service window, WhatsApp requires an
        // approved TEMPLATE message — plain text cannot be delivered.
        // Sending a generic "broadcast_notification" template here would
        // deliver the WRONG message to the recipient (not the intended
        // text), so we reject with clear guidance instead.
        const inWindow = await isInWindow((instance as any)?.user_id || (instance as any)?.userId || '', to, (instance as any)?.id || '')
        if (!inWindow) {
          return res.status(422).json({
            error: 'Recipient is outside the 24-hour messaging window',
            detail: 'Plain text messages can only be sent if the recipient messaged you within the last 24 hours. ' +
              'For OTP/verification codes, use POST /api/v1/otp instead — it sends via an approved Authentication template. ' +
              'For other notifications outside the window, use a template-based send.',
          })
        }
        result = await smartSend({ userId: (instance as any)?.user_id || (instance as any)?.userId || '', instanceId: (instance as any)?.id || '', phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: to, text: message, source: 'api' as any })
      }
      await db.from('messages').insert({ id: uuidv4(), user_id: auth.userId, instance_id: instance.id, direction: 'outbound', type: 'text', content: message, wa_message_id: result?.messageId, status: 'sent' })
      return res.status(200).json({ success: true, message_id: result?.messageId })
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { data?: unknown } }
      console.error('[v1/send] error:', e?.message, e?.response?.data)
      return res.status(500).json({ 
        error: 'Failed to send message',
        detail: e?.message || 'Unknown error',
        meta: e?.response?.data || null
      })
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
    if (error) return res.status(500).json({ error: error.message })
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
    const { verifyOTP } = await import('@/lib/otp')
    const result = await verifyOTP({ otpId: otp_id, otp })
    return res.status(200).json(result)
  }

  // POST /api/v1/whmcs-webhook - WHMCS webhook receiver
  if (req.method === 'POST' && action === 'whmcs-webhook') {
    const { processWHMCSWebhook } = await import('@/lib/whmcs')
    await processWHMCSWebhook(auth.userId, req.body)
    return res.status(200).json({ success: true })
  }

  return res.status(404).json({ error: 'Unknown action' })
}
