import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { getPhoneNumberInfo, toPublicInstance } from '@/lib/whatsapp'
import { checkInstanceCreateAllowed } from '@/lib/wa-smart-send'
import { resolveWixCaller } from '@/lib/wix-auth'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const caller = await resolveWixCaller(req, res)
  if (!caller) return
  const userId = caller.userId

  const { access_token, phone_number_id, phone_number, waba_id } = req.body || {}
  if (!access_token || !phone_number_id || !phone_number) {
    return res.status(400).json({ error: 'access_token, phone_number_id, and phone_number are required' })
  }
  if (!/^\d{5,30}$/.test(String(phone_number_id)) || (waba_id && !/^\d{5,30}$/.test(String(waba_id)))) {
    return res.status(400).json({ error: 'Invalid Phone Number ID or WABA ID' })
  }

  // Plan limit applies to creating new instances only
  const limit = await checkInstanceCreateAllowed(userId)
  if (!limit.allowed) return res.status(403).json({ error: limit.error, code: 'PLAN_LIMIT' })

  // Verify credentials with Meta API (same as main system)
  let displayName = String(phone_number)
  try {
    const info = await getPhoneNumberInfo(String(phone_number_id), String(access_token))
    displayName = (info.verified_name as string) || displayName
  } catch {
    return res.status(400).json({ error: 'Invalid WhatsApp credentials. Please check your Phone Number ID and Access Token.' })
  }

  const db = supabaseAdmin()

  // Deactivate old default instance
  await db.from('whatsapp_instances')
    .update({ is_default: false })
    .eq('user_id', userId)

  const { data, error } = await db.from('whatsapp_instances').insert({
    id:              uuidv4(),
    user_id:         userId,
    phone_number:    String(phone_number),
    display_name:    displayName,
    phone_number_id: String(phone_number_id),
    waba_id:         waba_id ? String(waba_id) : null,
    access_token:    String(access_token),
    instance_type:   'cloud_api',
    type:            'cloud_api',
    status:          'connected',
    is_default:      true,
    webhook_url:     `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook`,
    created_at:      new Date().toISOString(),
    updated_at:      new Date().toISOString(),
  }).select('*').single()

  if (error) {
    console.error('[wix connect-cloud] insert failed:', error.message)
    return res.status(500).json({ error: 'Failed to save WhatsApp number' })
  }
  return res.status(200).json({ success: true, instance: toPublicInstance(data) })
}
