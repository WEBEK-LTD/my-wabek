// GET /api/admin/addons — add-on usage for the admin "Add-ons" page.
//
// Query: client=wordpress|whmcs (list filter, default all), page (1-based).
// Returns per-client active counts (7 / 30 days), versions in use (30 days),
// a paginated list of installs and the number of API keys used in 30 days.
// Works before migration 035 is applied (available: false, empty stats).
import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { isMissingDbObject, warnMissingOnce } from '@/lib/db-compat'
import { ADDON_CLIENTS, type AddonClient } from '@/lib/addon-usage'

const PAGE_SIZE = 25
const DAY = 24 * 60 * 60 * 1000

interface ClientStats {
  active7: number
  active30: number
  total: number
  versions: { version: string; count: number }[]
}

function emptyStats(): Record<AddonClient, ClientStats> {
  return Object.fromEntries(ADDON_CLIENTS.map(c => [c, { active7: 0, active30: 0, total: 0, versions: [] }])) as unknown as Record<AddonClient, ClientStats>
}

/** Numeric-aware descending version sort (4.10.0 > 4.9.2). */
function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map(n => parseInt(n, 10) || 0)
  const pb = b.split(/[.+-]/).map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pb[i] || 0) - (pa[i] || 0)
    if (d) return d
  }
  return 0
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  const clientFilter = (ADDON_CLIENTS as readonly string[]).includes(String(req.query.client)) ? String(req.query.client) as AddonClient : null
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
  const now = Date.now()
  const since30 = new Date(now - 30 * DAY).toISOString()

  // Context: API keys used by anyone (add-ons, custom code, Zapier…) in 30 days.
  let apiKeysUsed30: number | null = null
  try {
    const { count, error } = await db.from('api_keys').select('id', { count: 'exact', head: true }).gte('last_used_at', since30)
    if (!error) apiKeysUsed30 = count ?? 0
  } catch { /* context only */ }

  const stats = emptyStats()
  const base = { stats, apiKeysUsed30, page, pageSize: PAGE_SIZE }

  // Stats: every install seen in the last 30 days (small table: one row per account + add-on).
  const { data: recent, error: recentErr } = await db
    .from('addon_installs')
    .select('client, version, last_seen')
    .gte('last_seen', since30)
    .limit(20000)
  if (recentErr) {
    if (isMissingDbObject(recentErr)) {
      warnMissingOnce('addon_installs (migration 035)', recentErr)
      return res.status(200).json({ ...base, available: false, items: [], total: 0 })
    }
    console.error('[admin addons] stats query failed:', recentErr.message)
    return res.status(500).json({ error: 'Failed to load add-on usage' })
  }

  const versionCounts: Record<string, Map<string, number>> = {}
  for (const row of recent || []) {
    const c = row.client as AddonClient
    if (!stats[c]) continue
    stats[c].active30++
    if (new Date(row.last_seen).getTime() >= now - 7 * DAY) stats[c].active7++
    const m = (versionCounts[c] ||= new Map())
    m.set(row.version, (m.get(row.version) || 0) + 1)
  }
  for (const c of ADDON_CLIENTS) {
    stats[c].versions = [...(versionCounts[c]?.entries() || [])]
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => compareVersionsDesc(a.version, b.version))
    const { count } = await db.from('addon_installs').select('user_id', { count: 'exact', head: true }).eq('client', c)
    stats[c].total = count ?? 0
  }

  let list = db
    .from('addon_installs')
    .select('user_id, client, version, site, first_seen, last_seen, users(email, name)', { count: 'exact' })
    .order('last_seen', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (clientFilter) list = list.eq('client', clientFilter)
  const { data: rows, error: listErr, count: total } = await list
  if (listErr) {
    console.error('[admin addons] list query failed:', listErr.message)
    return res.status(500).json({ error: 'Failed to load add-on usage' })
  }

  const items = (rows || []).map((r: any) => {
    const u = Array.isArray(r.users) ? r.users[0] : r.users
    return {
      user_id: r.user_id,
      email: u?.email || null,
      name: u?.name || null,
      client: r.client,
      version: r.version,
      site: r.site || null,
      first_seen: r.first_seen,
      last_seen: r.last_seen,
    }
  })

  return res.status(200).json({ ...base, available: true, items, total: total ?? items.length })
}
