// One-time, expiring OAuth state for Meta Embedded Signup. Server-side only.
// Stored in system_settings under `meta_oauth_<random>` (same key format as
// before, so states created just before a deploy still resolve).

import { randomBytes } from 'crypto'
import { supabaseAdmin } from './supabase'

export const META_OAUTH_STATE_TTL_MS = 30 * 60 * 1000

export interface MetaOAuthState {
  userId: string
  /** 'wix' states come from a verified Wix instance (no WABEK cookie in the Wix iframe). */
  source?: 'dashboard' | 'wix'
  wixInstance?: string
  phoneNumberId?: string
  wabaId?: string
  created_at: string
}

export async function createMetaOAuthState(value: Omit<MetaOAuthState, 'created_at'>): Promise<string> {
  const state = randomBytes(24).toString('hex')
  await supabaseAdmin().from('system_settings').upsert({
    key: `meta_oauth_${state}`,
    value: { ...value, created_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })
  return state
}

function validKey(state: unknown): state is string {
  return typeof state === 'string' && /^[A-Za-z0-9-]{16,100}$/.test(state)
}

/** Read a state without consuming it (for the Embedded Signup PUT). Null if missing/expired/not owned. */
export async function readMetaOAuthState(state: unknown, ownerUserId?: string): Promise<MetaOAuthState | null> {
  if (!validKey(state)) return null
  const { data } = await supabaseAdmin().from('system_settings').select('value').eq('key', `meta_oauth_${state}`).maybeSingle()
  const v = data?.value as MetaOAuthState | undefined
  if (!v?.userId) return null
  if (!v.created_at || Date.now() - new Date(v.created_at).getTime() > META_OAUTH_STATE_TTL_MS) return null
  if (ownerUserId && v.userId !== ownerUserId) return null
  return v
}

export async function updateMetaOAuthState(state: string, patch: Partial<MetaOAuthState>): Promise<void> {
  const current = await readMetaOAuthState(state)
  if (!current) return
  await supabaseAdmin().from('system_settings')
    .update({ value: { ...current, ...patch, userId: current.userId, created_at: current.created_at }, updated_at: new Date().toISOString() })
    .eq('key', `meta_oauth_${state}`)
}

/** Read AND delete (one-time use). Null if missing, expired or not owned by `ownerUserId`. */
export async function consumeMetaOAuthState(state: unknown, ownerUserId?: string): Promise<MetaOAuthState | null> {
  if (!validKey(state)) return null
  const db = supabaseAdmin()
  const { data } = await db.from('system_settings').delete().eq('key', `meta_oauth_${state}`).select('value')
  const v = data?.[0]?.value as MetaOAuthState | undefined
  if (!v?.userId) return null
  if (!v.created_at || Date.now() - new Date(v.created_at).getTime() > META_OAUTH_STATE_TTL_MS) return null
  if (ownerUserId && v.userId !== ownerUserId) return null
  return v
}
