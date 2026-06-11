import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  // Verify ownership
  const { data: sub } = await db.from('sub_accounts').select('*').eq('id', id as string).eq('owner_id', user.userId).single()
  if (!sub) return res.status(404).json({ error: 'Sub-account not found' })

  if (req.method === 'PUT') {
    const { max_contacts, max_instances, max_messages_month, is_active } = req.body
    const { data, error } = await db.from('sub_accounts').update({ max_contacts, max_instances, max_messages_month, is_active }).eq('id', id as string).select().single()
    if (error) return res.status(500).json({ error: error.message })

    // Also update user is_active
    if (is_active !== undefined) {
      await db.from('users').update({ is_active }).eq('id', sub.user_id)
    }

    return res.status(200).json({ account: data })
  }

  if (req.method === 'DELETE') {
    // Suspend the user account
    await db.from('users').update({ is_active: false }).eq('id', sub.user_id)
    await db.from('sub_accounts').update({ is_active: false }).eq('id', id as string)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
