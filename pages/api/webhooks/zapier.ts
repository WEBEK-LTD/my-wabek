import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isMissingDbObject } from '@/lib/db-compat'
import { assertPublicUrl } from '@/lib/security'
import {
  WEBHOOK_EVENTS, isWebhookEvent, generateWebhookSecret, invalidateWebhookCache, sendTestWebhook,
} from '@/lib/outgoing-webhooks'
import { v4 as uuidv4 } from 'uuid'

// Outgoing webhook subscriptions (Integrations page).
//   GET                         → list (never includes the secret)
//   POST {target_url,event,label}         → create; returns `secret` ONCE
//   POST {action:'test', id}              → send a signed test payload
//   POST {action:'rotate_secret', id}     → new secret, returned ONCE
//   DELETE ?id=
const PUBLIC_FIELDS = 'id, user_id, target_url, event, label, is_active, last_triggered_at, trigger_count, created_at'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'integrations')
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    let migrated = true
    let { data, error } = await db.from('zapier_hooks').select(`${PUBLIC_FIELDS}, last_status, last_error, failure_count`)
      .eq('user_id', user.userId).order('created_at', { ascending: false })
    if (error) {
      // Migration 032 not applied yet
      migrated = false
      ;({ data } = await db.from('zapier_hooks').select(PUBLIC_FIELDS)
        .eq('user_id', user.userId).order('created_at', { ascending: false }) as any)
    }
    let hooks: Record<string, unknown>[] = (data || []) as Record<string, unknown>[]
    if (migrated && hooks.length) {
      // Delivery queue per hook (webhook_deliveries, migration 032): head counts only.
      const count = async (hookId: string, status: 'pending' | 'failed') => {
        const { count: n, error: e } = await db.from('webhook_deliveries').select('id', { count: 'exact', head: true })
          .eq('user_id', user.userId).eq('hook_id', hookId).eq('status', status)
        return e ? null : (n || 0)
      }
      hooks = await Promise.all(hooks.slice(0, 100).map(async h => {
        const [pending, failed] = await Promise.all([count(String(h.id), 'pending'), count(String(h.id), 'failed')])
        return { ...h, pending_deliveries: pending, failed_deliveries: failed }
      }))
    }
    return res.status(200).json({ hooks, events: WEBHOOK_EVENTS })
  }

  if (req.method === 'POST') {
    const { action, id } = req.body || {}

    if (action === 'test' || action === 'rotate_secret') {
      if (typeof id !== 'string' || !id) return res.status(400).json({ error: 'id required' })
      if (action === 'test') {
        const r = await sendTestWebhook(id, user.userId)
        if (!r.ok) return res.status(502).json({ success: false, error: r.error || 'Delivery failed', status: r.status })
        return res.status(200).json({ success: true, status: r.status })
      }
      const secret = generateWebhookSecret()
      const { data, error } = await db.from('zapier_hooks').update({ secret })
        .eq('id', id).eq('user_id', user.userId).select('id').maybeSingle()
      if (error) return res.status(500).json({ error: 'Failed to rotate secret' })
      if (!data) return res.status(404).json({ error: 'Webhook not found' })
      return res.status(200).json({ success: true, secret })
    }

    const { target_url, event, label } = req.body || {}
    if (!target_url || !event || typeof target_url !== 'string' || typeof event !== 'string') {
      return res.status(400).json({ error: 'target_url and event required' })
    }
    if (!isWebhookEvent(event)) {
      return res.status(400).json({ error: `Unknown event. Supported: ${WEBHOOK_EVENTS.join(', ')}` })
    }
    // SSRF guard: public https endpoints only (re-checked on every delivery)
    try {
      await assertPublicUrl(target_url, { httpsOnly: true })
    } catch {
      return res.status(400).json({ error: 'target_url must be a public https URL' })
    }
    const secret = generateWebhookSecret()
    const row = {
      id: uuidv4(), user_id: user.userId, target_url, event,
      label: typeof label === 'string' ? label.slice(0, 100) : '', is_active: true,
      created_at: new Date().toISOString(),
    }
    let { data, error } = await db.from('zapier_hooks').insert({ ...row, secret }).select(PUBLIC_FIELDS).single()
    let signed = true
    if (error && (isMissingDbObject(error) || /secret/i.test(error.message || ''))) {
      // Migration 032 not applied yet: hook works, unsigned until it is.
      ;({ data, error } = await db.from('zapier_hooks').insert(row).select(PUBLIC_FIELDS).single())
      signed = false
    }
    if (error) return res.status(500).json({ error: 'Failed to save hook' })
    invalidateWebhookCache(user.userId)
    return res.status(201).json({ hook: data, ...(signed ? { secret } : {}) })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    await db.from('zapier_hooks').delete().eq('id', id as string).eq('user_id', user.userId)
    invalidateWebhookCache(user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
