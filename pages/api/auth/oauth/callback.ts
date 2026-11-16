import { NextApiRequest, NextApiResponse } from 'next'
import { findOrCreateOAuthUser, issueSession } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const { code, error } = req.query

  if (error) return res.redirect(`${appUrl}/auth/login?error=oauth_cancelled`)
  if (typeof code !== 'string' || !code) return res.redirect(`${appUrl}/auth/login?error=no_code`)

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) return res.redirect(`${appUrl}/auth/login?error=server_error`)

    const supabase = createClient(supabaseUrl, anonKey)
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError || !data?.user) {
      console.error('[oauth/callback] code exchange failed:', exchangeError?.message)
      return res.redirect(`${appUrl}/auth/login?error=oauth_failed`)
    }

    const result = await findOrCreateOAuthUser(data.user)
    if (!result.ok) return res.redirect(`${appUrl}/auth/login?error=${encodeURIComponent(result.code)}`)

    // Session goes in the httpOnly cookie only — never in the URL.
    await issueSession(res, result.user)
    return res.redirect(`${appUrl}/auth/oauth-success`)
  } catch (e) {
    console.error('[oauth/callback] error:', e)
    return res.redirect(`${appUrl}/auth/login?error=server_error`)
  }
}
