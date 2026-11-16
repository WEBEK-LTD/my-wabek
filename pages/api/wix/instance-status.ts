import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveWixCaller } from '@/lib/wix-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Authenticated owners only: the QR code is a login credential for the number
  const caller = await resolveWixCaller(req, res)
  if (!caller) return

  const waInstanceId = req.query.wa_instance_id as string
  if (!waInstanceId) return res.status(400).json({ status: 'unknown' })

  const db = supabaseAdmin()

  const { data: inst } = await db
    .from('whatsapp_instances')
    .select('*')
    .eq('id', waInstanceId)
    .eq('user_id', caller.userId)
    .maybeSingle()

  if (!inst) return res.status(404).json({ status: 'unknown' })

  return res.status(200).json({
    status:        inst.status,
    phone_number:  inst.phone_number || inst.name || null,
    qr:            inst.status !== 'connected' ? (inst.qr_code || null) : null,
    instance_id:   inst.id,
  })
}
