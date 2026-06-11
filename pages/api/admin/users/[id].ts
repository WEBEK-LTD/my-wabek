import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { logAction, getClientIp } from '@/lib/middleware'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'GET') {
    const { data: user } = await db.from('users').select('*, plans(*)').eq('id', id as string).single()
    if (!user) return res.status(404).json({ error: 'User not found' })
    const { data: instances } = await db.from('whatsapp_instances').select('*').eq('user_id', id as string)
    const { count: msgCount } = await db.from('messages').select('*', { count: 'exact', head: true }).eq('user_id', id as string)
    const { count: contactCount } = await db.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', id as string)
    const { data: subscription } = await db.from('subscriptions').select('*, plans(*)').eq('user_id', id as string).eq('status', 'active').single()
    return res.status(200).json({ user, instances, subscription, stats: { messages: msgCount, contacts: contactCount } })
  }

  if (req.method === 'PUT') {
    const { is_active, role, plan_expires_at } = req.body
    // Treat empty string as null for UUID fields
    const plan_id = req.body.plan_id === '' ? null : (req.body.plan_id || null)

    const updateData: Record<string, unknown> = {
      is_active, role, updated_at: new Date().toISOString(),
      plan_id,
      plan_expires_at: plan_id ? (plan_expires_at || null) : null,
    }

    const { data, error } = await db.from('users')
      .update(updateData)
      .eq('id', id as string).select().single()
    if (error) return res.status(500).json({ error: error.message })

    if (plan_id) {
      // Assign plan — upsert subscription
      const expires = plan_expires_at || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      await db.from('subscriptions').upsert({
        id: uuidv4(),
        user_id: id as string,
        plan_id,
        status: 'active',
        billing_cycle: 'monthly',
        current_period_start: new Date().toISOString(),
        current_period_end: expires,
        cancel_at_period_end: false,
        stripe_subscription_id: null,
      }, { onConflict: 'user_id' })
    } else {
      // No plan — cancel any active subscription
      await db.from('subscriptions').update({ status: 'cancelled' })
        .eq('user_id', id as string).eq('status', 'active')
    }

    await logAction({ userId: admin.userId, action: 'admin_update_user', resource: 'user', resourceId: id as string, ipAddress: getClientIp(req) })
    return res.status(200).json({ user: data })
  }

  if (req.method === 'DELETE') {
    await db.from('users').update({ is_active: false }).eq('id', id as string)
    await logAction({ userId: admin.userId, action: 'admin_suspend_user', resource: 'user', resourceId: id as string, ipAddress: getClientIp(req) })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
