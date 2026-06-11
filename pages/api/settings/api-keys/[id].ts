import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  // Verify ownership
  const { data: key } = await db.from('api_keys').select('id').eq('id', id as string).eq('user_id', user.userId).single()
  if (!key) return res.status(404).json({ error: 'Key not found' })

  if (req.method === 'DELETE') {
    await db.from('api_keys').update({ is_active: false }).eq('id', id as string)
    return res.status(200).json({ success: true })
  }

  if (req.method === 'PUT') {
    const { name } = req.body
    const { data } = await db.from('api_keys').update({ name }).eq('id', id as string).select().single()
    return res.status(200).json({ key: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
