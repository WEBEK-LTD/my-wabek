import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { verifyState } from '@/lib/security'
import { logAction, getClientIp } from '@/lib/middleware'

const GSC_KEY = 'gsc_oauth'

// Runs requireAdmin without letting it write the response, so a failure can
// redirect back to the UI instead.
async function cookieAdminId(req: NextApiRequest): Promise<string | null> {
  let failed = false
  const sink = {
    status() { failed = true; return sink },
    json() { return sink },
    setHeader() { return sink },
    end() { return sink },
  } as unknown as NextApiResponse
  const admin = await requireAdmin(req, sink)
  return !failed && admin ? admin.userId : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, error, state } = req.query

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const redirectUri = `${appUrl}/api/admin/gsc-callback`
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (error) {
    return res.redirect('/admin/seo?gsc_error=access_denied')
  }

  // State must be ours (HMAC-signed, unexpired) and bound to an admin.
  const st = verifyState<{ purpose?: string; uid?: string }>(state)
  if (!st || st.purpose !== 'gsc' || !st.uid) {
    return res.redirect('/admin/seo?gsc_error=invalid_state')
  }

  const db = supabaseAdmin()

  // If the browser carries an auth session (cookie/Bearer), it must be the
  // same admin who started the flow.
  if (req.cookies?.wabek_token || req.headers.authorization) {
    const sessionAdmin = await cookieAdminId(req)
    if (!sessionAdmin || sessionAdmin !== st.uid) {
      return res.redirect('/admin/seo?gsc_error=unauthorized')
    }
  }
  // The user in the state must still be an active admin.
  const { data: adminUser } = await db.from('users').select('id, role, is_active').eq('id', st.uid).maybeSingle()
  if (!adminUser || adminUser.role !== 'admin' || adminUser.is_active === false) {
    return res.redirect('/admin/seo?gsc_error=unauthorized')
  }

  if (typeof code !== 'string' || !code || !clientId || !clientSecret) {
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
        code,
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

    const { error: saveErr } = await db.from('system_settings').upsert({
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
    if (saveErr) {
      console.error('[gsc-callback] save failed:', saveErr.message)
      return res.redirect('/admin/seo?gsc_error=save_failed')
    }

    await logAction({ userId: st.uid, action: 'admin_gsc_connect', resource: 'system_settings', ipAddress: getClientIp(req) })
    return res.redirect('/admin/seo?tab=gsc&gsc_success=1')
  } catch (err) {
    console.error('[gsc-callback] error:', (err as Error)?.message)
    return res.redirect('/admin/seo?gsc_error=unexpected_error')
  }
}
