import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { issueSession } from '@/lib/auth'
import { authRateLimitAsync } from '@/lib/middleware'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await authRateLimitAsync(req, res))) return

  const { token } = req.body || {}
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,256}$/.test(token)) {
    return res.status(400).json({ error: 'Token required' })
  }

  try {
    const db = supabaseAdmin()
    const key = `magic_login_${token}`

    // One-time use: delete-and-return, so only one request can win the token.
    const { data: deleted } = await db.from('system_settings').delete().eq('key', key).select('value')
    const record = deleted?.[0]
    if (!record?.value) return res.status(401).json({ error: 'Invalid or expired link' })

    const { user_id, created_at } = record.value as { user_id: string; created_at: string }

    // 5 min expiry
    if (!created_at || Date.now() - new Date(created_at).getTime() > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'Link expired. Please try again.' })
    }

    const { data: user } = await db.from('users').select('*').eq('id', user_id).maybeSingle()
    if (!user) return res.status(401).json({ error: 'Invalid or expired link' })
    if (user.is_active === false) return res.status(403).json({ error: 'Account suspended' })

    const authToken = await issueSession(res, user)
    return res.status(200).json({
      success: true,
      token: authToken,
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    })
  } catch (err) {
    console.error('[magic-verify] error:', err)
    return res.status(500).json({ error: 'Sign-in failed' })
  }
}
