import { smartSend, smartSendWAWeb, resolveProvider } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { handleCors } from '@/lib/middleware'
import { authenticateApiKey } from '@/lib/api-key-auth'

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

  const auth = await authenticateApiKey(req, { allowBody: true, route: '/api/gateway/whatsapp' })
  if (!auth) return res.status(401).json({ error: 'Invalid API key', code: 'UNAUTHORIZED' })
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

  const result = resolveProvider(instance) === 'wa_web'
    ? await smartSendWAWeb({ userId, instanceId: instance.id, to: cleanPhone, text: message, source: 'api' })
    : await smartSend({ userId, instanceId: instance.id, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: cleanPhone, text: message, source: 'api' })

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
