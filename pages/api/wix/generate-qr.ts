import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requestQRCode } from '@/lib/wa-web'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id, reuse_instance_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  const db = supabaseAdmin()

  let instanceId = reuse_instance_id || ''

  // Try to find existing wa_web instance — ALWAYS reuse to avoid spam detection
  if (!instanceId) {
    const { data: existing } = await db
      .from('whatsapp_instances')
      .select('id, status')
      .eq('user_id', user_id)
      .in('instance_type', ['wa_web'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    instanceId = existing?.id || ''
  }

  // Only create new instance if none exists at all
  if (!instanceId) {
    instanceId = uuidv4()
    await db.from('whatsapp_instances').insert({
      id:            instanceId,
      user_id,
      name:          'WhatsApp',
      instance_type: 'wa_web',
      type:          'wa_web',
      status:        'initializing',
      is_default:    true,
      created_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    })
  }

  // Request QR — reuses existing Baileys session if available
  try {
    const result = await requestQRCode(instanceId, user_id)

    if (result.qrCode) {
      return res.status(200).json({ qr: result.qrCode, instance_id: instanceId })
    }

    return res.status(200).json({
      qr:          null,
      instance_id: instanceId,
      message:     result.message,
    })
  } catch (err: unknown) {
    const msg = (err as Error)?.message || 'Unknown error'
    console.error('[wix generate-qr] error:', msg)
    return res.status(500).json({
      qr:          null,
      instance_id: instanceId,
      error:       msg,
    })
  }
}
