import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { logAction, getClientIp } from '@/lib/middleware'

const planSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price_monthly: z.number().min(0),
  price_yearly: z.number().min(0).optional(),
  // Core limits
  max_messages_month: z.number().min(-1),
  max_contacts: z.number().min(-1),
  max_instances: z.number().min(1),
  max_campaigns: z.number().min(-1),
  max_team_members: z.number().min(1).optional(),
  max_chatbot_flows: z.number().min(-1).optional(),
  max_quick_replies: z.number().min(-1).optional(),
  max_segments: z.number().min(-1).optional(),
  max_links: z.number().min(-1).optional(),
  max_sub_accounts: z.number().min(0).optional(),
  max_ai_replies: z.number().min(-1).optional(),
  // Feature flags
  allow_api_access: z.boolean().optional(),
  allow_chatbot: z.boolean().optional(),
  allow_automation: z.boolean().optional(),
  allow_analytics: z.boolean().optional(),
  allow_white_label: z.boolean().optional(),
  allow_sub_accounts: z.boolean().optional(),
  allow_reseller: z.boolean().optional(),
  allow_gift_invites: z.boolean().optional(),
  allow_ai: z.boolean().optional(),
  invite_credits: z.number().min(0).optional(),
  // Display
  features: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  sort_order: z.number().default(0),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('plans').select('*').eq('is_active', true).order('sort_order')
    return res.status(200).json({ plans: data })
  }

  const admin = await requireAdmin(req, res)
  if (!admin) return

  if (req.method === 'POST') {
    try {
      const body = planSchema.parse(req.body)
      const { data, error } = await db.from('plans').insert({ id: uuidv4(), ...body }).select().single()
      if (error) {
        console.error('[admin plans] create failed:', error.message)
        return res.status(500).json({ error: 'Failed to create plan' })
      }
      await logAction({ userId: admin.userId, action: 'admin_plan_create', resource: 'plan', resourceId: data?.id, details: { name: body.name }, ipAddress: getClientIp(req) })
      return res.status(201).json({ plan: data })
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
      return res.status(500).json({ error: 'Failed to create plan' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
