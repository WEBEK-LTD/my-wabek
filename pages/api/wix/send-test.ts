import { smartSend, smartSendWAWeb } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, to, message, wa_instance_id } = req.body
  if (!user_id || !to || !message) return res.status(400).json({ error: 'Missing params' })

  const db = supabaseAdmin()

  // Get instance
  const { data: inst } = await db.from('whatsapp_instances')
    .select('*').eq('id', wa_instance_id).eq('user_id', user_id).maybeSingle()

  if (!inst) return res.status(404).json({ error: 'WhatsApp instance not found' })
  if (inst.status !== 'connected') return res.status(400).json({ error: 'WhatsApp not connected' })

  // Clean phone
  const phone = to.replace(/[^\d]/g, '').replace(/^0+/, '')

  try {
    const isWAWeb = (inst.instance_type || inst.type) === 'wa_web'
    if (isWAWeb) {
      await smartSendWAWeb({ userId: user_id, instanceId: inst.id, to: phone, text: message })
    } else {
      await smartSend({ userId: user_id, instanceId: inst?.id || '', phoneNumberId: inst.phone_number_id, accessToken: inst.access_token, to: phone, text: message, forceTemplate: false })
    }

    await db.from('messages').insert({
      id: uuidv4(), user_id, instance_id: wa_instance_id,
      direction: 'outbound', type: 'text', content: message, status: 'sent',
    })

    return res.status(200).json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to send' })
  }
}
