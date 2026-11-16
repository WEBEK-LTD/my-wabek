import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireMemberAccess } from '@/lib/auth'
import { onSubscriptionChanged } from '@/lib/opt-out'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  email: z.string().email().max(254).nullable().optional().or(z.literal('')),
  tags: z.array(z.string().max(100)).max(50).optional(),
  variables: z.record(z.string().max(1000)).optional(),
  is_blocked: z.boolean().optional(),
  opted_out: z.boolean().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'contacts')
  if (!user) return
  const db = supabaseAdmin()
  const id = typeof req.query.id === 'string' ? req.query.id : ''

  const { data: contact } = await db
    .from('contacts').select('*').eq('id', id).eq('user_id', user.userId).maybeSingle()
  if (!contact) return res.status(404).json({ error: 'Contact not found' })

  if (req.method === 'GET') {
    const { data: messages } = await db.from('messages').select('*').eq('contact_id', id).eq('user_id', user.userId).order('created_at', { ascending: false }).limit(50)
    return res.status(200).json({ contact, messages: messages || [] })
  }

  if (req.method === 'PUT') {
    const parsed = updateSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid data', details: parsed.error.errors })
    const { data, error } = await db.from('contacts').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.userId).select().single()
    if (error) {
      console.error('[contacts] update error:', error.message)
      return res.status(500).json({ error: 'Failed to update contact' })
    }
    // opted_out toggled → opt_out / opt_in webhook (+ opt_in automations)
    if (parsed.data.opted_out !== undefined && (contact.opted_out === true) !== parsed.data.opted_out) {
      await onSubscriptionChanged({ userId: user.userId, phone: contact.phone, contactId: contact.id, optedOut: parsed.data.opted_out, source: 'dashboard' })
    }
    return res.status(200).json({ contact: data })
  }

  if (req.method === 'DELETE') {
    await db.from('contacts').delete().eq('id', id).eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
