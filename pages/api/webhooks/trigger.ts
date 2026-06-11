import { sendTextMessage } from '@/lib/whatsapp'
import { sendWAWebMessage } from '@/lib/wa-web'
import { smartSend, smartSendWAWeb } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = req.headers['x-api-key'] as string
  if (!apiKey) return res.status(401).json({ error: 'API key required' })

  const db = supabaseAdmin()
  const { data: keyRecord } = await db.from('api_keys').select('user_id, is_active').eq('key', apiKey).single()
  if (!keyRecord?.is_active) return res.status(401).json({ error: 'Invalid API key' })

  const { to, message, instance_id } = req.body
  if (!to || !message) return res.status(400).json({ error: 'to and message required' })

  const { data: instance } = await db.from('whatsapp_instances')
    .select('id, type, phone_number_id, access_token, status')
    .eq('user_id', keyRecord.user_id)
    .eq('status', 'connected')
    .limit(1)
    .maybeSingle()

  if (!instance) return res.status(404).json({ error: 'No connected WhatsApp instance' })

  try {
    if (instance.type === 'cloud_api' && instance.phone_number_id && instance.access_token) {
      const { sendTextMessage } = await import('@/lib/whatsapp')
      await smartSend({ userId: (instance as any).user_id || (instance as any).userId || '', instanceId: instance.id, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to, text: message, source: 'automation' })
    } else {
      const { sendWAWebMessage } = await import('@/lib/wa-web')
      await smartSendWAWeb({ userId: (instance as any).user_id || (instance as any).userId || '', instanceId: instance.id, to, text: message })
    }

    // Fire zapier hooks for 'message_sent' event
    const { data: hooks } = await db.from('zapier_hooks').select('target_url').eq('user_id', keyRecord.user_id).eq('event', 'message_sent').eq('is_active', true)
    for (const hook of hooks || []) {
      fetch(hook.target_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, message, timestamp: new Date().toISOString() }) }).catch(() => {})
    }

    return res.status(200).json({ success: true })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Send failed' })
  }
}
