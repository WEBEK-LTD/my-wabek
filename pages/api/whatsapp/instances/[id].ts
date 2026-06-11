import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { logAction, getClientIp } from '@/lib/middleware'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  const { data: instance } = await db
    .from('whatsapp_instances')
    .select('*')
    .eq('id', id as string)
    .eq('user_id', user.userId)
    .single()

  if (!instance) return res.status(404).json({ error: 'Instance not found' })

  if (req.method === 'GET') {
    return res.status(200).json({ instance })
  }

  if (req.method === 'PUT') {
    const { display_name, status } = req.body
    const { data, error } = await db
      .from('whatsapp_instances')
      .update({ display_name, status, updated_at: new Date().toISOString() })
      .eq('id', id as string)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ instance: data })
  }

  if (req.method === 'DELETE') {
    await db.from('whatsapp_instances').delete().eq('id', id as string)
    await logAction({ userId: user.userId, action: 'delete_instance', resource: 'whatsapp_instance', resourceId: id as string, ipAddress: getClientIp(req) })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
