import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { checkPlanLimit } from '@/lib/middleware'
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
  const user = await requireAuth(req, res)
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
    // Plan limit check removed — handled at plan level

    try {
      const body = createSchema.parse(req.body)

      // Check duplicate
      const { data: existing } = await db.from('contacts').select('id').eq('user_id', user.userId).eq('phone', body.phone).maybeSingle()
      if (existing) return res.status(409).json({ error: 'Contact with this phone already exists' })

      const { data, error } = await db.from('contacts').insert({
        id: uuidv4(),
        user_id: user.userId,
        ...body,
      }).select().single()

      if (error) {
        console.error('[contacts] create error:', error.message)
        return res.status(500).json({ error: 'Failed to create contact' })
      }
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
