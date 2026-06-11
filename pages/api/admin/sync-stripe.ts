import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

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

      // Handle monthly price
      let monthlyPriceId = plan.stripe_price_id_monthly
      if (!monthlyPriceId && plan.price_monthly > 0) {
        // Check for existing active monthly price
        const existingPrices = await stripe.prices.list({
          product: productId,
          active: true,
          recurring: { interval: 'month' },
        })

        if (existingPrices.data.length > 0) {
          monthlyPriceId = existingPrices.data[0].id
        } else {
          const price = await stripe.prices.create({
            product: productId,
            unit_amount: Math.round(plan.price_monthly * 100),
            currency: 'usd',
            recurring: { interval: 'month' },
            metadata: { wabek_plan_id: plan.id, billing_cycle: 'monthly' },
          })
          monthlyPriceId = price.id
        }
      }

      // Handle yearly price
      let yearlyPriceId = plan.stripe_price_id_yearly
      if (!yearlyPriceId && plan.price_yearly > 0) {
        const existingYearlyPrices = await stripe.prices.list({
          product: productId,
          active: true,
          recurring: { interval: 'year' },
        })

        if (existingYearlyPrices.data.length > 0) {
          yearlyPriceId = existingYearlyPrices.data[0].id
        } else {
          const price = await stripe.prices.create({
            product: productId,
            unit_amount: Math.round(plan.price_yearly * 100),
            currency: 'usd',
            recurring: { interval: 'year' },
            metadata: { wabek_plan_id: plan.id, billing_cycle: 'yearly' },
          })
          yearlyPriceId = price.id
        }
      }

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
      results.push({
        plan: plan.name,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return res.status(200).json({
    success: true,
    synced: results.filter(r => r.status === 'synced').length,
    results,
  })
}
