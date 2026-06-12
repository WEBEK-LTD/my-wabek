import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(['send_message', 'delay', 'condition', 'tag_contact', 'end']),
  data: z.record(z.string()),
  next: z.string().optional(),
  nextFalse: z.string().optional(),
})

const createSchema = z.object({
  name: z.string().min(1).max(200),
  instance_id: z.string().uuid().optional(),
  trigger_type: z.enum(['keyword', 'message_received', 'opt_in', 'scheduled']),
  trigger_value: z.string().optional(),
  nodes: z.array(nodeSchema).default([]),
  is_active: z.boolean().default(false),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db.from('automation_flows').select('*').eq('user_id', user.userId).order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ flows: data })
  }

  if (req.method === 'POST') {
    // Plan limit check removed (was incorrectly checking 'campaigns' limit for this resource)

    try {
      const body = createSchema.parse(req.body)
      const { data, error } = await db.from('automation_flows').insert({ id: uuidv4(), user_id: user.userId, trigger_count: 0, ...body }).select().single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json({ flow: data })
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
      return res.status(500).json({ error: 'Failed to create flow' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
