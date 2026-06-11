import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

function generateGiftCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'GIFT-'
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-'
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    // Admin gets all, users get their own
    const query = user.role === 'admin'
      ? db.from('gift_invites').select('*, plan:plan_id(name), used_by_user:used_by(name, email)').order('created_at', { ascending: false })
      : db.from('gift_invites').select('*, plan:plan_id(name)').eq('created_by', user.userId).order('created_at', { ascending: false })

    const { data } = await query
    return res.status(200).json({ gifts: data || [] })
  }

  if (req.method === 'POST') {
    const { plan_id, duration_days, price, note, quantity = 1, expires_at } = req.body
    if (!plan_id || !duration_days) return res.status(400).json({ error: 'plan_id and duration_days required' })

    const gifts = []
    for (let i = 0; i < Math.min(quantity, 50); i++) {
      const code = generateGiftCode()
      gifts.push({
        id: uuidv4(),
        created_by: user.userId,
        plan_id,
        code,
        duration_days: parseInt(duration_days),
        price: parseFloat(price) || 0,
        note,
        expires_at: expires_at || null,
      })
    }

    const { data, error } = await db.from('gift_invites').insert(gifts).select()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ gifts: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
