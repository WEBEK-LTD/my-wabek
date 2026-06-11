import { NextApiRequest, NextApiResponse } from 'next'

// Step 1: Wix redirects user here when installing the app
// We redirect them to Wix OAuth to get permissions
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const APP_ID     = process.env.WIX_APP_ID     || '48cfce94-1e3d-4d09-a34d-e5f41e5b0469'
  const APP_URL    = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'

  const token       = req.query.token as string // Wix sends this
  const redirectUri = `${APP_URL}/api/wix/oauth-callback`

  if (!token) return res.status(400).json({ error: 'Missing token from Wix' })

  // Redirect to Wix OAuth consent screen
  const oauthUrl = `https://www.wix.com/installer/install?token=${token}&appId=${APP_ID}&redirectUrl=${encodeURIComponent(redirectUri)}`

  return res.redirect(oauthUrl)
}
