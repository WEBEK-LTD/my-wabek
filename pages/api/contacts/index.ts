import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireMemberAccess } from '@/lib/auth'
import { checkPlanLimit, contactLimitError } from '@/lib/middleware'
import { emitWebhookEvent } from '@/lib/outgoing-webhooks'
import { v4 as uuidv4 } from 'uuid'
import { escapeFilterValue } from '@/lib/security'
import Papa from 'papaparse'

const createSchema = z.object({
  phone: z.string().min(5).max(64),
  name: z.string().max(200).optional(),
  email: z.string().email().max(254).optional(),
  tags: z.array(z.string().max(100)).max(50).default([]),
  variables: z.record(z.string().max(1000)).default({}),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'contacts')
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { tags } = req.query
    const search = typeof req.query.search === 'string' ? escapeFilterValue(req.query.search) : ''
    const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
    const limitNum = Math.min(Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50), 200)
    const offset = (pageNum - 1) * limitNum

    let query = db.from('contacts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)

    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
    if (tags && typeof tags === 'string') {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 50)
      query = query.overlaps('tags', tagArray)
    }

    const { data, error, count } = await query
    if (error) {
      console.error('[contacts] list error:', error.message)
      return res.status(500).json({ error: 'Failed to load contacts' })
    }
    return res.status(200).json({ contacts: data, total: count, page: pageNum })
  }

  if (req.method === 'POST') {
    try {
      const body = createSchema.parse(req.body)

      // Check duplicate
      const { data: existing } = await db.from('contacts').select('id').eq('user_id', user.userId).eq('phone', body.phone).maybeSingle()
      if (existing) return res.status(409).json({ error: 'Contact with this phone already exists' })

      // Plan: max_contacts
      const lim = await checkPlanLimit(user.userId, 'contacts')
      if (!lim.allowed) return res.status(403).json(contactLimitError(lim.limit))

      const { data, error } = await db.from('contacts').insert({
        id: uuidv4(),
        user_id: user.userId,
        ...body,
      }).select().single()

      if (error) {
        console.error('[contacts] create error:', error.message)
        return res.status(500).json({ error: 'Failed to create contact' })
      }
      await emitWebhookEvent(user.userId, 'contact_created', {
        contact_id: data.id, phone: data.phone, name: data.name || null, email: data.email || null,
        tags: data.tags || [], source: 'dashboard',
      })
      return res.status(201).json({ contact: data })
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
      return res.status(500).json({ error: 'Failed to create contact' })
    }
  }

  // Bulk import via CSV
  if (req.method === 'PUT') {
    const { csv_data } = req.body || {}
    if (!csv_data || typeof csv_data !== 'string') return res.status(400).json({ error: 'csv_data required' })
    if (csv_data.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'CSV too large' })

    const parsed = Papa.parse(csv_data, { header: true, skipEmptyLines: true })
    const contacts = (parsed.data as Array<Record<string, string>>)
      .filter(row => row.phone)
      .slice(0, 20000)
      .map(row => ({
        id: uuidv4(),
        user_id: user.userId,
        phone: row.phone?.replace(/\D/g, ''),
        name: row.name ? String(row.name).slice(0, 200) : null,
        email: row.email ? String(row.email).slice(0, 254) : null,
        tags: row.tags ? row.tags.split(';').map((t: string) => t.trim()).filter(Boolean).slice(0, 50) : [],
        custom_fields: {},
      }))

    // Plan: max_contacts — only rows that would be NEW count against it
    const lim = await checkPlanLimit(user.userId, 'contacts')
    if (lim.limit > 0 || !lim.allowed) {
      const phones = Array.from(new Set(contacts.map(c => c.phone).filter(Boolean)))
      let existingCount = 0
      for (let i = 0; i < phones.length; i += 500) {
        const { count } = await db.from('contacts').select('id', { count: 'exact', head: true })
          .eq('user_id', user.userId).in('phone', phones.slice(i, i + 500))
        existingCount += count || 0
      }
      const newCount = phones.length - existingCount
      if (newCount > 0 && (!lim.allowed || lim.current + newCount > lim.limit)) {
        return res.status(403).json({
          ...contactLimitError(lim.limit),
          detail: `This import would add ${newCount} new contact(s); your plan allows ${lim.limit} and you have ${lim.current}.`,
        })
      }
    }

    // Upsert all
    const { data, error } = await db.from('contacts')
      .upsert(contacts, { onConflict: 'user_id,phone', ignoreDuplicates: false })
      .select()

    if (error) {
      console.error('[contacts] import error:', error.message)
      return res.status(500).json({ error: 'Import failed' })
    }
    return res.status(200).json({ imported: data?.length, total: contacts.length })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
