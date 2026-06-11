import { supabaseAdmin } from './supabase'

let cache: Record<string, unknown> = {}
let cacheTime = 0
const CACHE_TTL = 60 * 1000 // 1 minute

export async function getSetting(key: string, defaultValue: unknown = null): Promise<unknown> {
  const now = Date.now()
  if (now - cacheTime > CACHE_TTL) {
    try {
      const db = supabaseAdmin()
      const { data } = await db.from('system_settings').select('key, value')
      cache = {}
      for (const row of data || []) {
        try { cache[row.key] = JSON.parse(row.value) } catch { cache[row.key] = row.value }
      }
      cacheTime = now
    } catch { return defaultValue }
  }
  return key in cache ? cache[key] : defaultValue
}

export async function getSettings(keys: string[]): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {}
  for (const key of keys) result[key] = await getSetting(key)
  return result
}
