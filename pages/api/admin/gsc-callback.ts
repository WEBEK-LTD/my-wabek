import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

const GSC_KEY = 'gsc_oauth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, error, state } = req.query

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const redirectUri = `${appUrl}/api/admin/gsc-callback`
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (error) {
    return res.redirect(`/admin/seo?gsc_error=${encodeURIComponent(String(error))}`)
  }

  if (!code || !clientId || !clientSecret) {
    return res.redirect('/admin/seo?gsc_error=missing_credentials')
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: String(code),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      return res.redirect(`/admin/seo?gsc_error=token_exchange_failed`)
    }

    // Get user email from Google
    let email = 'Connected'
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const user = await userRes.json()
      email = user.email || email
    } catch {}

    // Save to DB
    const db = supabaseAdmin()
    await db.from('system_settings').upsert({
      key: GSC_KEY,
      value: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: Date.now() + ((tokens.expires_in || 3600) * 1000),
        email,
        connected_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })

    return res.redirect('/admin/seo?tab=gsc&gsc_success=1')
  } catch (err: any) {
    return res.redirect(`/admin/seo?gsc_error=${encodeURIComponent(err.message)}`)
  }
}
