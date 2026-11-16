import { smartSend, smartSendWAWeb, resolveProvider } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { lookupApiKey, apiKeyHasPermission, permissionDeniedError } from '@/lib/api-key-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = req.headers['x-api-key']
  if (!apiKey || typeof apiKey !== 'string') return res.status(401).json({ error: 'API key required' })

  // Keys are stored hashed (sha256) like everywhere else
  const auth = await lookupApiKey(apiKey.trim())
  if (!auth) return res.status(401).json({ error: 'Invalid API key' })
  if (!apiKeyHasPermission(auth, 'send')) {
    return res.status(403).json(permissionDeniedError('send'))
  }
  const userId = auth.userId

  const { to, message, instance_id } = req.body || {}
  if (!to || !message || typeof to !== 'string' || typeof message !== 'string') return res.status(400).json({ error: 'to and message required' })

  const db = supabaseAdmin()
  let q = db.from('whatsapp_instances')
    .select('id, user_id, type, instance_type, phone_number_id, access_token, status')
    .eq('user_id', userId)
    .eq('status', 'connected')
  if (instance_id) q = q.eq('id', instance_id)
  const { data: rows } = await q.limit(1)
  const instance = rows?.[0]

  if (!instance) return res.status(404).json({ error: 'No connected WhatsApp instance' })

  // smartSend / smartSendWAWeb apply the plan/opt-out guard and insert the message row
  const r = resolveProvider(instance) === 'wa_web'
    ? await smartSendWAWeb({ userId, instanceId: instance.id, to, text: message, source: 'automation' })
    : await smartSend({ userId, instanceId: instance.id, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to, text: message, source: 'automation' })
  if (r.error === 'outside_window') {
    return res.status(422).json({
      error: 'Recipient is outside the 24-hour messaging window; plain text cannot be delivered. Send an approved template via POST /api/v1/send (template + template_params).',
      code: 'outside_window',
    })
  }
  if (r.error) return res.status(r.blocked ? 403 : 502).json({ error: r.error, ...(r.blocked ? { code: r.blocked } : {}) })

  // The `message_sent` outgoing webhook is fired by smartSend itself.
  return res.status(200).json({ success: true, message_id: r.messageId })
}
