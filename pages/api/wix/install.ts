import { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes } from 'crypto'
import { signState } from '@/lib/security'

// Step 1: Wix redirects user here when installing the app
// We redirect them to Wix OAuth to get permissions, with a signed state
// that /api/wix/oauth-callback verifies.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const APP_ID  = process.env.WIX_APP_ID
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  if (!APP_ID) {
    console.error('[wix install] WIX_APP_ID is not set')
    return res.status(500).json({ error: 'Wix app is not configured' })
  }

  const token       = req.query.token // Wix sends this
  const redirectUri = `${APP_URL}/api/wix/oauth-callback`

  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Missing token from Wix' })

  const state = signState({ purpose: 'wix_install', n: randomBytes(8).toString('hex') }, 30 * 60)

  // Redirect to Wix OAuth consent screen
  const oauthUrl = `https://www.wix.com/installer/install?token=${encodeURIComponent(token)}&appId=${encodeURIComponent(APP_ID)}&redirectUrl=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`

  return res.redirect(oauthUrl)
}
