import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { logAction, getClientIp } from '@/lib/middleware'
import { toPublicInstance } from '@/lib/whatsapp'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const id = typeof req.query.id === 'string' ? req.query.id : ''

  const { data: instance } = await db
    .from('whatsapp_instances')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.userId)
    .maybeSingle()

  if (!instance) return res.status(404).json({ error: 'Instance not found' })

  if (req.method === 'GET') {
    return res.status(200).json({ instance: toPublicInstance(instance) })
  }

  if (req.method === 'PUT') {
    // Whitelist: clients may rename an instance. Status is owned by the
    // server (Meta webhooks / Baileys events), never set by the client.
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof req.body?.display_name === 'string') update.display_name = req.body.display_name.trim().slice(0, 100) || null
    const { data, error } = await db
      .from('whatsapp_instances')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.userId)
      .select('*')
      .single()
    if (error) return res.status(500).json({ error: 'Failed to update instance' })
    return res.status(200).json({ instance: toPublicInstance(data) })
  }

  if (req.method === 'DELETE') {
    await db.from('whatsapp_instances').delete().eq('id', id).eq('user_id', user.userId)
    await logAction({ userId: user.userId, action: 'delete_instance', resource: 'whatsapp_instance', resourceId: id, ipAddress: getClientIp(req) })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
