import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireMemberAccess } from '@/lib/auth'
import { checkPlanLimit } from '@/lib/middleware'
import { applyCampaignFilter } from '@/lib/segments'
import { parseScheduledAt, campaignTemplateFields, resolveContactFilter, userTimeZone, writeCampaignCompat, withTemplateFields } from '@/lib/campaign-templates'
import { v4 as uuidv4 } from 'uuid'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  instance_id: z.string().uuid(),
  message: z.string().min(1),
  media_url: z.string().url().optional(),
  contact_filter: z.object({
    tags: z.array(z.string().max(100)).max(50).optional(),
    tag_operator: z.enum(['any', 'all']).optional(),
    all: z.boolean().optional(),
    segment_id: z.string().uuid().optional(),
  }).default({ all: true }),
  segment_id: z.string().uuid().optional(),
  // ISO with offset (preferred) or a datetime-local value (user's time zone)
  scheduled_at: z.string().max(40).optional(),
  delay_seconds: z.number().min(1).max(60).default(3),
  ...campaignTemplateFields,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'campaigns')
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db.from('campaigns').select('*').eq('user_id', user.userId).order('created_at', { ascending: false })
    if (error) {
      console.error('[campaigns] list error:', error.message)
      return res.status(500).json({ error: 'Failed to load campaigns' })
    }
    return res.status(200).json({ campaigns: (data || []).map(c => withTemplateFields(c)) })
  }

  if (req.method === 'POST') {
    const { allowed, limit } = await checkPlanLimit(user.userId, 'campaigns')
    if (!allowed) {
      return res.status(403).json({
        error: 'Plan limit reached',
        detail: limit === 0
          ? 'Campaigns are not available on your current plan. Please upgrade to create campaigns.'
          : `You've reached your monthly campaign limit (${limit}). Please upgrade your plan to create more.`,
        upgrade_required: true,
      })
    }

    try {
      const body = createSchema.parse(req.body)

      // The instance must belong to this account
      const { data: inst } = await db.from('whatsapp_instances').select('id')
        .eq('id', body.instance_id).eq('user_id', user.userId).maybeSingle()
      if (!inst) return res.status(400).json({ error: 'Instance not found' })

      let scheduledAt: string | undefined
      if (body.scheduled_at) {
        const parsed = parseScheduledAt(body.scheduled_at, await userTimeZone(db, user.userId))
        if (!parsed) return res.status(400).json({ error: 'Invalid scheduled_at (use an ISO date-time)' })
        scheduledAt = parsed
      }

      const resolved = await resolveContactFilter(db, user.userId, body.contact_filter, body.segment_id)
      if ('error' in resolved) return res.status(400).json({ error: resolved.error })
      const contactFilter = resolved.filter

      // Count targeted contacts
      const contactQuery = applyCampaignFilter(
        db.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.userId).eq('is_blocked', false).eq('opted_out', false),
        contactFilter)
      const { count } = await contactQuery

      const { segment_id: _sid, template_param_names, ...fields } = body
      const { data, error } = await writeCampaignCompat({
        id: uuidv4(),
        user_id: user.userId,
        ...fields,
        template_language: body.template_language || null,
        template_variables: body.template_variables ?? null,
        contact_filter: contactFilter,
        scheduled_at: scheduledAt || null,
        status: scheduledAt ? 'scheduled' : 'draft',
        total_contacts: count || 0,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        meta: {
          ...(body.template_language ? { template_language: body.template_language } : {}),
          ...(template_param_names?.length ? { template_param_names } : {}),
          // An explicit (possibly empty) variables list: send exactly these
          ...(body.template_variables ? { template_variables_explicit: true } : {}),
        },
      }, row => db.from('campaigns').insert(row).select().single())

      if (error) {
        console.error('[campaigns] create error:', error.message)
        return res.status(500).json({ error: 'Failed to create campaign' })
      }
      return res.status(201).json({ campaign: withTemplateFields(data) })
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
      return res.status(500).json({ error: 'Failed to create campaign' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
