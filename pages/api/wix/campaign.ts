import { cleanTemplateParam } from '@/lib/campaign-templates'
import { smartSend, smartSendWAWeb, resolveProvider } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveWixCaller } from '@/lib/wix-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // The account comes from a verified Wix instance or the WABEK session — never the body
  const caller = await resolveWixCaller(req, res)
  if (!caller) return
  const userId = caller.userId

  const { message, wa_instance_id } = req.body || {}
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Missing params' })

  const db = supabaseAdmin()

  // Get WhatsApp instance (must be the caller's)
  const { data: inst } = await db.from('whatsapp_instances')
    .select('id, user_id, status, instance_type, type, phone_number_id, access_token')
    .eq('id', wa_instance_id).eq('user_id', userId).maybeSingle()
  if (!inst || inst.status !== 'connected') return res.status(400).json({ error: 'WhatsApp not connected' })

  // Get all contacts (opted-out/blocked are also re-checked by the send guard)
  const { data: contacts } = await db.from('contacts')
    .select('id, phone, first_name, last_name')
    .eq('user_id', userId)
    .eq('is_blocked', false)
    .eq('opted_out', false)
    .limit(1000)

  if (!contacts?.length) return res.status(200).json({ success: true, sent: 0, msg: 'No contacts found' })

  const isWAWeb = resolveProvider(inst) === 'wa_web'
  let sent = 0, failed = 0

  for (const contact of contacts) {
    const phone = contact.phone?.replace(/[^\d]/g, '').replace(/^0+/, '')
    if (!phone) { failed++; continue }

    const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Customer'
    const msg  = message
      .replace(/\{\{customer_name\}\}/g, name)
      .replace(/\{\{shop_name\}\}/g, 'Our Store')

    // smartSend / smartSendWAWeb insert the message row themselves
    const r = isWAWeb
      ? await smartSendWAWeb({ userId, instanceId: inst.id, to: phone, text: msg, contactId: contact.id, source: 'campaign' })
      : await smartSend({ userId, instanceId: inst.id, phoneNumberId: inst.phone_number_id, accessToken: inst.access_token, to: phone, text: msg, contactId: contact.id, forceTemplate: false, source: 'campaign',
          // Outside the 24h window: the marketing template carries this text
          templateKey: 'MARKETING', templateComponents: [{ type: 'body', parameters: [{ type: 'text', parameter_name: 'customer_name', text: cleanTemplateParam(name) }, { type: 'text', parameter_name: 'offer_details', text: cleanTemplateParam(msg) }] }] })
    if (r.error) {
      failed++
      if (r.blocked === 'plan_limit') break
    } else {
      sent++
    }
    // Delay to avoid spam
    await new Promise(r => setTimeout(r, 500))
  }

  return res.status(200).json({ success: true, sent, failed })
}
