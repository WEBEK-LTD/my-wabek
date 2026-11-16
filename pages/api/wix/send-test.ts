import { smartSend, smartSendWAWeb, resolveProvider } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveWixCaller } from '@/lib/wix-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const caller = await resolveWixCaller(req, res)
  if (!caller) return
  const userId = caller.userId

  const { to, message, wa_instance_id } = req.body || {}
  if (!to || !message || typeof to !== 'string' || typeof message !== 'string') return res.status(400).json({ error: 'Missing params' })

  const db = supabaseAdmin()

  // Get instance (must be the caller's)
  const { data: inst } = await db.from('whatsapp_instances')
    .select('id, user_id, status, instance_type, type, phone_number_id, access_token')
    .eq('id', wa_instance_id).eq('user_id', userId).maybeSingle()

  if (!inst) return res.status(404).json({ error: 'WhatsApp instance not found' })
  if (inst.status !== 'connected') return res.status(400).json({ error: 'WhatsApp not connected' })

  // Clean phone
  const phone = to.replace(/[^\d]/g, '').replace(/^0+/, '')

  // smartSend / smartSendWAWeb already insert the outbound message row
  const r = resolveProvider(inst) === 'wa_web'
    ? await smartSendWAWeb({ userId, instanceId: inst.id, to: phone, text: message })
    : await smartSend({ userId, instanceId: inst.id, phoneNumberId: inst.phone_number_id, accessToken: inst.access_token, to: phone, text: message, forceTemplate: false })

  if (r.error) return res.status(r.blocked ? 403 : 502).json({ error: r.error })
  return res.status(200).json({ success: true })
}
