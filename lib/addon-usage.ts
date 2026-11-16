// Add-on usage tracking (server-side only).
//
// The WordPress/WooCommerce plugin and the WHMCS addon send
//   X-WABEK-Client: wordpress/<version> | whmcs/<version>
//   X-WABEK-Site:   <host of the store / WHMCS install>   (optional)
// on every API call. After a successful API-key authentication we record the
// latest version and last_seen per account + client in `addon_installs`
// (migration 035) — at most once per hour per account + client (in-memory
// throttle in front of the DB), fire-and-forget so the request never waits,
// and silently skipped while the table does not exist yet.

import type { NextApiRequest } from 'next'
import { supabaseAdmin } from './supabase'
import { isMissingDbObject, warnMissingOnce } from './db-compat'

export const ADDON_CLIENTS = ['wordpress', 'whmcs'] as const
export type AddonClient = typeof ADDON_CLIENTS[number]

const THROTTLE_MS = 60 * 60 * 1000
const MAX_TRACKED = 10_000
const _lastWrite = new Map<string, { at: number; version: string; site: string | null }>()
let _tableMissing = false

/** Parses `wordpress/1.1.1` → { client, version }; null for anything else. */
export function parseClientHeader(value: unknown): { client: AddonClient; version: string } | null {
  if (typeof value !== 'string') return null
  const m = value.trim().match(/^([a-z]+)\/(\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]{1,20})?)$/i)
  if (!m) return null
  const client = m[1].toLowerCase()
  if (!(ADDON_CLIENTS as readonly string[]).includes(client)) return null
  return { client: client as AddonClient, version: m[2].slice(0, 32) }
}

/** Host name from X-WABEK-Site (lower-cased, validated); null when absent/invalid. */
export function parseSiteHeader(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const host = value.trim().toLowerCase()
  return /^[a-z0-9]([a-z0-9-]{0,62}\.)*[a-z0-9-]{1,63}$/.test(host) && host.length <= 253 ? host : null
}

/**
 * Record the add-on that made this request (no-op for other clients).
 * Never throws and never blocks: the DB write is not awaited.
 */
export function noteAddonClient(req: NextApiRequest, userId: string): void {
  try {
    if (_tableMissing || !userId) return
    const parsed = parseClientHeader(req.headers['x-wabek-client'])
    if (!parsed) return
    const site = parseSiteHeader(req.headers['x-wabek-site'])
    const key = `${userId}:${parsed.client}`
    const now = Date.now()
    const prev = _lastWrite.get(key)
    // Within the hour: write again only when the version or site changed.
    if (prev && now - prev.at < THROTTLE_MS && prev.version === parsed.version && (!site || prev.site === site)) return

    if (_lastWrite.size >= MAX_TRACKED) _lastWrite.clear()
    _lastWrite.set(key, { at: now, version: parsed.version, site: site ?? prev?.site ?? null })

    const row: Record<string, string> = {
      user_id: userId,
      client: parsed.client,
      version: parsed.version,
      last_seen: new Date(now).toISOString(),
    }
    if (site) row.site = site // keep the stored site when the header is missing

    supabaseAdmin()
      .from('addon_installs')
      .upsert(row, { onConflict: 'user_id,client' })
      .then(({ error }) => {
        if (!error) return
        if (isMissingDbObject(error)) {
          _tableMissing = true
          warnMissingOnce('addon_installs (migration 035)', error)
        } else {
          _lastWrite.delete(key) // retry on the next call
          console.warn('[addon-usage] upsert failed:', error.message)
        }
      }, () => { _lastWrite.delete(key) })
  } catch {
    /* tracking must never break an API call */
  }
}
