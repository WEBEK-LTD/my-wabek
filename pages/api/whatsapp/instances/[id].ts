import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireMemberAccess } from '@/lib/auth'
import { memberMayUseInstance } from '@/lib/inbox-access'
import { logAction, getClientIp } from '@/lib/middleware'
import { toPublicInstance } from '@/lib/whatsapp'
import { callWAServer, isValidInstanceId } from '@/lib/wa-web'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'instances')
  if (!user) return
  const db = supabaseAdmin()
  const id = typeof req.query.id === 'string' ? req.query.id : ''

  const { data: instance } = await db
    .from('whatsapp_instances')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.userId)
    .maybeSingle()

  if (!instance || !(await memberMayUseInstance(db, user, instance.id))) return res.status(404).json({ error: 'Instance not found' })

  if (req.method === 'GET') {
    return res.status(200).json({ instance: toPublicInstance(instance) })
  }

  if (req.method === 'PUT') {
    // Whitelist: clients may rename an instance. Status is owned by the
    // server (Meta webhooks / Baileys events), never set by the client.
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof req.body?.display_name === 'string') update.display_name = req.body.display_name.trim().slice(0, 100) || null
    // Make this the account's default sending number (only one default per account).
    if (req.body?.is_default === true) {
      const { data: owned } = await db.from('whatsapp_instances').select('id').eq('id', id).eq('user_id', user.userId).maybeSingle()
      if (!owned) return res.status(404).json({ error: 'Instance not found' })
      await db.from('whatsapp_instances').update({ is_default: false }).eq('user_id', user.userId).neq('id', id)
      update.is_default = true
    }
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
    // QR (Baileys) numbers: log the session out and drop its saved creds on
    // the WA server too, or it keeps running (and reconnecting) after the row
    // is gone. A failure there must not block deleting the row.
    if (instance.instance_type === 'wa_web' && isValidInstanceId(instance.id)) {
      try {
        await callWAServer(`/instance/${instance.id}`, undefined, { method: 'DELETE' })
      } catch (err) {
        console.error(`[instances] WA server delete failed for ${instance.id}:`, err instanceof Error ? err.message : err)
      }
    }
    await db.from('whatsapp_instances').delete().eq('id', id).eq('user_id', user.userId)
    await logAction({ userId: user.userId, action: 'delete_instance', resource: 'whatsapp_instance', resourceId: id, ipAddress: getClientIp(req) })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
