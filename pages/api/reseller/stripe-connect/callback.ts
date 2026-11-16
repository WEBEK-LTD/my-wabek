import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { verifyState } from '@/lib/security'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error: stripeError } = req.query
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'

  if (stripeError) {
    return res.redirect(`${appUrl}/dashboard/reseller?tab=settings&error=stripe_denied`)
  }

  if (typeof code !== 'string' || !code || typeof state !== 'string' || !state) {
    return res.redirect(`${appUrl}/dashboard/reseller?tab=settings&error=invalid_callback`)
  }

  // State must be our signed, unexpired state AND match the logged-in owner.
  const decoded = verifyState<{ userId?: string; purpose?: string }>(state)
  if (!decoded?.userId || decoded.purpose !== 'stripe_connect') {
    return res.redirect(`${appUrl}/dashboard/reseller?tab=settings&error=expired`)
  }
  const auth = await getAuthUser(req)
  if (!auth.ok || auth.payload.actualUserId || auth.payload.userId !== decoded.userId) {
    return res.redirect(`${appUrl}/dashboard/reseller?tab=settings&error=invalid_state`)
  }
  const userId = decoded.userId

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_secret: process.env.STRIPE_SECRET_KEY!,
      }),
    })

    const tokenData = await tokenRes.json()

    if (tokenData.error || !tokenData.stripe_user_id) {
      console.error('Stripe Connect error:', tokenData.error, tokenData.error_description)
      return res.redirect(`${appUrl}/dashboard/reseller?tab=settings&error=stripe_error`)
    }

    const {
      access_token,
      refresh_token,
      stripe_user_id,       // Their Stripe account ID e.g. acct_xxx
      stripe_publishable_key,
    } = tokenData

    const db = supabaseAdmin()

    // An account can only be connected to one reseller.
    const { data: other } = await db.from('reseller_profiles').select('user_id')
      .eq('stripe_connect_account_id', stripe_user_id).neq('user_id', userId).limit(1)
    if (other?.length) return res.redirect(`${appUrl}/dashboard/reseller?tab=settings&error=stripe_error`)

    // Save to reseller profile (keep the existing row id if there is one)
    const { data: existing } = await db.from('reseller_profiles').select('id').eq('user_id', userId).maybeSingle()
    await db.from('reseller_profiles').upsert({
      id: existing?.id || uuidv4(),
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
