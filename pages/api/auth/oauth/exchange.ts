import { NextApiRequest, NextApiResponse } from 'next'
import { findOrCreateOAuthUser, issueSession } from '@/lib/auth'
import { authRateLimitAsync } from '@/lib/middleware'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await authRateLimitAsync(req, res))) return

  const { access_token } = req.body || {}
  if (typeof access_token !== 'string' || !access_token || access_token.length > 8192) {
    return res.status(400).json({ error: 'access_token required' })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL
    const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !apiKey) {
      console.error('[oauth/exchange] Supabase not configured')
      return res.status(500).json({ error: 'Server error' })
    }

    // Resolve the Supabase session owner from their access token.
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${access_token}`, apikey: apiKey },
    })
    if (!userRes.ok) {
      console.error('[oauth/exchange] Supabase user fetch failed:', userRes.status)
      return res.status(401).json({ error: 'Invalid token' })
    }

    const result = await findOrCreateOAuthUser(await userRes.json())
    if (!result.ok) return res.status(result.status).json({ error: result.error })

    const token = await issueSession(res, result.user)
    return res.status(200).json({
      token,
      user: { id: result.user.id, email: result.user.email, name: result.user.name, role: result.user.role, avatar_url: result.avatar },
    })
  } catch (e) {
    console.error('[oauth/exchange] error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}
