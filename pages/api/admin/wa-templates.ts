import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { TEMPLATES } from '@/lib/wa-smart-send'

const DEFAULT_CONFIG = Object.entries(TEMPLATES).reduce((acc, [key, val]) => {
  acc[key] = val
  return acc
}, {} as Record<string, string>)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('system_settings').select('value').eq('key', 'wa_templates').maybeSingle()
    return res.status(200).json({ templates: data?.value || DEFAULT_CONFIG, defaults: DEFAULT_CONFIG })
  }

  if (req.method === 'POST') {
    const { templates } = req.body
    await db.from('system_settings').upsert({ key: 'wa_templates', value: templates }, { onConflict: 'key' })
    return res.status(200).json({ success: true })
  }

  return res.status(405).end()
}
