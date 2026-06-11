import { smartSend, smartSendWAWeb, resolveProvider } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { handleCors } from '@/lib/middleware'
import { sendTextMessage } from '@/lib/whatsapp'
import { sendWAWebMessage } from '@/lib/wa-web'
import crypto from 'crypto'

// Compatible with Digits WordPress Plugin Custom Gateway
// Configure in Digits:
//   URL: https://waabek.com/api/gateway/whatsapp
//   Method: POST or GET
//   Headers: X-API-Key:YOUR_KEY
//   Params: to:{to}, message:{message}

async function authenticate(req: NextApiRequest): Promise<string | null> {
  const apiKey = req.headers['x-api-key'] as string
    || req.query.api_key as string
    || req.body?.api_key
    || req.query.key as string

  if (!apiKey) return null

  const db = supabaseAdmin()
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

  const { data: keyRecord } = await db.from('api_keys').select('user_id').eq('key_hash', keyHash).eq('is_active', true).single()
  if (keyRecord) return keyRecord.user_id

  const { data: user } = await db.from('users').select('id').eq('api_key', apiKey).eq('is_active', true).single()
  if (user) return user.id

  return null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (handleCors(req, res)) return

  const userId = await authenticate(req)
  if (!userId) return res.status(401).json({ error: 'Invalid API key', code: 'UNAUTHORIZED' })

  // Support both GET and POST (Digits uses both)
  const params = req.method === 'GET' ? req.query : { ...req.query, ...req.body }

  const to = params.to as string || params.phone as string || params.mobile as string
  const message = params.message as string || params.text as string || params.msg as string
  const instanceId = params.instance_id as string || params.sender_id as string || params.sender as string

  if (!to) return res.status(400).json({ error: 'Phone number required (to)', code: 'MISSING_TO' })
  if (!message) return res.status(400).json({ error: 'Message required (message)', code: 'MISSING_MESSAGE' })

  const db = supabaseAdmin()

  // Get instance
  let instanceQuery = db.from('whatsapp_instances').select('*').eq('user_id', userId).eq('status', 'connected')
  if (instanceId) instanceQuery = instanceQuery.eq('id', instanceId)
  const { data: instances } = await instanceQuery.limit(1)
  const instance = instances?.[0]

  if (!instance) {
    return res.status(404).json({ error: 'No connected WhatsApp instance found', code: 'NO_INSTANCE' })
  }

  // Clean phone number
  const cleanPhone = to.replace(/[^0-9]/g, '')

  try {
    let messageId = ''

    if (instance.instance_type === 'wa_web') {
      const result = await smartSendWAWeb({ userId: (instance as any).user_id || (instance as any).userId || '', instanceId: instance.id, to: cleanPhone, text: message })
      messageId = result.messageId || ''
    } else {
      const result = await smartSend({ userId: (instance as any)?.user_id || (instance as any)?.userId || '', instanceId: (instance as any)?.id || '', phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: cleanPhone, text: message, source: 'api' as any })
      messageId = result?.messageId || ''
    }

    // Digits expects specific response format
    return res.status(200).json({
      success: true,
      status: 'sent',
      message_id: messageId,
      to: cleanPhone,
      // Digits compatibility
      data: { message_id: messageId },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Send failed'
    return res.status(500).json({ error: msg, code: 'SEND_FAILED' })
  }
}
