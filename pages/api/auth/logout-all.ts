import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, bumpTokenVersion } from '@/lib/auth'

/**
 * POST /api/auth/logout-all — "Log out of all devices".
 *
 * Session model: sessions are stateless JWTs carried in the HttpOnly
 * `wabek_token` cookie. `POST /api/auth/me` logs out the current browser by
 * expiring that cookie. Revoking every session of the signed-in person is
 * done by bumping `users.token_version`: every token issued before the bump
 * carries an older `tv` claim and is rejected by getAuthUser on its next
 * request. For team members the member's own row is bumped, never the
 * account owner's.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const user = await requireAuth(req, res)
  if (!user) return

  const selfId = user.actualUserId || user.userId
  const tv = await bumpTokenVersion(selfId)
  res.setHeader('Set-Cookie', `wabek_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
  res.setHeader('Cache-Control', 'no-store')
  if (tv === null) return res.status(500).json({ error: 'Could not revoke sessions' })
  return res.status(200).json({ success: true })
}
