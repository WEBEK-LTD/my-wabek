import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { checkPlanLimit, logAction, getClientIp } from '@/lib/middleware'
import { getPhoneNumberInfo } from '@/lib/whatsapp'
import { v4 as uuidv4 } from 'uuid'

const createSchema = z.object({
  phone_number: z.string().min(5),
  display_name: z.string().optional(),
  phone_number_id: z.string().min(1),
  waba_id: z.string().optional(),
  access_token: z.string().min(1),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ instances: data })
  }

  if (req.method === 'POST') {
    // Plan limit check removed

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
      }).select().single()

      if (error) return res.status(500).json({ error: error.message })

      // Subscribe our App to this WABA's webhooks — required for Meta to
      // send inbound message/status webhooks. Non-fatal: the token may lack
      // `whatsapp_business_management` permission (#200), in which case we
      // surface a warning so the user can fix it via the
      // "Fix Webhook Subscription" button or Graph API Explorer.
      let webhookWarning: string | undefined
      if (body.waba_id) {
        try {
          const apiVer = 'v25.0' // subscribed_apps requires v25.0 (v20/v21 return #200 Permissions error)
          const subRes = await fetch(`https://graph.facebook.com/${apiVer}/${body.waba_id}/subscribed_apps`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${body.access_token}` },
          })
          const subData = await subRes.json()
          if (!subData?.success) {
            webhookWarning = subData?.error?.message
              ? `Webhook subscription failed: ${subData.error.message}. Incoming messages won't arrive until this is fixed (use the "Fix Webhook Subscription" button).`
              : 'Webhook subscription did not return success. Incoming messages may not arrive.'
          }
        } catch (e: any) {
          webhookWarning = `Could not subscribe to webhooks: ${e?.message}. Incoming messages won't arrive until this is fixed.`
        }
      } else {
        webhookWarning = 'No WABA ID provided — incoming messages will NOT arrive. Add the WhatsApp Business Account ID and use "Fix Webhook Subscription".'
      }

      await logAction({ userId: user.userId, action: 'create_instance', resource: 'whatsapp_instance', resourceId: data.id, ipAddress: getClientIp(req) })

      return res.status(201).json({ instance: data, webhook_warning: webhookWarning })
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
      return res.status(500).json({ error: 'Failed to create instance' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
