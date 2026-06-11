import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { getPhoneNumberInfo } from '@/lib/whatsapp'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, access_token, phone_number_id, phone_number, waba_id } = req.body
  if (!user_id || !access_token || !phone_number_id || !phone_number) {
    return res.status(400).json({ error: 'access_token, phone_number_id, and phone_number are required' })
  }

  // Verify credentials with Meta API (same as main system)
  let displayName = phone_number
  try {
    const info = await getPhoneNumberInfo(phone_number_id, access_token)
    displayName = (info.verified_name as string) || phone_number
  } catch {
    return res.status(400).json({ error: 'Invalid WhatsApp credentials. Please check your Phone Number ID and Access Token.' })
  }

  const db = supabaseAdmin()

  // Deactivate old default instance
  await db.from('whatsapp_instances')
    .update({ is_default: false })
    .eq('user_id', user_id)

  const { data, error } = await db.from('whatsapp_instances').insert({
    id:              uuidv4(),
    user_id,
    phone_number,
    display_name:    displayName,
    phone_number_id,
    waba_id:         waba_id || null,
    access_token,
    instance_type:   'cloud_api',
    type:            'cloud_api',
    status:          'connected',
    is_default:      true,
    webhook_url:     `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook`,
    created_at:      new Date().toISOString(),
    updated_at:      new Date().toISOString(),
  }).select().single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true, instance: data })
}
