import { smartSend, smartSendWAWeb } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, message, wa_instance_id } = req.body
  if (!user_id || !message) return res.status(400).json({ error: 'Missing params' })

  const db = supabaseAdmin()

  // Get WhatsApp instance
  const { data: inst } = await db.from('whatsapp_instances')
    .select('*').eq('id', wa_instance_id).eq('user_id', user_id).maybeSingle()
  if (!inst || inst.status !== 'connected') return res.status(400).json({ error: 'WhatsApp not connected' })

  // Get all contacts
  const { data: contacts } = await db.from('contacts')
    .select('phone, first_name, last_name')
    .eq('user_id', user_id)
    .eq('is_blocked', false)
    .eq('opted_out', false)
    .limit(1000)

  if (!contacts?.length) return res.status(200).json({ success: true, sent: 0, msg: 'No contacts found' })

  const isWAWeb = (inst.instance_type || inst.type) === 'wa_web'
  let sent = 0, failed = 0

  for (const contact of contacts) {
    const phone = contact.phone?.replace(/[^\d]/g, '').replace(/^0+/, '')
    if (!phone) { failed++; continue }

    const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Customer'
    const msg  = message
      .replace(/\{\{customer_name\}\}/g, name)
      .replace(/\{\{shop_name\}\}/g, 'Our Store')

    try {
      if (isWAWeb) {
        await smartSendWAWeb({ userId: user_id, instanceId: inst.id, to: phone, text: msg })
      } else {
        await smartSend({ userId: user_id, instanceId: inst?.id || '', phoneNumberId: inst.phone_number_id, accessToken: inst.access_token, to: phone, text: msg, forceTemplate: false })
      }
      sent++
      // Delay to avoid spam
      await new Promise(r => setTimeout(r, 500))
    } catch { failed++ }
  }

  return res.status(200).json({ success: true, sent, failed })
}
