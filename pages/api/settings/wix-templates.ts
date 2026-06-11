import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return

  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('system_settings')
      .select('value').eq('key', `wix_templates_${user.userId}`).maybeSingle()
    return res.status(200).json({ templates: data?.value || {} })
  }

  if (req.method === 'POST') {
    const { templates } = req.body
    await db.from('system_settings').upsert({
      key:        `wix_templates_${user.userId}`,
      value:      templates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
