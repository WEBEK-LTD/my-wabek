import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isDevicePushToken } from '@/lib/mobile-push'
import { isMissingDbObject } from '@/lib/db-compat'

// Mobile app push token.
//   POST   {token, provider: apns|fcm, platform, locale, prefs?}  → register / refresh (after sign-in, on app start)
//   PUT    {token, locale?, prefs?}           → language or notification switches changed
//   DELETE {token}                            → sign-out
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const body = (req.body || {}) as Record<string, unknown>
  const token = body.token
  // POST names the provider; PUT / DELETE only identify an already-registered token.
  const provider = body.provider === 'apns' ? 'apns' : body.provider === 'fcm' ? 'fcm' : null
  const valid = req.method === 'POST'
    ? isDevicePushToken(token, provider)
    : typeof token === 'string' && (isDevicePushToken(token, 'apns') || isDevicePushToken(token, 'fcm'))
  if (!valid) return res.status(400).json({ error: 'Invalid push token' })

  const locale = body.locale === 'ar' ? 'ar' : 'en'
  const prefs: Record<string, boolean> = {}
  if (body.prefs && typeof body.prefs === 'object') {
    for (const k of ['messages', 'numbers', 'campaigns']) {
      const v = (body.prefs as Record<string, unknown>)[k]
      if (typeof v === 'boolean') prefs[k] = v
    }
  }

  try {
    if (req.method === 'POST') {
      const platform = body.platform === 'ios' || body.platform === 'android' ? body.platform : 'unknown'
      const { error } = await db.from('mobile_push_tokens').upsert({
        token,
        provider,
        user_id: user.userId,
        actual_user_id: user.actualUserId || null,
        platform,
        locale,
        prefs: { messages: true, numbers: true, campaigns: true, ...prefs },
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'token' })
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (req.method === 'PUT') {
      const { data: row } = await db.from('mobile_push_tokens').select('prefs').eq('token', token).eq('user_id', user.userId).maybeSingle()
      if (!row) return res.status(404).json({ error: 'Token not registered' })
      const update: Record<string, unknown> = { last_seen_at: new Date().toISOString(), prefs: { ...(row.prefs as object || {}), ...prefs } }
      if (body.locale !== undefined) update.locale = locale
      const { error } = await db.from('mobile_push_tokens').update(update).eq('token', token).eq('user_id', user.userId)
      if (error) throw error
      return res.status(200).json({ success: true })
    }

    if (req.method === 'DELETE') {
      await db.from('mobile_push_tokens').delete().eq('token', token).eq('user_id', user.userId)
      return res.status(200).json({ success: true })
    }
  } catch (e) {
    if (isMissingDbObject(e)) return res.status(503).json({ error: 'Push notifications are not set up on the server yet', code: 'push_unavailable' })
    console.error('[mobile/push-token] failed:', e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'Could not save the push token' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
