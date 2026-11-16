import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { checkPlanFeature } from '@/lib/middleware'
import { clampMaxTokens, clampTemperature, AI_DEFAULT_MAX_TOKENS } from '@/lib/ai-engine'

const settingsSchema = z.object({
  instance_id: z.string().uuid(),
  is_enabled: z.boolean().optional(),
  system_prompt: z.string().max(8000).nullable().optional(),
  company_name: z.string().max(200).nullable().optional(),
  model: z.string().optional(), // ignored — model is fixed server-side
  max_tokens: z.coerce.number().optional(),
  temperature: z.coerce.number().optional(),
  escalation_keywords: z.string().max(1000).nullable().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'ai')
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
    const parsed = settingsSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid data', details: parsed.error.errors })
    const {
      instance_id, is_enabled, system_prompt, company_name,
      max_tokens, temperature, escalation_keywords,
    } = parsed.data

    // Premium feature gate (Wix review requirement): AI Agents are a Pro+
    // feature. Free/Starter plans (or no plan assigned) cannot ENABLE the
    // AI assistant. (Disabling, or saving other settings while disabled,
    // is still allowed so users can configure ahead of upgrading.)
    if (is_enabled) {
      const allowed = await checkPlanFeature(user.userId, 'allow_ai')
      if (!allowed) {
        return res.status(403).json({
          error: 'Upgrade required',
          detail: 'AI Agents are available on Pro and Business plans. Please upgrade to enable the AI assistant.',
          upgrade_required: true,
        })
      }
    }

    // Verify instance belongs to user
    const { data: inst } = await db.from('whatsapp_instances')
      .select('id').eq('id', instance_id).eq('user_id', user.userId).maybeSingle()
    if (!inst) return res.status(404).json({ error: 'Instance not found' })

    // No explicit `id`: on conflict the existing row keeps its primary key
    // (the column has a gen_random_uuid() default for inserts).
    const { data, error } = await db.from('ai_settings').upsert({
      user_id: user.userId,
      instance_id,
      is_enabled: is_enabled ?? false,
      system_prompt: system_prompt || null,
      company_name: company_name || null,
      model: 'deepseek-v4-flash',
      max_tokens: clampMaxTokens(max_tokens, AI_DEFAULT_MAX_TOKENS),
      temperature: clampTemperature(temperature),
      escalation_keywords: escalation_keywords || 'agent,human,انسان,موظف,بشري',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,instance_id' }).select().single()

    if (error) {
      console.error('[ai/settings] upsert error:', error.message)
      return res.status(500).json({ error: 'Failed to save AI settings' })
    }
    return res.status(200).json({ settings: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
