import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// One-time endpoint to create AI settings for an instance
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  if (req.method !== 'POST') return res.status(405).end()

  const { instance_id, system_prompt, company_name, enabled } = req.body
  if (!instance_id) return res.status(400).json({ error: 'instance_id required' })

  const db = supabaseAdmin()

  // Verify instance exists
  const { data: inst } = await db.from('whatsapp_instances').select('id').eq('id', instance_id).maybeSingle()
  if (!inst) return res.status(404).json({ error: 'Instance not found' })

  const { data, error } = await db.from('ai_settings').upsert({
    user_id: admin.userId,
    instance_id,
    is_enabled: enabled ?? true,
    system_prompt: system_prompt || null,
    company_name: company_name || 'WABEK',
    model: 'deepseek-v4-flash',
    max_tokens: 300,
    temperature: 0.7,
    escalation_keywords: 'agent,human,انسان,موظف,بشري,وكيل',
    replies_this_month: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,instance_id' }).select().single()

  if (error) return res.status(500).json({ error: error.message, hint: 'Run migration 010_ai_settings.sql first' })
  return res.status(200).json({ success: true, settings: data })
}
