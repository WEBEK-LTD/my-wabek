import type { Config } from "@netlify/functions"

// Runs every day at midnight (UTC).
// Auth: `x-cron-secret` header with CRON_SECRET (never a query string, never JWT_SECRET).
export default async () => {
  const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const secret  = process.env.CRON_SECRET
  if (!secret) {
    console.error('Daily cron: CRON_SECRET is not set — skipping run')
    return
  }
  const headers = { 'x-cron-secret': secret }

  const results: Record<string, unknown> = {}

  // 1. Expire plans (+ monthly AI counter reset)
  try {
    const r = await fetch(`${baseUrl}/api/cron/expire-plans`, { method: 'POST', headers })
    results.expire_plans = { status: r.status, ...(await r.json().catch(() => ({}))) }
  } catch (e: unknown) {
    results.expire_plans = { error: (e as Error).message }
  }

  // 2. Run scheduled campaigns
  try {
    const r = await fetch(`${baseUrl}/api/campaigns/scheduler`, { method: 'POST', headers })
    results.campaigns = { status: r.status, ...(await r.json().catch(() => ({}))) }
  } catch (e: unknown) {
    results.campaigns = { error: (e as Error).message }
  }

  console.log('Cron results:', JSON.stringify(results))
}

export const config: Config = {
  schedule: "@daily"
}
