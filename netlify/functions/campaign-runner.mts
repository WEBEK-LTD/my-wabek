import type { Config } from "@netlify/functions"

// Runs every minute to process scheduled/batched campaigns.
// Auth: `x-cron-secret` header with CRON_SECRET (never a query string, never JWT_SECRET).
export default async () => {
  const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const secret  = process.env.CRON_SECRET
  if (!secret) {
    console.error('Campaign runner: CRON_SECRET is not set — skipping run')
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
