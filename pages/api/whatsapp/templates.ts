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
    const templates = (result.data || []).map((t: any) => {
      const bodyText: string = (t.components || []).find((c: any) => c.type === 'BODY')?.text || ''
      const positional = bodyText.match(/\{\{\s*\d+\s*\}\}/g) || []
      const named = Array.from(new Set((bodyText.match(/\{\{\s*([a-z0-9_]+)\s*\}\}/g) || [])
        .map(m => m.replace(/[{}\s]/g, ''))
        .filter(n => !/^\d+$/.test(n))))
      const isNamed = t.parameter_format === 'NAMED' || (named.length > 0 && positional.length === 0)
      return {
        name: t.name,
        status: t.status, // APPROVED, PENDING, REJECTED, ...
        category: t.category,
        // The approved language code ("ar", "en_US" …) — must be sent back
        // exactly when using this template.
        language: t.language,
        // Extract a human-readable preview of the body text + variables
        body: bodyText,
        parameterFormat: isNamed ? 'NAMED' : 'POSITIONAL',
        // Named templates: the parameter names in body order ({{customer_name}} …)
        paramNames: isNamed ? named : [],
        variableCount: isNamed ? named.length : positional.reduce((max, p) => Math.max(max, parseInt(p.replace(/[{}\s]/g, ''), 10) || 0), 0),
        hasButtons: (t.components || []).some((c: any) => c.type === 'BUTTONS'),
      }
    })

    return res.status(200).json({ templates })
  } catch (err: any) {
    const errMsg = err?.response?.data?.error?.message || 'request failed'
    console.error('[templates] Meta error:', err?.response?.data || err?.message)
    return res.status(502).json({ error: `Failed to fetch templates from Meta: ${errMsg}`, templates: [] })
  }
}
