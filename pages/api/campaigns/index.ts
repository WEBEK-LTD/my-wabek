import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { checkPlanLimit } from '@/lib/middleware'
import { sendTextMessage } from '@/lib/whatsapp'
import { v4 as uuidv4 } from 'uuid'

const createSchema = z.object({
  name: z.string().min(1).max(200),
  instance_id: z.string().uuid(),
  message: z.string().min(1),
  media_url: z.string().url().optional(),
  contact_filter: z.object({ tags: z.array(z.string()).optional(), all: z.boolean().optional() }).default({ all: true }),
  scheduled_at: z.string().datetime().optional(),
  delay_seconds: z.number().min(1).max(60).default(3),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db.from('campaigns').select('*').eq('user_id', user.userId).order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ campaigns: data })
  }

  if (req.method === 'POST') {
    // Plan limit check removed

    try {
      const body = createSchema.parse(req.body)

      // Count targeted contacts
      let contactQuery = db.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.userId).eq('is_blocked', false).eq('opted_out', false)
      if (body.contact_filter.tags?.length) contactQuery = contactQuery.overlaps('tags', body.contact_filter.tags)
      const { count } = await contactQuery

      const { data, error } = await db.from('campaigns').insert({
        id: uuidv4(),
        user_id: user.userId,
        ...body,
        status: body.scheduled_at ? 'scheduled' : 'draft',
        total_contacts: count || 0,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
      }).select().single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json({ campaign: data })
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
      return res.status(500).json({ error: 'Failed to create campaign' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
