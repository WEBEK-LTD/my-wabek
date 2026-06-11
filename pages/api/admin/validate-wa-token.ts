import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import axios from 'axios'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const { instance_id } = req.query
  const db = supabaseAdmin()

  const { data: inst } = await db
    .from('whatsapp_instances')
    .select('id,phone_number_id,access_token,instance_type,type,status')
    .eq('id', instance_id as string)
    .eq('user_id', admin.userId)
    .maybeSingle()

  if (!inst) return res.status(404).json({ error: 'Instance not found' })

  const token = inst.access_token
  const phoneNumberId = inst.phone_number_id

  // Step 1: validate token via GET /me
  let meResult: any = null
  let meError: any = null
  try {
    const r = await axios.get(`https://graph.facebook.com/v20.0/me`, {
      params: { access_token: token, fields: 'id,name' }
    })
    meResult = r.data
  } catch (e: any) {
    meError = e?.response?.data || e?.message
  }

  // Step 2: validate phone number ID access
  let phoneResult: any = null
  let phoneError: any = null
  try {
    const r = await axios.get(`https://graph.facebook.com/v20.0/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { fields: 'display_phone_number,verified_name,status' }
    })
    phoneResult = r.data
  } catch (e: any) {
    phoneError = e?.response?.data || e?.message
  }

  return res.status(200).json({
    instance: {
      id: inst.id,
      phone_number_id: phoneNumberId,
      instance_type: inst.instance_type,
      type: inst.type,
      status: inst.status,
      token_prefix: token?.slice(0, 15) + '...',
      token_length: token?.length,
    },
    token_validation: {
      me: meResult,
      me_error: meError,
    },
    phone_validation: {
      result: phoneResult,
      error: phoneError,
    },
    diagnosis: meError
      ? `❌ Token invalid: ${meError?.error?.message || meError}`
      : phoneError
      ? `⚠️ Token OK but phone_number_id issue: ${phoneError?.error?.message || phoneError}`
      : `✅ Token valid. Phone: ${phoneResult?.display_phone_number}`,
  })
}
