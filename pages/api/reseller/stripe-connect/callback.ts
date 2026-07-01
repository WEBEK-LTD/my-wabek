import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error: stripeError } = req.query
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'

  if (stripeError) {
    return res.redirect(`${appUrl}/dashboard/reseller?tab=settings&error=stripe_denied`)
  }

  if (!code || !state) {
    return res.redirect(`${appUrl}/dashboard/reseller?tab=settings&error=invalid_callback`)
  }

  // Decode state to get userId
  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state as string, 'base64').toString())
    userId = decoded.userId
    if (!userId) throw new Error('missing userId')
  } catch {
    return res.redirect(`${appUrl}/dashboard/reseller?tab=settings&error=invalid_state`)
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        client_secret: process.env.STRIPE_SECRET_KEY!,
      }),
    })

    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      console.error('Stripe Connect error:', tokenData)
      return res.redirect(`${appUrl}/dashboard/reseller?tab=settings&error=stripe_error`)
    }

    const {
      access_token,
      refresh_token,
      stripe_user_id,       // Their Stripe account ID e.g. acct_xxx
      stripe_publishable_key,
    } = tokenData

    const db = supabaseAdmin()

    // Save to reseller profile
    await db.from('reseller_profiles').upsert({
      id: uuidv4(),
      user_id: userId,
      payment_method: 'stripe_own',
      stripe_connect_account_id: stripe_user_id,
      stripe_connect_access_token: access_token,
      stripe_connect_refresh_token: refresh_token,
      own_stripe_publishable_key: stripe_publishable_key,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return res.redirect(`${appUrl}/dashboard/reseller?tab=settings&success=stripe_connected`)
  } catch (e) {
    console.error('Stripe Connect callback error:', e)
    return res.redirect(`${appUrl}/dashboard/reseller?tab=settings&error=server_error`)
  }
}
