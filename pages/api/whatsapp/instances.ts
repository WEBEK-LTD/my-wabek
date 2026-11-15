import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { logAction, getClientIp } from '@/lib/middleware'
import { getPhoneNumberInfo, toPublicInstance, GRAPH_SUBSCRIBE_BASE_URL } from '@/lib/whatsapp'
import { checkInstanceCreateAllowed } from '@/lib/wa-smart-send'
import { v4 as uuidv4 } from 'uuid'

const createSchema = z.object({
  phone_number: z.string().min(5).max(32),
  display_name: z.string().max(100).optional(),
  phone_number_id: z.string().trim().regex(/^\d{5,30}$/),
  waba_id: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? undefined : typeof v === 'string' ? v.trim() : v),
    z.string().regex(/^\d{5,30}$/).optional()),
  access_token: z.string().trim().min(1).max(2048),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    // select('*') then an allowlist: access_token never leaves the server
    const { data, error } = await db
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: 'Failed to load instances' })
    return res.status(200).json({ instances: (data || []).map(r => toPublicInstance(r)) })
  }

  if (req.method === 'POST') {
    // Plan limit applies to CREATING instances only (existing ones keep working)
    const limit = await checkInstanceCreateAllowed(user.userId)
    if (!limit.allowed) return res.status(403).json({ error: limit.error, code: 'PLAN_LIMIT' })

    try {
      const body = createSchema.parse(req.body)

      // Verify the credentials work
      let displayName = body.display_name
      try {
        const info = await getPhoneNumberInfo(body.phone_number_id, body.access_token)
        displayName = displayName || (info.verified_name as string) || body.phone_number
      } catch {
        return res.status(400).json({ error: 'Invalid WhatsApp credentials. Check Phone Number ID and Access Token.' })
      }

      const { data, error } = await db.from('whatsapp_instances').insert({
        id: uuidv4(),
        user_id: user.userId,
        phone_number: body.phone_number,
        display_name: displayName,
        phone_number_id: body.phone_number_id,
        waba_id: body.waba_id,
        access_token: body.access_token,
        status: 'connected',
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook`,
      }).select('*').single()

      if (error) {
        console.error('[instances] create failed:', error.message)
        return res.status(500).json({ error: 'Failed to create instance' })
      }

      // Subscribe our App to this WABA's webhooks — required for Meta to
      // send inbound message/status webhooks. Non-fatal: the token may lack
      // `whatsapp_business_management` permission (#200), in which case we
      // surface a warning so the user can fix it via the
      // "Fix Webhook Subscription" button or Graph API Explorer.
      let webhookWarning: string | undefined
      if (body.waba_id) {
        try {
          const subRes = await fetch(`${GRAPH_SUBSCRIBE_BASE_URL}/${body.waba_id}/subscribed_apps`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${body.access_token}` },
          })
          const subData = await subRes.json()
          if (!subData?.success) {
            webhookWarning = subData?.error?.message
              ? `Webhook subscription failed: ${subData.error.message}. Incoming messages won't arrive until this is fixed (use the "Fix Webhook Subscription" button).`
              : 'Webhook subscription did not return success. Incoming messages may not arrive.'
          }
        } catch {
          webhookWarning = 'Could not subscribe to webhooks. Incoming messages won\'t arrive until this is fixed.'
        }
      } else {
        webhookWarning = 'No WABA ID provided — incoming messages will NOT arrive. Add the WhatsApp Business Account ID and use "Fix Webhook Subscription".'
      }

      await logAction({ userId: user.userId, action: 'create_instance', resource: 'whatsapp_instance', resourceId: data.id, ipAddress: getClientIp(req) })

      return res.status(201).json({ instance: toPublicInstance(data), webhook_warning: webhookWarning })
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
      return res.status(500).json({ error: 'Failed to create instance' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
