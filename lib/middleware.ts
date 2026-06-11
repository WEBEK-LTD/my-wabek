import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from './supabase'

// ── Rate Limiter ──────────────────────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

interface RateLimitConfig { maxRequests: number; windowMs: number }

export function rateLimit(config: RateLimitConfig) {
  return (req: NextApiRequest, res: NextApiResponse): boolean => {
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || 'unknown'
    const key = `${ip}:${req.url}`
    const now = Date.now()
    const existing = rateLimitStore.get(key)
    if (!existing || existing.resetAt < now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs })
      return true
    }
    if (existing.count >= config.maxRequests) {
      res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil((existing.resetAt - now) / 1000) })
      return false
    }
    existing.count++
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
export function getClientIp(req: NextApiRequest): string {
  return req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || 'unknown'
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
//    0  → not set   (always allow)
//   >0  → hard limit (count and compare)
//   no plan_id → allow (don't block users without a plan)
export async function checkPlanLimit(
  userId: string,
  type: 'messages' | 'contacts' | 'instances' | 'campaigns'
): Promise<{ allowed: boolean; limit: number; current: number }> {

  const ALLOW = (limit = -1, current = 0) => ({ allowed: true,  limit, current })
  const BLOCK = (limit = 0,  current = 0) => ({ allowed: false, limit, current })

  try {
    const db = supabaseAdmin()

    // 1. Get user
    const { data: user } = await db
      .from('users')
      .select('plan_id, plan_expires_at, trial_ends_at')
      .eq('id', userId)
      .maybeSingle()

    // No user found → allow (don't block)
    if (!user) return ALLOW()

    // No plan → allow
    if (!user.plan_id) return ALLOW()

    // Plan expired → block
    if (user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) return BLOCK()

    // Trial expired → block
    if (user.trial_ends_at && new Date(user.trial_ends_at) < new Date()) return BLOCK()

    // 2. Get plan
    const { data: plan } = await db
      .from('plans')
      .select('max_messages_month, max_contacts, max_instances, max_campaigns')
      .eq('id', user.plan_id)
      .maybeSingle()

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
    }

    const limit = limitMap[type] ?? -1

    // -1 or 0 → unlimited
    if (limit <= 0) return ALLOW(limit)

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
      current = count ?? 0

    } else if (type === 'contacts') {
      const { count } = await db.from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      current = count ?? 0

    } else if (type === 'instances') {
      const { count } = await db.from('whatsapp_instances')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      current = count ?? 0

    } else if (type === 'campaigns') {
      const { count } = await db.from('campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', monthStart)
      current = count ?? 0
    }

    // 5. Compare
    if (current >= limit) return BLOCK(limit, current)
    return ALLOW(limit, current)

  } catch (err) {
    // On any error → allow (never block due to infrastructure issues)
    console.error('[checkPlanLimit] error — allowing by default:', err)
    return ALLOW()
  }
}

// ── Plan Feature Check ────────────────────────────────────────────────────────
export async function checkPlanFeature(
  userId: string,
  feature: 'allow_api_access' | 'allow_chatbot' | 'allow_automation' | 'allow_analytics' |
           'allow_white_label' | 'allow_sub_accounts' | 'allow_reseller' | 'allow_gift_invites'
): Promise<boolean> {
  try {
    const db = supabaseAdmin()
    const { data: user } = await db.from('users').select('plan_id').eq('id', userId).maybeSingle()
    if (!user?.plan_id) return true // no plan = allow all features
    const { data: plan } = await db.from('plans').select(feature).eq('id', user.plan_id).maybeSingle()
    if (!plan) return true
    return (plan as Record<string, unknown>)[feature] !== false
  } catch {
    return true // on error → allow
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
