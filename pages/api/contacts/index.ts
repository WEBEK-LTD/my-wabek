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
    const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

    // One row per normalized phone (the last occurrence in the file wins), so
    // the upsert never touches the same (user_id, phone) twice.
    type Row = { phone: string; name: string; email: string; tags: string[] }
    const byPhone = new Map<string, Row>()
    for (const row of (parsed.data as Array<Record<string, string>>)) {
      const phone = typeof row?.phone === 'string' ? row.phone.replace(/\D/g, '') : ''
      if (!phone) continue
      if (!byPhone.has(phone) && byPhone.size >= 20000) continue
      byPhone.delete(phone) // keep insertion order = last occurrence
      byPhone.set(phone, {
        phone,
        name: clean(row.name, 200),
        email: clean(row.email, 254),
        tags: typeof row.tags === 'string'
          ? row.tags.split(';').map(t => t.trim().slice(0, 100)).filter(Boolean).slice(0, 50)
          : [],
      })
    }
    const rows = Array.from(byPhone.values())
    const phones = rows.map(r => r.phone)

    // Existing contacts for these phones: an empty CSV cell must not erase a
    // saved name/email, and imported tags are added to the saved ones.
    const existing = new Map<string, { name: string | null; email: string | null; tags: string[] | null }>()
    for (let i = 0; i < phones.length; i += 500) {
      const { data: found, error: findErr } = await db.from('contacts')
        .select('phone, name, email, tags')
        .eq('user_id', user.userId).in('phone', phones.slice(i, i + 500))
      if (findErr) {
        console.error('[contacts] import lookup error:', findErr.message)
        return res.status(500).json({ error: 'Import failed' })
      }
      for (const c of found || []) existing.set(c.phone, c)
    }
    const newCount = phones.length - existing.size

    // Plan: max_contacts — only rows that would be NEW count against it
    const lim = await checkPlanLimit(user.userId, 'contacts')
    if (newCount > 0 && (!lim.allowed || (lim.limit > 0 && lim.current + newCount > lim.limit))) {
      return res.status(403).json({
        ...contactLimitError(lim.limit),
        detail: `This import would add ${newCount} new contact(s); your plan allows ${lim.limit} and you have ${lim.current}.`,
      })
    }

    // Every row carries the same columns (no id: the DB default applies to new
    // rows and existing rows keep theirs), with the saved values filled in.
    const payload = rows.map(r => {
      const prev = existing.get(r.phone)
      const prevTags = Array.isArray(prev?.tags) ? prev!.tags : []
      return {
        user_id: user.userId,
        phone: r.phone,
        name: r.name || prev?.name || null,
        email: r.email || prev?.email || null,
        tags: Array.from(new Set([...prevTags, ...r.tags])).slice(0, 100),
      }
    })

    let imported = 0
    for (let i = 0; i < payload.length; i += 1000) {
      const { data, error } = await db.from('contacts')
        .upsert(payload.slice(i, i + 1000), { onConflict: 'user_id,phone', ignoreDuplicates: false })
        .select('id')
      if (error) {
        console.error('[contacts] import error:', error.message)
        return res.status(500).json({ error: 'Import failed', imported })
      }
      imported += data?.length || 0
    }
    return res.status(200).json({
      imported,
      total: payload.length,
      inserted: newCount,
      updated: existing.size,
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
