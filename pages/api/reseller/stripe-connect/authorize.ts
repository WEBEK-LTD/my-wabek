import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
  if (!clientId) return res.status(500).json({ error: 'Stripe Connect not configured' })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const redirectUri = `${appUrl}/api/reseller/stripe-connect/callback`

  // State = userId only (no timestamp to keep it stable)
  const state = Buffer.from(JSON.stringify({ userId: user.userId })).toString('base64')

  const stripeUrl = new URL('https://connect.stripe.com/oauth/authorize')
  stripeUrl.searchParams.set('response_type', 'code')
  stripeUrl.searchParams.set('client_id', clientId)
  stripeUrl.searchParams.set('scope', 'read_write')
  stripeUrl.searchParams.set('redirect_uri', redirectUri)
  stripeUrl.searchParams.set('state', state)
  // Do NOT set stripe_user[business_type] — that triggers "new account creation"
  // which Stripe flags as suspicious. We only want to CONNECT existing accounts.

  return res.redirect(stripeUrl.toString())
}
