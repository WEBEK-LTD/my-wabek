import type { Config } from "@netlify/functions"
import { createHmac } from "node:crypto"

// Same derivation as lib/security.ts getCronSecret(): CRON_SECRET, or — when
// it is not set — HMAC-SHA256(JWT signing secret, 'wabek-cron-v1') in hex.
// Both run in the same Netlify env, so they agree. The raw JWT secret is
// never sent anywhere.
function cronSecret(): string | null {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET
  const jwt = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_JWT_SECRET_KEY
  if (!jwt) return null
  console.warn('Campaign runner: CRON_SECRET is not set — using the secret derived from the JWT signing secret')
  return createHmac('sha256', jwt).update('wabek-cron-v1').digest('hex')
}

// Runs every minute to process scheduled/batched campaigns.
// Auth: `x-cron-secret` header only (never a query string).
export default async () => {
  const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const secret  = cronSecret()
  if (!secret) {
    console.error('Campaign runner: neither CRON_SECRET nor a JWT signing secret is set — skipping run')
    return
  }

  try {
    const r = await fetch(`${baseUrl}/api/campaigns/scheduler`, {
      method: 'POST',
      headers: { 'x-cron-secret': secret },
    })
    const data = await r.json().catch(() => ({}))
    console.log('Campaign runner:', r.status, JSON.stringify(data))
  } catch (e: unknown) {
    console.error('Campaign runner error:', (e as Error).message)
  }
}

export const config: Config = {
  schedule: "* * * * *"
}
