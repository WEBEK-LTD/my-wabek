import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const WA_SERVER = process.env.WA_WEB_SERVER_URL
  const WA_SECRET = process.env.WA_WEB_SERVER_SECRET

  // GET — get QR / status
  if (req.method === 'GET') {
    const { instanceId } = req.query
    if (!instanceId) return res.status(400).json({ error: 'instanceId required' })

    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('*')
      .eq('id', instanceId as string)
      .eq('user_id', user.userId)
      .single()

    if (!instance) return res.status(404).json({ error: 'Instance not found' })

    // If Railway server configured, get fresh status
    if (WA_SERVER && instance.status !== 'connected') {
      try {
        const r = await fetch(`${WA_SERVER}/instance/${instanceId}/status`, {
          headers: { 'X-Secret': WA_SECRET || '' },
        })
        if (r.ok) {
          const fresh = await r.json()
          if (fresh.qrCode) {
            await db.from('whatsapp_instances').update({ qr_code: fresh.qrCode, status: fresh.status }).eq('id', instanceId as string)
            return res.status(200).json({ instanceId, status: fresh.status, qrCode: fresh.qrCode, phoneNumber: fresh.phoneNumber })
          }
        }
      } catch {}
    }

    return res.status(200).json({
      instanceId,
      status: instance.status,
      qrCode: instance.qr_code,
      phoneNumber: instance.phone_number,
      displayName: instance.display_name,
    })
  }

  // POST — create/manage WA Web instance
  if (req.method === 'POST') {
    const { action, instanceId, display_name } = req.body

    if (action === 'create') {
      // Check if Railway server is configured
      if (!WA_SERVER) {
        return res.status(400).json({
          error: 'WA Web server not configured',
          message: 'لازم تضيف WA_WEB_SERVER_URL في Netlify Environment Variables. شوف الـ docs/baileys-server.md',
          docs: 'Add WA_WEB_SERVER_URL and WA_WEB_SERVER_SECRET to Netlify environment variables, then redeploy.',
          configured: false,
        })
      }

      const newId = uuidv4()

      // Create instance in DB first
      const { data, error } = await db.from('whatsapp_instances').insert({
        id: newId,
        user_id: user.userId,
        phone_number: 'pending',
        display_name: display_name || 'WhatsApp Web',
        instance_type: 'wa_web',
        status: 'initializing',
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook`,
      }).select().single()

      if (error) return res.status(500).json({ error: error.message })

      // Request QR from Railway server
      try {
        const r = await fetch(`${WA_SERVER}/instance/${newId}/qr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Secret': WA_SECRET || '' },
          body: JSON.stringify({ instanceId: newId, userId: user.userId }),
        })

        if (r.ok) {
          const qrData = await r.json()
          if (qrData.qrCode) {
            await db.from('whatsapp_instances').update({ qr_code: qrData.qrCode, status: 'qr_pending' }).eq('id', newId)
            return res.status(201).json({ instance: data, qrCode: qrData.qrCode, message: 'Scan QR code with WhatsApp' })
          }
        }

        // Server responded but no QR yet (still initializing)
        await db.from('whatsapp_instances').update({ status: 'qr_pending' }).eq('id', newId)
        return res.status(201).json({ instance: data, message: 'Instance created. QR code generating...' })

      } catch (err) {
        // Railway server unreachable
        await db.from('whatsapp_instances').delete().eq('id', newId)
        return res.status(503).json({
          error: 'Cannot connect to WA Web server',
          message: `Cannot reach ${WA_SERVER}. Make sure your Railway server is running and WA_WEB_SERVER_URL is correct.`,
        })
      }
    }

    if (action === 'request_qr' && instanceId) {
      if (!WA_SERVER) return res.status(400).json({ error: 'WA_WEB_SERVER_URL not configured in Netlify' })

      try {
        const r = await fetch(`${WA_SERVER}/instance/${instanceId}/qr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Secret': WA_SECRET || '' },
          body: JSON.stringify({ instanceId }),
        })
        const data = await r.json()
        if (data.qrCode) {
          await db.from('whatsapp_instances').update({ qr_code: data.qrCode, status: 'qr_pending' }).eq('id', instanceId)
        }
        return res.status(200).json(data)
      } catch {
        return res.status(503).json({ error: 'Cannot reach WA Web server' })
      }
    }

    if (action === 'disconnect' && instanceId) {
      if (WA_SERVER) {
        try {
          await fetch(`${WA_SERVER}/instance/${instanceId}/disconnect`, {
            method: 'POST',
            headers: { 'X-Secret': WA_SECRET || '' },
          })
        } catch {}
      }
      await db.from('whatsapp_instances').update({ status: 'disconnected', qr_code: null }).eq('id', instanceId)
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Invalid action' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
