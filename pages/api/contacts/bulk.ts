import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const { ids, action } = req.body || {}
  if (!Array.isArray(ids) || !ids.length || ids.some((i: unknown) => typeof i !== 'string')) {
    return res.status(400).json({ error: 'ids array required' })
  }
  if (ids.length > 1000) return res.status(400).json({ error: 'Too many ids (max 1000)' })

  // Ensure all IDs belong to this user
  if (action === 'delete') {
    await db.from('contacts').delete().in('id', ids).eq('user_id', user.userId)
    return res.status(200).json({ success: true, deleted: ids.length })
  }

  if (action === 'block') {
    await db.from('contacts').update({ is_blocked: true }).in('id', ids).eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  if (action === 'unblock') {
    await db.from('contacts').update({ is_blocked: false }).in('id', ids).eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  if (action === 'add_tag') {
    const { tag } = req.body
    if (!tag || typeof tag !== 'string' || tag.length > 100) return res.status(400).json({ error: 'tag required' })
    // Add tag to each contact
    const { data: contacts } = await db.from('contacts').select('id, tags').in('id', ids).eq('user_id', user.userId)
    for (const c of contacts || []) {
      const tags: string[] = c.tags || []
      if (!tags.includes(tag)) {
        await db.from('contacts').update({ tags: [...tags, tag] }).eq('id', c.id).eq('user_id', user.userId)
      }
    }
    return res.status(200).json({ success: true })
  }

  return res.status(400).json({ error: 'Invalid action' })
}
