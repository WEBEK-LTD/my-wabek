import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveWixCaller } from '@/lib/wix-auth'

const MAX_TEMPLATE_LENGTH = 2000
const KEY_RE = /^[a-z_]{1,40}$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const caller = await resolveWixCaller(req, res)
  if (!caller) return
  const db = supabaseAdmin()

  // Which Wix store: the verified instance, or (dashboard users) a store linked to them
  let instanceId = caller.wixInstanceId || ''
  if (!instanceId) {
    const requested = (req.query.instance_id || req.body?.instance_id) as string
    if (!requested) return res.status(400).json({ error: 'instance_id required' })
    const { data: link } = await db.from('wix_user_links').select('wix_instance_id')
      .eq('user_id', caller.userId).eq('wix_instance_id', requested).maybeSingle()
    if (!link) return res.status(404).json({ error: 'Wix store not linked to your account' })
    instanceId = requested
  }

  const key = `wix_templates_${instanceId}`

  if (req.method === 'GET') {
    const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle()
    return res.status(200).json({ templates: data?.value || {} })
  }

  // POST: only a flat { event_key: "message text" } map is stored
  const input = req.body?.templates
  if (!input || typeof input !== 'object' || Array.isArray(input)) return res.status(400).json({ error: 'templates must be an object' })
  const templates: Record<string, string> = {}
  for (const [k, v] of Object.entries(input).slice(0, 30)) {
    if (KEY_RE.test(k) && typeof v === 'string') templates[k] = v.slice(0, MAX_TEMPLATE_LENGTH)
  }
  await db.from('system_settings').upsert({ key, value: templates, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  return res.status(200).json({ success: true })
}
