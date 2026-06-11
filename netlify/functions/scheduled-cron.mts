import type { Config } from "@netlify/functions"

// Runs every day at midnight
export default async () => {
  const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const secret  = process.env.CRON_SECRET || process.env.JWT_SECRET || ''

  const results: Record<string, unknown> = {}

  // 1. Expire plans
  try {
    const r = await fetch(`${baseUrl}/api/cron/expire-plans?secret=${secret}`)
    results.expire_plans = await r.json()
  } catch (e: unknown) {
    results.expire_plans = { error: (e as Error).message }
  }

  // 2. Run scheduled campaigns
  try {
    const r = await fetch(`${baseUrl}/api/campaigns/scheduler?secret=${secret}`)
    results.campaigns = await r.json()
  } catch (e: unknown) {
    results.campaigns = { error: (e as Error).message }
  }

  console.log('Cron results:', JSON.stringify(results))
}

export const config: Config = {
  schedule: "@daily"
}
