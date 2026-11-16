import { NextApiRequest, NextApiResponse } from 'next'
import { handleWebhookEvent } from '@/lib/stripe'
import Stripe from 'stripe'

export const config = { api: { bodyParser: false } }

async function buffer(readable: NextApiRequest) {
  const chunks: Buffer[] = []
  for await (const chunk of readable as unknown as AsyncIterable<Buffer>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET is not configured')
    return res.status(500).json({ error: 'Webhook not configured' })
  }

  const sig = req.headers['stripe-signature']
  if (typeof sig !== 'string') return res.status(400).json({ error: 'Invalid signature' })

  let event: Stripe.Event
  try {
    const buf = await buffer(req)
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' })
    event = stripeClient.webhooks.constructEvent(buf, sig, webhookSecret)
  } catch {
    return res.status(400).json({ error: 'Invalid signature' })
  }

  try {
    const outcome = await handleWebhookEvent(event)
    return res.status(200).json({ received: true, outcome })
  } catch (err) {
    // Transient failure (DB/Stripe unavailable): the event claim was released,
    // so Stripe's bounded retry schedule can process it later.
    console.error(`[stripe webhook] processing ${event.id} (${event.type}) failed:`, (err as Error)?.message)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}
