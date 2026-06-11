import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { checkPlanLimit } from '@/lib/middleware'
import { v4 as uuidv4 } from 'uuid'
import Papa from 'papaparse'

const createSchema = z.object({
  phone: z.string().min(5),
  name: z.string().optional(),
  email: z.string().email().optional(),
  tags: z.array(z.string()).default([]),
  variables: z.record(z.string()).default({}),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { search, tags, page = '1', limit = '50' } = req.query
    const pageNum = parseInt(page as string)
    const limitNum = Math.min(parseInt(limit as string), 200)
    const offset = (pageNum - 1) * limitNum

    let query = db.from('contacts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)

    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
    if (tags) {
      const tagArray = (tags as string).split(',')
      query = query.overlaps('tags', tagArray)
    }

    const { data, error, count } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ contacts: data, total: count, page: pageNum })
  }

  if (req.method === 'POST') {
    // Plan limit check removed — handled at plan level

    try {
      const body = createSchema.parse(req.body)

      // Check duplicate
      const { data: existing } = await db.from('contacts').select('id').eq('user_id', user.userId).eq('phone', body.phone).single()
      if (existing) return res.status(409).json({ error: 'Contact with this phone already exists' })

      const { data, error } = await db.from('contacts').insert({
        id: uuidv4(),
        user_id: user.userId,
        ...body,
      }).select().single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json({ contact: data })
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
      return res.status(500).json({ error: 'Failed to create contact' })
    }
  }

  // Bulk import via CSV
  if (req.method === 'PUT') {
    const { csv_data } = req.body
    if (!csv_data) return res.status(400).json({ error: 'csv_data required' })

    const parsed = Papa.parse(csv_data, { header: true, skipEmptyLines: true })
    const contacts = (parsed.data as Array<Record<string, string>>)
      .filter(row => row.phone)
      .map(row => ({
        id: uuidv4(),
        user_id: user.userId,
        phone: row.phone?.replace(/\D/g, ''),
        name: row.name || null,
        email: row.email || null,
        tags: row.tags ? row.tags.split(';').map((t: string) => t.trim()) : [],
        custom_fields: {},
      }))

    // Upsert all
    const { data, error } = await db.from('contacts')
      .upsert(contacts, { onConflict: 'user_id,phone', ignoreDuplicates: false })
      .select()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ imported: data?.length, total: contacts.length })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
