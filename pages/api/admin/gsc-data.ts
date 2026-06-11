import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const GSC_KEY = 'gsc_oauth'

async function getAccessToken(db: any): Promise<string | null> {
  const { data } = await db.from('system_settings').select('value').eq('key', GSC_KEY).maybeSingle()
  const oauth = data?.value as any
  if (!oauth?.access_token) return null

  // Check if expired (with 5 min buffer)
  if (oauth.expires_at && Date.now() > oauth.expires_at - 300000) {
    // Try to refresh
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret || !oauth.refresh_token) return null

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: oauth.refresh_token,
          grant_type: 'refresh_token',
        }),
      })
      const tokens = await tokenRes.json()
      if (tokens.access_token) {
        const updated = {
          ...oauth,
          access_token: tokens.access_token,
          expires_at: Date.now() + ((tokens.expires_in || 3600) * 1000),
        }
        await db.from('system_settings').upsert({ key: GSC_KEY, value: updated }, { onConflict: 'key' })
        return tokens.access_token
      }
    } catch {}
    return null
  }

  return oauth.access_token
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const db = supabaseAdmin()
  const token = await getAccessToken(db)
  if (!token) return res.status(401).json({ error: 'Not connected to Google Search Console', connected: false })

  const { type, siteUrl, startDate, endDate } = req.query
  const site = String(siteUrl || 'https://waabek.com/')
  const start = String(startDate || new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0])
  const end = String(endDate || new Date().toISOString().split('T')[0])

  try {
    // GET /sites list
    if (type === 'sites') {
      const r = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = await r.json()
      return res.status(200).json({ sites: d.siteEntry || [] })
    }

    // GET search analytics - queries
    if (type === 'queries') {
      const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          dimensions: ['query'],
          rowLimit: 25,
          startRow: 0,
        }),
      })
      const d = await r.json()
      if (d.error) return res.status(400).json({ error: d.error.message })
      const rows = (d.rows || []).map((row: any) => ({
        query: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: parseFloat((row.ctr * 100).toFixed(1)),
        position: parseFloat(row.position.toFixed(1)),
      }))
      return res.status(200).json({ rows, connected: true })
    }

    // GET search analytics - pages
    if (type === 'pages') {
      const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          dimensions: ['page'],
          rowLimit: 15,
        }),
      })
      const d = await r.json()
      if (d.error) return res.status(400).json({ error: d.error.message })
      const rows = (d.rows || []).map((row: any) => ({
        page: row.keys[0].replace(site, '/'),
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: parseFloat((row.ctr * 100).toFixed(1)),
        position: parseFloat(row.position.toFixed(1)),
      }))
      return res.status(200).json({ rows, connected: true })
    }

    // GET summary totals
    if (type === 'summary') {
      const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start, endDate: end, dimensions: ['date'], rowLimit: 90 }),
      })
      const d = await r.json()
      if (d.error) return res.status(400).json({ error: d.error.message })
      const rows = d.rows || []
      const totals = {
        clicks: rows.reduce((s: number, r: any) => s + r.clicks, 0),
        impressions: rows.reduce((s: number, r: any) => s + r.impressions, 0),
        ctr: rows.length ? parseFloat((rows.reduce((s: number, r: any) => s + r.ctr, 0) / rows.length * 100).toFixed(1)) : 0,
        position: rows.length ? parseFloat((rows.reduce((s: number, r: any) => s + r.position, 0) / rows.length).toFixed(1)) : 0,
        chart: rows.map((r: any) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
      }
      return res.status(200).json({ ...totals, connected: true })
    }

    return res.status(400).json({ error: 'Invalid type' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
