import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getMessageTemplates } from '@/lib/whatsapp'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return

  const instanceId = req.query.instance_id as string
  if (!instanceId) return res.status(400).json({ error: 'instance_id required' })

  const db = supabaseAdmin()
  const { data: instance } = await db
    .from('whatsapp_instances')
    .select('*')
    .eq('id', instanceId)
    .eq('user_id', user.userId)
    .single()

  if (!instance) return res.status(404).json({ error: 'Instance not found' })

  if ((instance.instance_type || instance.type) !== 'cloud_api') {
    return res.status(200).json({ templates: [], note: 'WA Web instances do not use Meta templates.' })
  }

  if (!instance.waba_id) {
    return res.status(200).json({
      templates: [],
      error: 'No WhatsApp Business Account ID (waba_id) configured for this instance. Reconnect the instance via Embedded Signup, or set waba_id manually.',
    })
  }

  try {
    const result = await getMessageTemplates(instance.waba_id, instance.access_token)
    const templates = (result.data || []).map((t: any) => ({
      name: t.name,
      status: t.status, // APPROVED, PENDING, REJECTED, ...
      category: t.category,
      language: t.language,
      // Extract a human-readable preview of the body text + variable count
      body: (t.components || []).find((c: any) => c.type === 'BODY')?.text || '',
      variableCount: (((t.components || []).find((c: any) => c.type === 'BODY')?.text || '').match(/\{\{\d+\}\}/g) || []).length,
      hasButtons: (t.components || []).some((c: any) => c.type === 'BUTTONS'),
    }))

    return res.status(200).json({ templates })
  } catch (err: any) {
    const errMsg = err?.response?.data?.error?.message || 'request failed'
    console.error('[templates] Meta error:', err?.response?.data || err?.message)
    return res.status(502).json({ error: `Failed to fetch templates from Meta: ${errMsg}`, templates: [] })
  }
}
