import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireMemberAccess } from '@/lib/auth'
import { checkInstanceCreateAllowed } from '@/lib/wa-smart-send'
import { callWAServer, isValidInstanceId } from '@/lib/wa-web'
import { v4 as uuidv4 } from 'uuid'

const PUBLIC_COLUMNS = 'id, user_id, status, qr_code, phone_number, display_name, instance_type, type'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'instances')
  if (!user) return
  const db = supabaseAdmin()

  const WA_SERVER = process.env.WA_WEB_SERVER_URL

  /** The caller's own instance, or null. Every action goes through this. */
  const ownInstance = async (instanceId: unknown) => {
    if (!isValidInstanceId(instanceId)) return null
    const { data } = await db
      .from('whatsapp_instances')
      .select(PUBLIC_COLUMNS)
      .eq('id', instanceId)
      .eq('user_id', user.userId)
      .maybeSingle()
    return data
  }

  // GET — get QR / status
  if (req.method === 'GET') {
    const { instanceId } = req.query
    if (!instanceId) return res.status(400).json({ error: 'instanceId required' })

    const instance = await ownInstance(instanceId)
    if (!instance) return res.status(404).json({ error: 'Instance not found' })

    // If Railway server configured, get fresh status
    if (WA_SERVER && instance.status !== 'connected') {
      try {
        const fresh = await callWAServer(`/instance/${instance.id}/status`) as { qrCode?: string; status?: string; phoneNumber?: string }
        if (fresh?.qrCode) {
          await db.from('whatsapp_instances').update({ qr_code: fresh.qrCode, status: fresh.status }).eq('id', instance.id).eq('user_id', user.userId)
          return res.status(200).json({ instanceId: instance.id, status: fresh.status, qrCode: fresh.qrCode, phoneNumber: fresh.phoneNumber })
        }
      } catch {}
    }

    return res.status(200).json({
      instanceId: instance.id,
      status: instance.status,
      qrCode: instance.qr_code,
      phoneNumber: instance.phone_number,
      displayName: instance.display_name,
    })
  }

  // POST — create/manage WA Web instance
  if (req.method === 'POST') {
    const { action, instanceId, display_name } = req.body || {}

    if (action === 'create') {
      // Check if Railway server is configured
      if (!WA_SERVER) {
        return res.status(400).json({
          // Language-neutral: the UI translates by `code` (falls back to `message`).
          code: 'WA_WEB_NOT_CONFIGURED',
          error: 'WA Web server not configured',
          message: 'Add WA_WEB_SERVER_URL to the server environment variables (see docs/baileys-server.md).',
          docs: 'Add WA_WEB_SERVER_URL and WA_WEB_SERVER_SECRET to Netlify environment variables, then redeploy.',
          configured: false,
        })
      }

      // Plan limit applies to CREATING instances only (existing ones keep working)
      const limit = await checkInstanceCreateAllowed(user.userId)
      if (!limit.allowed) return res.status(403).json({ error: limit.error, code: 'PLAN_LIMIT' })

      const newId = uuidv4()

      // Create instance in DB first
      const { data, error } = await db.from('whatsapp_instances').insert({
        id: newId,
        user_id: user.userId,
        phone_number: 'pending',
        display_name: typeof display_name === 'string' ? display_name.slice(0, 100) : null,  // null → UI shows phone_number once connected
        instance_type: 'wa_web',
        status: 'initializing',
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook`,
      }).select(PUBLIC_COLUMNS).single()

      if (error) {
        console.error('[wa-web] create instance failed:', error.message)
        return res.status(500).json({ error: 'Failed to create instance' })
      }

      // Request QR from Railway server
      try {
        const qrData = await callWAServer(`/instance/${newId}/qr`, { instanceId: newId, userId: user.userId }) as { qrCode?: string }
        if (qrData?.qrCode) {
          await db.from('whatsapp_instances').update({ qr_code: qrData.qrCode, status: 'qr_pending' }).eq('id', newId)
          return res.status(201).json({ instance: data, qrCode: qrData.qrCode, message: 'Scan QR code with WhatsApp' })
        }

        // Server responded but no QR yet (still initializing)
        await db.from('whatsapp_instances').update({ status: 'qr_pending' }).eq('id', newId)
        return res.status(201).json({ instance: data, message: 'Instance created. QR code generating...' })

      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (/failed \(\d+\)/.test(msg)) {
          // Server responded with an error but is reachable — keep the row (QR may come later)
          await db.from('whatsapp_instances').update({ status: 'qr_pending' }).eq('id', newId)
          return res.status(201).json({ instance: data, message: 'Instance created. QR code generating...' })
        }
        // Railway server unreachable
        console.error('[wa-web] create: WA server error:', msg)
        await db.from('whatsapp_instances').delete().eq('id', newId)
        return res.status(503).json({
          error: 'Cannot connect to WA Web server',
          message: 'Cannot reach the WhatsApp Web server. Make sure it is running and WA_WEB_SERVER_URL is correct.',
        })
      }
    }

    if (action === 'request_qr' && instanceId) {
      if (!WA_SERVER) return res.status(400).json({ error: 'WA_WEB_SERVER_URL not configured in Netlify' })
      const instance = await ownInstance(instanceId)
      if (!instance) return res.status(404).json({ error: 'Instance not found' })

      try {
        const data = await callWAServer(`/instance/${instance.id}/qr`, { instanceId: instance.id }) as Record<string, unknown>
        if (data?.qrCode) {
          await db.from('whatsapp_instances').update({ qr_code: data.qrCode, status: 'qr_pending' }).eq('id', instance.id).eq('user_id', user.userId)
        }
        return res.status(200).json({
          instanceId: instance.id,
          qrCode: data?.qrCode || null,
          connected: data?.connected,
          phoneNumber: data?.phoneNumber,
          status: data?.status,
        })
      } catch (err) {
        console.error('[wa-web] request_qr failed:', err instanceof Error ? err.message : err)
        return res.status(503).json({ error: 'Cannot reach WA Web server' })
      }
    }

    // Link with an 8-character code typed in WhatsApp (Linked devices → Link
    // with phone number instead) — for the mobile app, where the number's own
    // phone cannot scan a QR shown on itself. Creates the instance when no
    // instanceId is given (same plan limit as "create").
    if (action === 'pair') {
      if (!WA_SERVER) {
        return res.status(400).json({ code: 'WA_WEB_NOT_CONFIGURED', error: 'WA Web server not configured' })
      }
      const digits = String((req.body || {}).phone || '').replace(/\D/g, '')
      if (!/^\d{8,15}$/.test(digits)) return res.status(400).json({ error: 'Enter the number with its country code', code: 'invalid_phone' })

      let instance = instanceId ? await ownInstance(instanceId) : null
      if (instanceId && !instance) return res.status(404).json({ error: 'Instance not found' })
      let created = false
      if (!instance) {
        const limit = await checkInstanceCreateAllowed(user.userId)
        if (!limit.allowed) return res.status(403).json({ error: limit.error, code: 'PLAN_LIMIT' })
        const { data, error } = await db.from('whatsapp_instances').insert({
          id: uuidv4(),
          user_id: user.userId,
          phone_number: 'pending',
          display_name: typeof display_name === 'string' ? display_name.slice(0, 100) : null,
          instance_type: 'wa_web',
          status: 'initializing',
          webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook`,
        }).select(PUBLIC_COLUMNS).single()
        if (error || !data) {
          console.error('[wa-web] pair: create instance failed:', error?.message)
          return res.status(500).json({ error: 'Failed to create instance' })
        }
        instance = data
        created = true
      }

      try {
        const r = await callWAServer(`/instance/${instance.id}/pair`, { phone: digits }) as { pairingCode?: string; connected?: boolean; phoneNumber?: string; expiresIn?: number }
        if (r?.connected) return res.status(200).json({ instance, status: 'connected', phoneNumber: r.phoneNumber })
        if (!r?.pairingCode) throw new Error('no pairing code')
        await db.from('whatsapp_instances').update({ status: 'qr_pending', qr_code: null }).eq('id', instance.id).eq('user_id', user.userId)
        return res.status(created ? 201 : 200).json({ instance, pairingCode: r.pairingCode, expiresIn: r.expiresIn || 60, status: 'pairing' })
      } catch (err) {
        console.error('[wa-web] pair failed:', err instanceof Error ? err.message : err)
        if (created) await db.from('whatsapp_instances').delete().eq('id', instance.id).eq('user_id', user.userId)
        return res.status(502).json({ error: 'Could not get a linking code. Try again or use the QR code.', code: 'pairing_failed' })
      }
    }

    if (action === 'disconnect' && instanceId) {
      const instance = await ownInstance(instanceId)
      if (!instance) return res.status(404).json({ error: 'Instance not found' })
      if (WA_SERVER) {
        try { await callWAServer(`/instance/${instance.id}/disconnect`, {}) } catch {}
      }
      await db.from('whatsapp_instances').update({ status: 'disconnected', qr_code: null }).eq('id', instance.id).eq('user_id', user.userId)
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Invalid action' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
