/**
 * Outgoing webhooks (Integrations → Outgoing Webhooks). Server-side only.
 *
 * A subscription is a `zapier_hooks` row: { user_id, event, target_url,
 * secret }. When an event happens, every active subscription of that tenant
 * for that event receives:
 *
 *   POST <target_url>
 *   Content-Type: application/json
 *   X-WABEK-Event: <event>
 *   X-WABEK-Delivery: <uuid>
 *   X-WABEK-Timestamp: <unix seconds>
 *   X-WABEK-Signature: sha256=<hex HMAC-SHA256(secret, `${timestamp}.${body}`)>
 *
 *   { "event": "...", "created_at": "<ISO>", "data": { ... } }
 *
 * Delivery is SSRF-safe (safeFetch), 5 s timeout, no redirects to private
 * hosts. A failed delivery is stored in `webhook_deliveries` and retried by
 * the scheduler cron (retryWebhookDeliveries) with backoff.
 *
 * Emitting never throws: a webhook problem must never break the caller.
 */
import { createHmac, randomBytes } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from './supabase'
import { safeFetch } from './security'

export const WEBHOOK_EVENTS = [
  'message_received',
  'message_sent',
  'message_status',
  'contact_created',
  'campaign_completed',
  'opt_out',
  'opt_in',
  'chatbot_triggered',
  'link_clicked',
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]

export function isWebhookEvent(v: unknown): v is WebhookEvent {
  return typeof v === 'string' && (WEBHOOK_EVENTS as readonly string[]).includes(v)
}

const DELIVERY_TIMEOUT_MS = 5000
const MAX_HOOKS_PER_EVENT = 20
const MAX_ATTEMPTS = 6
// Delay before attempt n+1 (n = attempts already made)
const BACKOFF_MINUTES = [1, 5, 15, 60, 180]

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`
}

export function signWebhookBody(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

interface HookRow {
  id: string
  user_id: string
  target_url: string
  secret: string | null
  trigger_count?: number | null
}

// Per-instance cache of "which events does this tenant subscribe to", so
// hot paths (every sent message) do not query the DB when nobody listens.
const subsCache = new Map<string, { events: Set<string>; exp: number }>()
const SUBS_TTL_MS = 30_000

export function invalidateWebhookCache(userId: string): void {
  subsCache.delete(userId)
}

async function subscribedEvents(userId: string): Promise<Set<string>> {
  const hit = subsCache.get(userId)
  if (hit && hit.exp > Date.now()) return hit.events
  const { data, error } = await supabaseAdmin().from('zapier_hooks')
    .select('event').eq('user_id', userId).eq('is_active', true).limit(200)
  const events = new Set<string>(error ? [] : (data || []).map(r => String(r.event)))
  subsCache.set(userId, { events, exp: Date.now() + SUBS_TTL_MS })
  if (subsCache.size > 5000) {
    const now = Date.now()
    subsCache.forEach((v, k) => { if (v.exp < now) subsCache.delete(k) })
  }
  return events
}

async function ensureSecret(hook: HookRow): Promise<string> {
  if (hook.secret) return hook.secret
  // Hooks created before signing existed: generate one now (the owner can
  // reveal it by rotating the secret in Integrations).
  const secret = generateWebhookSecret()
  await supabaseAdmin().from('zapier_hooks').update({ secret }).eq('id', hook.id).is('secret', null)
  const { data } = await supabaseAdmin().from('zapier_hooks').select('secret').eq('id', hook.id).maybeSingle()
  return String(data?.secret || secret)
}

async function deliver(hook: HookRow, event: string, deliveryId: string, body: string):
  Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const secret = await ensureSecret(hook)
    const timestamp = String(Math.floor(Date.now() / 1000))
    const r = await safeFetch(hook.target_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WABEK-Webhooks/1.0',
        'X-WABEK-Event': event,
        'X-WABEK-Delivery': deliveryId,
        'X-WABEK-Timestamp': timestamp,
        'X-WABEK-Signature': `sha256=${signWebhookBody(secret, timestamp, body)}`,
      },
      body,
      timeoutMs: DELIVERY_TIMEOUT_MS,
      maxBytes: 64 * 1024,
      httpsOnly: true,
    })
    if (r.status >= 200 && r.status < 300) return { ok: true, status: r.status }
    return { ok: false, status: r.status, error: `HTTP ${r.status}` }
  } catch (e) {
    const msg = (e as Error)?.name === 'AbortError' ? 'Timeout' : ((e as Error)?.message || 'Delivery failed')
    return { ok: false, error: msg.slice(0, 300) }
  }
}

async function recordOutcome(hook: HookRow, outcome: { ok: boolean; status?: number; error?: string }): Promise<void> {
  const db = supabaseAdmin()
  try {
    if (outcome.ok) {
      await db.from('zapier_hooks').update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: (hook.trigger_count || 0) + 1,
        last_status: outcome.status ?? null,
        last_error: null,
      }).eq('id', hook.id)
    } else {
      await db.from('zapier_hooks').update({
        last_status: outcome.status ?? null,
        last_error: outcome.error || null,
      }).eq('id', hook.id)
    }
  } catch { /* columns from 032 may be missing — non-critical */ }
}

function nextAttemptAt(attemptsMade: number): string {
  const mins = BACKOFF_MINUTES[Math.min(attemptsMade - 1, BACKOFF_MINUTES.length - 1)] || 60
  return new Date(Date.now() + mins * 60_000).toISOString()
}

/**
 * Send `event` to every active subscription of `userId`. Resolves when every
 * delivery finished (bounded by the 5 s timeout); never rejects.
 */
export async function emitWebhookEvent(userId: string | null | undefined, event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
  if (!userId) return
  try {
    const events = await subscribedEvents(userId)
    if (!events.has(event)) return

    const db = supabaseAdmin()
    const { data: hooks, error } = await db.from('zapier_hooks')
      .select('id, user_id, target_url, secret, trigger_count')
      .eq('user_id', userId).eq('event', event).eq('is_active', true)
      .limit(MAX_HOOKS_PER_EVENT)
    if (error || !hooks?.length) return

    const payload = { event, created_at: new Date().toISOString(), data }
    const body = JSON.stringify(payload)

    await Promise.allSettled((hooks as HookRow[]).map(async hook => {
      const deliveryId = uuidv4()
      const outcome = await deliver(hook, event, deliveryId, body)
      await recordOutcome(hook, outcome)
      if (!outcome.ok) {
        const { error: insErr } = await db.from('webhook_deliveries').insert({
          id: deliveryId, user_id: userId, hook_id: hook.id, event, payload,
          status: 'pending', attempts: 1,
          last_status: outcome.status ?? null, last_error: outcome.error || null,
          next_attempt_at: nextAttemptAt(1),
        })
        if (insErr) console.error('[webhooks] could not queue retry (is migration 032 applied?):', insErr.message)
      }
    }))
  } catch (e) {
    console.error('[webhooks] emit failed:', (e as Error)?.message)
  }
}

/** Send a signed test payload to one subscription (Integrations → Test). */
export async function sendTestWebhook(hookId: string, userId: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const { data: hook } = await supabaseAdmin().from('zapier_hooks')
    .select('id, user_id, target_url, secret, trigger_count, event')
    .eq('id', hookId).eq('user_id', userId).maybeSingle()
  if (!hook) return { ok: false, error: 'Webhook not found' }
  const body = JSON.stringify({
    event: hook.event,
    created_at: new Date().toISOString(),
    test: true,
    data: { from: '201234567890', name: 'Test Contact', message: 'Test message from WABEK', type: 'text' },
  })
  return deliver(hook as HookRow, String(hook.event), uuidv4(), body)
}

/** Retry due failed deliveries. Called by the scheduler cron every minute. */
export async function retryWebhookDeliveries(limit = 50): Promise<{ retried: number; delivered: number }> {
  const db = supabaseAdmin()
  const { data: due, error } = await db.from('webhook_deliveries')
    .select('id, hook_id, event, payload, attempts')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(limit)
  if (error || !due?.length) return { retried: 0, delivered: 0 }

  // Claim the batch so an overlapping cron run does not pick it up too
  await db.from('webhook_deliveries')
    .update({ next_attempt_at: new Date(Date.now() + 2 * 60_000).toISOString() })
    .in('id', due.map(r => r.id)).eq('status', 'pending')

  let delivered = 0
  await Promise.allSettled(due.map(async row => {
    const { data: hook } = await db.from('zapier_hooks')
      .select('id, user_id, target_url, secret, trigger_count, is_active')
      .eq('id', row.hook_id).maybeSingle()
    if (!hook || hook.is_active === false) {
      await db.from('webhook_deliveries').update({ status: 'failed', last_error: 'Webhook removed or disabled' }).eq('id', row.id)
      return
    }
    const outcome = await deliver(hook as HookRow, String(row.event), String(row.id), JSON.stringify(row.payload))
    await recordOutcome(hook as HookRow, outcome)
    const attempts = (row.attempts || 1) + 1
    if (outcome.ok) {
      delivered++
      await db.from('webhook_deliveries').update({
        status: 'delivered', attempts, last_status: outcome.status ?? null, last_error: null,
        delivered_at: new Date().toISOString(),
      }).eq('id', row.id)
    } else {
      await db.from('webhook_deliveries').update({
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        attempts, last_status: outcome.status ?? null, last_error: outcome.error || null,
        next_attempt_at: nextAttemptAt(attempts),
      }).eq('id', row.id)
    }
  }))
  return { retried: due.length, delivered }
}
