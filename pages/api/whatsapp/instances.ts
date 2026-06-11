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

      await logAction({ userId: user.userId, action: 'create_instance', resource: 'whatsapp_instance', resourceId: data.id, ipAddress: getClientIp(req) })

      return res.status(201).json({ instance: data })
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
      return res.status(500).json({ error: 'Failed to create instance' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
