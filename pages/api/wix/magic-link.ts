import { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyWixInstance, getWixInstanceParam, getLinkedUserId, wixAppConfigured } from '@/lib/wix-auth'

// "Open full dashboard" from the Wix app page. The account is derived from a
// VERIFIED (signed) Wix instance → wix_user_links; a user_id in the request
// is never accepted.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!wixAppConfigured(res)) return
  const wix = verifyWixInstance(getWixInstanceParam(req))
  if (!wix) return res.status(401).json({ error: 'Invalid or expired Wix session. Please reopen the app from your Wix dashboard.' })

  const userId = await getLinkedUserId(wix.instanceId)
  if (!userId) return res.status(404).json({ error: 'Store not connected' })

  const db = supabaseAdmin()
  const { data: user } = await db.from('users').select('id, email, role, is_active').eq('id', userId).maybeSingle()
  if (!user || user.is_active === false) return res.status(404).json({ error: 'User not found' })
  // Never mint platform-admin sessions from a Wix store
  if (user.role === 'admin') return res.status(403).json({ error: 'Please sign in to the dashboard directly' })

  // One-time magic token — valid 5 minutes (consumed by /api/auth/magic-verify)
  const token = randomBytes(32).toString('hex')
  await db.from('system_settings').upsert({
    key:        `magic_login_${token}`,
    value:      { user_id: user.id, email: user.email, created_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  return res.status(200).json({
    url: `${appUrl}/auth/magic?token=${token}`
  })
}
