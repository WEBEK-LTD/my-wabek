import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, signToken } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/mobile/session — swap a still-valid app token for a fresh 7-day
// one (the app calls it on start and when the token is older than a day), so
// people who use the app regularly are never signed out. A revoked token
// (password change, "log out everywhere", suspended account) fails in
// requireAuth and the app goes back to the sign-in screen.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const selfId = user.actualUserId || user.userId
  const { data: self } = await db.from('users').select('id, email, role, token_version').eq('id', selfId).maybeSingle()
  if (!self) return res.status(401).json({ error: 'Session expired' })
  const token = await signToken({
    userId: self.id,
    email: self.email,
    role: self.role === 'admin' ? 'admin' : 'user',
    tv: typeof self.token_version === 'number' ? self.token_version : 0,
  })
  return res.status(200).json({ token })
}
