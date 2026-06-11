import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return

  const db = supabaseAdmin()
  const { data: profile } = await db.from('reseller_profiles').select('stripe_connect_account_id').eq('user_id', user.userId).single()

  if (profile?.stripe_connect_account_id) {
    // Deauthorize from Stripe
    try {
      await fetch('https://connect.stripe.com/oauth/deauthorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
          stripe_user_id: profile.stripe_connect_account_id,
        }),
      })
    } catch {}
  }

  // Clear from DB
  await db.from('reseller_profiles').update({
    stripe_connect_account_id: null,
    stripe_connect_access_token: null,
    stripe_connect_refresh_token: null,
    own_stripe_publishable_key: null,
    payment_method: 'platform',
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.userId)

  return res.status(200).json({ success: true })
}
