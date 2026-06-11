import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('system_settings').select('*').order('key')
    const settings: Record<string, unknown> = {}
    for (const row of data || []) {
      try { settings[row.key] = JSON.parse(row.value) } catch { settings[row.key] = row.value }
    }
    return res.status(200).json({ settings })
  }

  if (req.method === 'PUT') {
    const updates = req.body as Record<string, unknown>
    for (const [key, value] of Object.entries(updates)) {
      await db.from('system_settings').upsert({
        key,
        value: JSON.stringify(value),
        updated_at: new Date().toISOString(),
        updated_by: user.userId,
      })
    }
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
