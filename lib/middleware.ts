import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from './supabase'
import { isMissingDbObject, warnMissingOnce } from './db-compat'

// ── Rate Limiter ──────────────────────────────────────────────────────────────
// Serverless-safe: Upstash Redis REST (if configured) → Supabase
// `rate_limit_hit()` (migration 027) → per-instance in-memory map as a last
// resort (also used if the shared stores are unreachable).
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

interface RateLimitConfig { maxRequests: number; windowMs: number }

function memoryHit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const existing = rateLimitStore.get(key)
  if (!existing || existing.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    if (rateLimitStore.size > 10000) {
      rateLimitStore.forEach((v, k) => { if (v.resetAt < now) rateLimitStore.delete(k) })
    }
    return true
  }
  existing.count++
  return existing.count <= max
}

async function upstashHit(key: string, max: number, windowSec: number): Promise<boolean | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2000)
    const r = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSec), 'NX'],
      ]),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t))
    if (!r.ok) return null
    const out = await r.json() as { result?: unknown; error?: string }[]
    const count = Number(out?.[0]?.result)
    if (!Number.isFinite(count)) return null
    return count <= max
  } catch {
    return null
  }
}

// When rate_limit_hit() / rate_limits (migration 027) do not exist yet, skip
// the DB for a while instead of paying a failing round trip on every request.
let _rlDbMissingUntil = 0

async function supabaseHit(key: string, max: number, windowSec: number): Promise<boolean | null> {
  if (_rlDbMissingUntil > Date.now()) return null
  try {
    const { data, error } = await supabaseAdmin().rpc('rate_limit_hit', {
      p_key: key, p_max: max, p_window_seconds: windowSec,
    })
    if (error) {
      if (isMissingDbObject(error)) {
        warnMissingOnce('rate_limit_hit()', error)
        _rlDbMissingUntil = Date.now() + 5 * 60 * 1000
      }
      return null
    }
    if (typeof data !== 'boolean') return null
    return data
  } catch {
    return null
  }
}

/** Count one hit against `key`. Returns true while the caller is within the limit. */
export async function hitRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const k = `rl:${key}`.slice(0, 512)
  const win = Math.max(1, Math.round(windowSeconds))
  const viaUpstash = await upstashHit(k, max, win)
  if (viaUpstash !== null) return viaUpstash
  const viaDb = await supabaseHit(k, max, win)
  if (viaDb !== null) return viaDb
  return memoryHit(k, max, win * 1000)
}

function routeKey(req: NextApiRequest): string {
  return (req.url || '').split('?')[0].split('#')[0]
}

/** Async, shared-store rate limiter keyed by client IP + route path (no query string). */
export function rateLimitAsync(config: RateLimitConfig) {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<boolean> => {
    const windowSec = Math.ceil(config.windowMs / 1000)
    const ok = await hitRateLimit(`${getClientIp(req)}:${routeKey(req)}`, config.maxRequests, windowSec)
    if (!ok) {
      res.setHeader('Retry-After', String(windowSec))
      res.status(429).json({ error: 'Too many requests', retryAfter: windowSec })
      return false
    }
    return true
  }
}

/**
 * Async limiter keyed by an explicit identity (e.g. the API key id) instead
 * of the client IP. Sets `Retry-After` and returns 429 with code `rate_limited`.
 */
export async function rateLimitByKey(
  res: NextApiResponse,
  key: string,
  config: RateLimitConfig
): Promise<boolean> {
  const windowSec = Math.ceil(config.windowMs / 1000)
  const ok = await hitRateLimit(key, config.maxRequests, windowSec)
  if (!ok) {
    res.setHeader('Retry-After', String(windowSec))
    res.status(429).json({ error: 'Too many requests', code: 'rate_limited', retryAfter: windowSec })
    return false
  }
  return true
}

export const authRateLimitAsync = rateLimitAsync({ maxRequests: 10, windowMs: 60 * 1000 })
export const apiRateLimitAsync  = rateLimitAsync({ maxRequests: 100, windowMs: 60 * 1000 })

/**
 * Legacy synchronous limiter (in-memory, per serverless instance). Kept for
 * call sites that have not moved to `rateLimitAsync` yet.
 */
export function rateLimit(config: RateLimitConfig) {
  return (req: NextApiRequest, res: NextApiResponse): boolean => {
    const key = `${getClientIp(req)}:${routeKey(req)}`
    if (!memoryHit(key, config.maxRequests, config.windowMs)) {
      const existing = rateLimitStore.get(key)
      const retryAfter = Math.max(1, Math.ceil(((existing?.resetAt || Date.now()) - Date.now()) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      res.status(429).json({ error: 'Too many requests', retryAfter })
      return false
    }
    return true
  }
}

export const authRateLimit = rateLimit({ maxRequests: 10, windowMs: 60 * 1000 })
export const apiRateLimit  = rateLimit({ maxRequests: 100, windowMs: 60 * 1000 })

// ── Logging ───────────────────────────────────────────────────────────────────
export async function logAction(params: {
  userId?: string; action: string; resource?: string
  resourceId?: string; details?: Record<string, unknown>; ipAddress?: string
}) {
  try {
    await supabaseAdmin().from('system_logs').insert({
      user_id:     params.userId    || null,
      action:      params.action,
      resource:    params.resource  || null,
      resource_id: params.resourceId || null,
      details:     params.details   || null,
      ip_address:  params.ipAddress || null,
    })
  } catch { /* non-critical */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// Netlify sets x-nf-client-connection-ip itself (not client-controllable);
// otherwise use the first x-forwarded-for entry, then the socket address.
export function getClientIp(req: NextApiRequest): string {
  const nf = req.headers['x-nf-client-connection-ip']
  if (typeof nf === 'string' && nf.trim()) return nf.trim()
  const xff = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
  return xff || req.socket?.remoteAddress || 'unknown'
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
  }
}

export function handleCors(req: NextApiRequest, res: NextApiResponse): boolean {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') { res.status(200).end(); return true }
  return false
}

// ── Plan Limit Check ──────────────────────────────────────────────────────────
// Rules:
//   -1  → unlimited (always allow)
//    0  → not set = unlimited (default); PLAN_LIMIT_ZERO=none → none allowed
//         (sub_accounts: 0 → unlimited only if plan.allow_sub_accounts)
//   >0  → hard limit (count and compare)
//   no plan_id → allow (don't block users without a plan)
export async function checkPlanLimit(
  userId: string,
  type: 'messages' | 'contacts' | 'instances' | 'campaigns' | 'sub_accounts'
): Promise<{ allowed: boolean; limit: number; current: number }> {

  const ALLOW = (limit = -1, current = 0) => ({ allowed: true,  limit, current })
  const BLOCK = (limit = 0,  current = 0) => ({ allowed: false, limit, current })

  try {
    const db = supabaseAdmin()

    // 1. Get user
    const { data: user, error: userErr } = await db
      .from('users')
      .select('plan_id, plan_expires_at, trial_ends_at')
      .eq('id', userId)
      .maybeSingle()
    if (userErr) throw userErr

    // No user found → allow (don't block)
    if (!user) return ALLOW()

    let planId = user.plan_id

    // Plan expired / trial expired → fall back to Free plan's limits
    // (not a hard block — Free plan limits apply instead)
    const expired =
      (user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) ||
      (user.trial_ends_at && new Date(user.trial_ends_at) < new Date())

    // No plan assigned, or expired → use Free plan's limits.
    // IMPORTANT: previously this returned ALLOW() (unlimited) — meaning Wix
    // users with no plan_id (e.g. before any purchase webhook) had NO
    // campaign limit at all.
    if (!planId || expired) {
      const { data: freePlans, error: freeErr } = await db.from('plans').select('id').ilike('name', 'free').order('id')
      if (freeErr) throw freeErr
      const freePlan = freePlans?.[0]
      if (!freePlan) return ALLOW() // no Free plan configured → don't block
      planId = freePlan.id
    }

    // 2. Get plan
    const { data: plan, error: planErr } = await db
      .from('plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle()
    if (planErr) throw planErr

    // Plan not found → allow
    if (!plan) return ALLOW()

    // 3. Parse limit value — always convert to integer
    const toInt = (v: unknown): number => {
      const n = parseInt(String(v ?? '-1'), 10)
      return isNaN(n) ? -1 : n
    }

    const limitMap: Record<string, number> = {
      messages:  toInt(plan.max_messages_month),
      contacts:  toInt(plan.max_contacts),
      instances: toInt(plan.max_instances),
      campaigns: toInt(plan.max_campaigns),
      sub_accounts: toInt(plan.max_sub_accounts ?? -1),
    }

    const limit = limitMap[type] ?? -1

    // -1 (or any negative) → unlimited.
    //  0 → by default the PREVIOUS reading: "not set" = unlimited, so no
    //      existing customer is cut off when this code ships. Set
    //      PLAN_LIMIT_ZERO=none to make 0 mean "none allowed" (how the Free
    //      plan is meant to block a feature: migration 018 sets
    //      max_campaigns = 0). Sub-accounts keep their own rule regardless:
    //      0 + allow_sub_accounts = true → unlimited, otherwise none.
    if (limit < 0) return ALLOW(limit)
    if (limit === 0) {
      if (type === 'sub_accounts') return plan.allow_sub_accounts === true ? ALLOW(-1) : BLOCK(0, 0)
      if (process.env.PLAN_LIMIT_ZERO === 'none') return BLOCK(0, 0)
      return ALLOW(limit)
    }

    // 4. Count current usage
    const now        = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    let current = 0

    if (type === 'messages') {
      const { count } = await db.from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('direction', 'outbound')
        .gte('created_at', monthStart)
      if (count === null) throw new Error('message count unavailable')
      current = count

    } else if (type === 'contacts') {
      const { count } = await db.from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (count === null) throw new Error('contact count unavailable')
      current = count

    } else if (type === 'instances') {
      const { count } = await db.from('whatsapp_instances')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (count === null) throw new Error('instance count unavailable')
      current = count

    } else if (type === 'sub_accounts') {
      const { count } = await db.from('sub_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
      if (count === null) throw new Error('sub-account count unavailable')
      current = count

    } else if (type === 'campaigns') {
      const { count } = await db.from('campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', monthStart)
      if (count === null) throw new Error('campaign count unavailable')
      current = count
    }

    // 5. Compare
    if (current >= limit) return BLOCK(limit, current)
    return ALLOW(limit, current)

  } catch (err) {
    // Fail CLOSED: an infrastructure error must not grant unlimited usage.
    console.error('[checkPlanLimit] error — blocking:', err)
    return BLOCK()
  }
}

/** Standard 403 body when the plan's max_contacts is reached. */
export function contactLimitError(limit: number) {
  return {
    error: limit > 0
      ? `Contact limit reached: your plan allows ${limit} contacts. Upgrade your plan to add more.`
      : 'Contact limit reached for your plan.',
    code: 'plan_limit',
    upgrade_required: true,
    limit,
  }
}

// ── Plan Feature Check ────────────────────────────────────────────────────────
// IMPORTANT: Users with no plan_id (e.g. Wix installs before any purchase
// webhook has fired) are treated as being on the FREE plan's feature set —
// NOT "allow everything". Previously `!user.plan_id` short-circuited to
// `return true`, which let Wix free-tier users access every premium feature
// (Chatbot Builder, Automations, AI Agents, Campaigns) with no plan assigned.
export async function checkPlanFeature(
  userId: string,
  feature: 'allow_api_access' | 'allow_chatbot' | 'allow_automation' | 'allow_ai' | 'allow_analytics' |
           'allow_white_label' | 'allow_sub_accounts' | 'allow_reseller' | 'allow_gift_invites'
): Promise<boolean> {
  try {
    const db = supabaseAdmin()
    const { data: user, error: userErr } = await db.from('users').select('plan_id, plan_expires_at').eq('id', userId).maybeSingle()
    if (userErr) throw userErr

    let planId = user?.plan_id

    // Plan expired → fall back to Free plan's restrictions
    const expired = user?.plan_expires_at && new Date(user.plan_expires_at) < new Date()

    if (!planId || expired) {
      const { data: freePlans, error: freeErr } = await db.from('plans').select('id').ilike('name', 'free').order('id')
      if (freeErr) throw freeErr
      const freePlan = freePlans?.[0]
      if (!freePlan) return true // no Free plan configured → don't block
      planId = freePlan.id
    }

    const { data: plan, error: planErr } = await db.from('plans').select(feature).eq('id', planId).maybeSingle()
    if (planErr) throw planErr
    if (!plan) return true
    return (plan as Record<string, unknown>)[feature] !== false
  } catch (err) {
    console.error('[checkPlanFeature] error — denying:', err)
    return false // fail closed
  }
}

// ── Get Full Plan ─────────────────────────────────────────────────────────────
export async function getUserPlan(userId: string): Promise<Record<string, unknown> | null> {
  try {
    const db = supabaseAdmin()
    const { data: user } = await db.from('users').select('plan_id, plan_expires_at').eq('id', userId).maybeSingle()
    if (!user?.plan_id) return null
    if (user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) return null
    const { data: plan } = await db.from('plans').select('*').eq('id', user.plan_id).maybeSingle()
    return plan
  } catch {
    return null
  }
}
