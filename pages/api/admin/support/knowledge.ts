import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('system_settings').select('value').eq('key', 'support_ai_knowledge').maybeSingle()
    return res.status(200).json({ knowledge: data?.value || '' })
  }

  if (req.method === 'POST') {
    const { knowledge } = req.body
    await db.from('system_settings').upsert(
      { key: 'support_ai_knowledge', value: knowledge || '' },
      { onConflict: 'key' }
    )
    return res.status(200).json({ success: true })
  }

  return res.status(405).end()
}
