import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const waInstanceId  = req.query.wa_instance_id  as string
  const wixInstanceId = req.query.wix_instance_id as string

  if (!waInstanceId) return res.status(400).json({ status: 'unknown' })

  const db = supabaseAdmin()

  // Get WA instance status directly
  const { data: inst } = await db
    .from('whatsapp_instances')
    .select('id, status, qr_code, phone_number, name')
    .eq('id', waInstanceId)
    .maybeSingle()

  if (!inst) return res.status(404).json({ status: 'unknown' })

  return res.status(200).json({
    status:        inst.status,
    phone_number:  inst.phone_number || inst.name || null,
    qr:            inst.status !== 'connected' ? (inst.qr_code || null) : null,
    instance_id:   inst.id,
  })
}
