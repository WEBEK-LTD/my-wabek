import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { logAction, getClientIp } from '@/lib/middleware'
import { pick } from '@/lib/security'
import { cancelStripeSubscription, upsertSubscriptionRow, LIVE_SUB_STATUSES } from '@/lib/stripe'

const SENSITIVE_USER_FIELDS = ['password_hash', 'api_key', 'api_key_hash', 'otp_secret', 'reset_token', 'reset_token_expires']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()
  const id = String(req.query.id || '')
  if (!id) return res.status(400).json({ error: 'id required' })

  if (req.method === 'GET') {
    const { data: user } = await db.from('users').select('*, plans(*)').eq('id', id).single()
    if (!user) return res.status(404).json({ error: 'User not found' })
    for (const f of SENSITIVE_USER_FIELDS) delete (user as Record<string, unknown>)[f]
    const { data: rawInstances } = await db.from('whatsapp_instances').select('*').eq('user_id', id)
    // Never ship tokens/session blobs to the browser.
    const instances = (rawInstances || []).map(i => {
      const { access_token, session_data, qr_code, webhook_secret, verify_token, ...rest } = i as Record<string, unknown>
      void access_token; void session_data; void qr_code; void webhook_secret; void verify_token
      return rest
    })
    const { count: msgCount } = await db.from('messages').select('*', { count: 'exact', head: true }).eq('user_id', id)
    const { count: contactCount } = await db.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', id)
    const { data: subscription } = await db.from('subscriptions').select('*, plans(*)').eq('user_id', id).eq('status', 'active').limit(1).maybeSingle()
    return res.status(200).json({ user, instances, subscription, stats: { messages: msgCount, contacts: contactCount } })
  }

  if (req.method === 'PUT') {
    const body = (req.body || {}) as Record<string, unknown>
    const fields = pick<Record<string, unknown>>(body, ['is_active', 'role'])
    const update: Record<string, unknown> = {}

    if ('is_active' in fields) {
      if (typeof fields.is_active !== 'boolean') return res.status(400).json({ error: 'is_active must be boolean' })
      update.is_active = fields.is_active
    }
    if ('role' in fields) {
      if (fields.role !== 'user' && fields.role !== 'admin') return res.status(400).json({ error: 'Invalid role' })
      update.role = fields.role
    }
    if (id === admin.userId && (update.is_active === false || update.role === 'user')) {
      return res.status(400).json({ error: 'You cannot suspend or demote your own account' })
    }

    const { data: current } = await db.from('users').select('id, plan_id, plan_expires_at').eq('id', id).maybeSingle()
    if (!current) return res.status(404).json({ error: 'User not found' })

    const hasPlan = Object.prototype.hasOwnProperty.call(body, 'plan_id')
    const hasExpiry = Object.prototype.hasOwnProperty.call(body, 'plan_expires_at')
    let expiresAt: string | null = null
    if (hasExpiry && body.plan_expires_at) {
      const d = new Date(String(body.plan_expires_at))
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid plan_expires_at' })
      expiresAt = d.toISOString()
    }

    let subscriptionAction: 'none' | 'assign' | 'cancel' = 'none'
    let newPlanId: string | null = null
    const notes: string[] = []

    if (hasPlan || hasExpiry) {
      const { data: liveSub } = await db.from('subscriptions')
        .select('id, plan_id, stripe_subscription_id, status')
        .eq('user_id', id)
        .not('stripe_subscription_id', 'is', null)
        .in('status', [...LIVE_SUB_STATUSES])
        .limit(1).maybeSingle()

      newPlanId = hasPlan ? ((body.plan_id === '' || body.plan_id === null) ? null : String(body.plan_id)) : current.plan_id

      if (newPlanId) {
        const { data: plan } = await db.from('plans').select('id').eq('id', newPlanId).maybeSingle()
        if (!plan) return res.status(400).json({ error: 'Plan not found' })
      }

      if (liveSub) {
        if (hasPlan && newPlanId === null) {
          // Admin removes the plan → stop the Stripe billing too.
          try {
            await cancelStripeSubscription(liveSub.stripe_subscription_id as string)
            notes.push('Stripe subscription cancelled')
          } catch (e) {
            console.error('[admin users] Stripe cancel failed:', (e as Error)?.message)
            return res.status(502).json({ error: 'Could not cancel the user\'s Stripe subscription. The plan was not changed.' })
          }
          update.plan_id = null
          update.plan_expires_at = null
          subscriptionAction = 'cancel'
        } else if (newPlanId !== current.plan_id && newPlanId !== liveSub.plan_id) {
          return res.status(409).json({ error: 'This user has an active Stripe subscription. Change the plan in Stripe, or remove the plan first (which cancels the subscription).' })
        } else {
          // Same plan: billing is managed by Stripe; leave plan and expiry as-is.
          if (hasExpiry) notes.push('Plan expiry is managed by Stripe for this user and was not changed')
        }
      } else if (hasPlan && newPlanId === null) {
        update.plan_id = null
        update.plan_expires_at = null
        subscriptionAction = 'cancel'
      } else if (newPlanId) {
        update.plan_id = newPlanId
        update.plan_expires_at = hasExpiry ? expiresAt : (newPlanId === current.plan_id ? current.plan_expires_at : null)
        subscriptionAction = 'assign'
      }
    }

    if (!Object.keys(update).length) {
      return res.status(200).json({ user: current, notes })
    }

    update.updated_at = new Date().toISOString()
    const { data, error } = await db.from('users')
      .update(update)
      .eq('id', id).select('id, email, name, role, plan_id, plan_expires_at, is_active, created_at, updated_at').single()
    if (error) {
      console.error('[admin users] update failed:', error.message)
      return res.status(500).json({ error: 'Failed to update user' })
    }

    try {
      if (subscriptionAction === 'assign' && newPlanId) {
        const expires = (update.plan_expires_at as string | null) || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        await upsertSubscriptionRow(db, {
          user_id: id,
          plan_id: newPlanId,
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: new Date().toISOString(),
          current_period_end: expires,
          cancel_at_period_end: false,
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
      } else if (subscriptionAction === 'cancel') {
        await db.from('subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('user_id', id).in('status', [...LIVE_SUB_STATUSES])
      }
    } catch (e) {
      console.error('[admin users] subscription sync failed:', (e as Error)?.message)
    }

    await logAction({
      userId: admin.userId, action: 'admin_update_user', resource: 'user', resourceId: id,
      details: { changes: update, notes }, ipAddress: getClientIp(req),
    })
    return res.status(200).json({ user: data, notes })
  }

  if (req.method === 'DELETE') {
    if (id === admin.userId) return res.status(400).json({ error: 'You cannot suspend your own account' })
    await db.from('users').update({ is_active: false }).eq('id', id)
    await logAction({ userId: admin.userId, action: 'admin_suspend_user', resource: 'user', resourceId: id, ipAddress: getClientIp(req) })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
