import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, hashPassword, comparePassword, bumpTokenVersion, issueSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { hitRateLimit } from '@/lib/middleware'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  // The logged-in person (a team member changes THEIR password, not the owner's).
  const selfId = user.actualUserId || user.userId

  const { current_password, new_password } = req.body || {}
  if (typeof current_password !== 'string' || typeof new_password !== 'string' || !current_password || !new_password) {
    return res.status(400).json({ error: 'Both passwords required' })
  }
  if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' })
  if (new_password.length > 256) return res.status(400).json({ error: 'New password is too long' })

  if (!(await hitRateLimit(`pwchange:${selfId}`, 5, 15 * 60))) {
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' })
  }

  const { data: dbUser } = await db.from('users').select('id, email, role, password_hash').eq('id', selfId).maybeSingle()
  if (!dbUser) return res.status(404).json({ error: 'User not found' })

  const valid = await comparePassword(current_password, dbUser.password_hash)
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })

  const newHash = await hashPassword(new_password)
  const { error } = await db.from('users').update({ password_hash: newHash, updated_at: new Date().toISOString() }).eq('id', selfId)
  if (error) {
    console.error('[settings/password] update failed:', error.message)
    return res.status(500).json({ error: 'Could not update password' })
  }

  // Sign out every other session, then give this one a fresh token.
  const tv = await bumpTokenVersion(selfId)
  await issueSession(res, { ...dbUser, token_version: tv ?? 0 })
  return res.status(200).json({ success: true })
}
