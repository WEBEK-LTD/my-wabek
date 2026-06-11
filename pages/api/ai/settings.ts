import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    // Try to get settings - if table missing, return empty
    try {
      const { data } = await db
        .from('ai_settings')
        .select('*')
        .eq('user_id', user.userId)
        .order('created_at')
      return res.status(200).json({ settings: data || [] })
    } catch {
      return res.status(200).json({ settings: [], warning: 'ai_settings table not found - run migration 010_with_ai.sql' })
    }
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const {
      instance_id, is_enabled, system_prompt, company_name,
      model, max_tokens, temperature, escalation_keywords,
    } = req.body

    if (!instance_id) return res.status(400).json({ error: 'instance_id required' })

    // Verify instance belongs to user
    const { data: inst } = await db.from('whatsapp_instances')
      .select('id').eq('id', instance_id).eq('user_id', user.userId).single()
    if (!inst) return res.status(404).json({ error: 'Instance not found' })

    const { data, error } = await db.from('ai_settings').upsert({
      id: uuidv4(),
      user_id: user.userId,
      instance_id,
      is_enabled: is_enabled ?? false,
      system_prompt: system_prompt || null,
      company_name: company_name || null,
      model: 'deepseek-v4-flash',
      max_tokens: max_tokens || 300,
      temperature: temperature ?? 0.7,
      escalation_keywords: escalation_keywords || 'agent,human,انسان,موظف,بشري',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,instance_id' }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ settings: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
