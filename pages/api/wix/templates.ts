import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = supabaseAdmin()
  const instanceId = (req.query.instance_id || req.body?.instance_id) as string
  if (!instanceId) return res.status(400).json({ error: 'instance_id required' })

  const key = `wix_templates_${instanceId}`

  if (req.method === 'GET') {
    const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle()
    return res.status(200).json({ templates: data?.value || {} })
  }

  if (req.method === 'POST') {
    await db.from('system_settings').upsert({ key, value: req.body.templates, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    return res.status(200).json({ success: true })
  }
}
