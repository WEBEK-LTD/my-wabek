import type { Config } from "@netlify/functions"

// Runs every minute to process scheduled/batched campaigns
export default async () => {
  const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const secret  = process.env.CRON_SECRET || process.env.JWT_SECRET || ''

  try {
    const r = await fetch(`${baseUrl}/api/campaigns/scheduler?secret=${secret}`)
    const data = await r.json()
    console.log('Campaign runner:', JSON.stringify(data))
  } catch (e: unknown) {
    console.error('Campaign runner error:', (e as Error).message)
  }
}

export const config: Config = {
  schedule: "* * * * *"
}
