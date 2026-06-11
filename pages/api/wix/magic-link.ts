import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  const db = supabaseAdmin()

  // Verify user exists
  const { data: user } = await db.from('users').select('id, email').eq('id', user_id).maybeSingle()
  if (!user) return res.status(404).json({ error: 'User not found' })

  // Create one-time magic token — valid 5 minutes
  const token = uuidv4()
  await db.from('system_settings').upsert({
    key:        `magic_login_${token}`,
    value:      { user_id, email: user.email, created_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  return res.status(200).json({
    url: `${appUrl}/auth/magic?token=${token}`
  })
}
