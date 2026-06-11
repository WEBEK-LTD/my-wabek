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

  const sig = req.headers['stripe-signature'] as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    const buf = await buffer(req)
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2023-10-16" })
    event = stripeClient.webhooks.constructEvent(buf, sig, webhookSecret)
  } catch (err: unknown) {
    return res.status(400).json({ error: `Webhook Error: ${(err as Error).message}` })
  }

  try {
    await handleWebhookEvent(event)
    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Stripe webhook processing error:', err)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}
