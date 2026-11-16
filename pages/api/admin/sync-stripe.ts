import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { logAction, getClientIp } from '@/lib/middleware'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAdmin(req, res)
  if (!user) return

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return res.status(400).json({ error: 'STRIPE_SECRET_KEY not configured' })

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
  const db = supabaseAdmin()

  const { data: plans } = await db.from('plans').select('*').eq('is_active', true)
  if (!plans?.length) return res.status(200).json({ message: 'No plans found', synced: 0 })

  const results = []

  for (const plan of plans) {
    if (plan.price_monthly === 0) continue // skip free plan

    try {
      let productId: string

      // Check if product already exists in Stripe by searching metadata
      const existingProducts = await stripe.products.search({
        query: `metadata['wabek_plan_id']:'${plan.id}'`,
      })

      if (existingProducts.data.length > 0) {
        productId = existingProducts.data[0].id
        // Update product name if changed
        await stripe.products.update(productId, {
          name: `WABEK ${plan.name}`,
          description: plan.description || `WABEK ${plan.name} Plan`,
        })
      } else {
        // Create new product
        const product = await stripe.products.create({
          name: `WABEK ${plan.name}`,
          description: plan.description || `WABEK ${plan.name} Plan`,
          metadata: { wabek_plan_id: plan.id },
        })
        productId = product.id
      }

      // Reuse the stored price only if it is still active and matches the
      // plan's current amount; otherwise find/create a matching one. Existing
      // subscribers keep their old price (it still maps to the plan via
      // price/product metadata wabek_plan_id in the webhook).
      const ensurePrice = async (storedId: string | null, amount: number, interval: 'month' | 'year', cycle: string) => {
        if (!(amount > 0)) return storedId || null
        const cents = Math.round(amount * 100)
        if (storedId) {
          try {
            const p = await stripe.prices.retrieve(storedId)
            if (p.active && p.unit_amount === cents && p.recurring?.interval === interval) return storedId
          } catch { /* missing -> recreate */ }
        }
        const existing = await stripe.prices.list({ product: productId, active: true, recurring: { interval }, limit: 100 })
        const match = existing.data.find(p => p.unit_amount === cents && p.currency === 'usd')
        if (match) return match.id
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: cents,
          currency: 'usd',
          recurring: { interval },
          metadata: { wabek_plan_id: plan.id, billing_cycle: cycle },
        })
        return price.id
      }

      const monthlyPriceId = await ensurePrice(plan.stripe_price_id_monthly, Number(plan.price_monthly), 'month', 'monthly')
      const yearlyPriceId = await ensurePrice(plan.stripe_price_id_yearly, Number(plan.price_yearly), 'year', 'yearly')

      // Update plan in Supabase with Stripe IDs
      await db.from('plans').update({
        stripe_price_id_monthly: monthlyPriceId,
        stripe_price_id_yearly: yearlyPriceId || null,
      }).eq('id', plan.id)

      results.push({
        plan: plan.name,
        status: 'synced',
        monthly: monthlyPriceId,
        yearly: yearlyPriceId || null,
      })
    } catch (err) {
      console.error(`[sync-stripe] plan ${plan.id} failed:`, err instanceof Error ? err.message : err)
      results.push({
        plan: plan.name,
        status: 'error',
        error: 'Stripe sync failed for this plan',
      })
    }
  }

  await logAction({ userId: user.userId, action: 'admin_sync_stripe', resource: 'plan', details: { results: results.map(r => ({ plan: r.plan, status: r.status })) }, ipAddress: getClientIp(req) })
  return res.status(200).json({
    success: true,
    synced: results.filter(r => r.status === 'synced').length,
    results,
  })
}
