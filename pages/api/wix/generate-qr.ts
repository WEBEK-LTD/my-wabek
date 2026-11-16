import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requestQRCode } from '@/lib/wa-web'
import { checkInstanceCreateAllowed } from '@/lib/wa-smart-send'
import { resolveWixCaller } from '@/lib/wix-auth'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const caller = await resolveWixCaller(req, res)
  if (!caller) return
  const userId = caller.userId

  const { reuse_instance_id } = req.body || {}
  const db = supabaseAdmin()

  let instanceId = ''

  // A reused instance must be the caller's own WA Web instance
  if (reuse_instance_id) {
    const { data: own } = await db.from('whatsapp_instances').select('id')
      .eq('id', reuse_instance_id).eq('user_id', userId).maybeSingle()
    if (!own) return res.status(404).json({ error: 'Instance not found' })
    instanceId = own.id
  }

  // Try to find existing wa_web instance — ALWAYS reuse to avoid spam detection
  if (!instanceId) {
    const { data: existing } = await db
      .from('whatsapp_instances')
      .select('id, status')
      .eq('user_id', userId)
      .in('instance_type', ['wa_web'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    instanceId = existing?.id || ''
  }

  // Only create new instance if none exists at all
  if (!instanceId) {
    const limit = await checkInstanceCreateAllowed(userId)
    if (!limit.allowed) return res.status(403).json({ qr: null, error: limit.error, code: 'PLAN_LIMIT' })

    instanceId = uuidv4()
    await db.from('whatsapp_instances').insert({
      id:            instanceId,
      user_id:       userId,
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
    const result = await requestQRCode(instanceId, userId)

    if (result.qrCode) {
      return res.status(200).json({ qr: result.qrCode, instance_id: instanceId })
    }

    return res.status(200).json({
      qr:          null,
      instance_id: instanceId,
      message:     result.message,
    })
  } catch (err: unknown) {
    console.error('[wix generate-qr] error:', (err as Error)?.message)
    return res.status(502).json({
      qr:          null,
      instance_id: instanceId,
      error:       'Could not get a QR code from the WhatsApp Web server. Please try again.',
    })
  }
}
