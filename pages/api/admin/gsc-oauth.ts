import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const GSC_KEY = 'gsc_oauth'
const SCOPES = 'https://www.googleapis.com/auth/webmasters.readonly'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const db = supabaseAdmin()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const redirectUri = `${appUrl}/api/admin/gsc-callback`
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  // GET → return current status
  if (req.method === 'GET') {
    const { data } = await db.from('system_settings').select('value').eq('key', GSC_KEY).maybeSingle()
    const oauth = data?.value as any
    if (oauth?.access_token) {
      return res.status(200).json({
        connected: true,
        email: oauth.email || 'Connected',
        expires_at: oauth.expires_at,
        has_refresh: !!oauth.refresh_token,
      })
    }
    return res.status(200).json({ connected: false })
  }

  // POST action=connect → generate OAuth URL
  if (req.method === 'POST') {
    const { action } = req.body

    if (action === 'connect') {
      if (!clientId) return res.status(400).json({ error: 'GOOGLE_CLIENT_ID not set in environment variables' })
      const adminAny = admin as any
      const state = Buffer.from(JSON.stringify({ ts: Date.now(), admin: adminAny.id || adminAny.sub || 'admin' })).toString('base64')
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', SCOPES)
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')
      authUrl.searchParams.set('state', state)
      return res.status(200).json({ url: authUrl.toString() })
    }

    if (action === 'disconnect') {
      await db.from('system_settings').delete().eq('key', GSC_KEY)
      return res.status(200).json({ success: true })
    }

    // action=refresh → refresh access token
    if (action === 'refresh') {
      if (!clientId || !clientSecret) return res.status(400).json({ error: 'Google credentials not configured' })
      const { data } = await db.from('system_settings').select('value').eq('key', GSC_KEY).maybeSingle()
      const oauth = data?.value as any
      if (!oauth?.refresh_token) return res.status(400).json({ error: 'No refresh token' })
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: oauth.refresh_token,
          grant_type: 'refresh_token',
        }),
      })
      const tokens = await tokenRes.json()
      if (!tokens.access_token) return res.status(400).json({ error: 'Refresh failed', detail: tokens })
      const updated = {
        ...oauth,
        access_token: tokens.access_token,
        expires_at: Date.now() + (tokens.expires_in * 1000),
      }
      await db.from('system_settings').upsert({ key: GSC_KEY, value: updated }, { onConflict: 'key' })
      return res.status(200).json({ success: true })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
