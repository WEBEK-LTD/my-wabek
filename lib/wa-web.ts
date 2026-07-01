// WhatsApp Web via external Baileys server
// Baileys is NOT bundled with WABEK to avoid Netlify secrets scanner false positives.
// Run the Baileys server separately on a VPS — see docs/baileys-server.md

import { supabaseAdmin } from './supabase'

export interface WAWebSession {
  instanceId: string
  status: 'initializing' | 'qr_pending' | 'connected' | 'disconnected'
  qrCode?: string
  phoneNumber?: string
}

export async function getInstanceStatus(instanceId: string): Promise<WAWebSession> {
  const db = supabaseAdmin()
  const { data } = await db
    .from('whatsapp_instances')
    .select('id, status, qr_code, phone_number')
    .eq('id', instanceId)
    .single()

  return {
    instanceId,
    status: (data?.status as WAWebSession['status']) || 'disconnected',
    qrCode: data?.qr_code || undefined,
    phoneNumber: data?.phone_number || undefined,
  }
}

async function callWAServer(path: string, body?: object): Promise<unknown> {
  const waServerUrl = process.env.WA_WEB_SERVER_URL
  if (!waServerUrl) throw new Error('WA_WEB_SERVER_URL not configured')

  const fullUrl = `${waServerUrl}${path}`
  const method  = body ? 'POST' : 'GET'

  // Detailed request log — omit X-Secret from output
  console.log(`[wa-web] ${method} ${fullUrl}`, body ? JSON.stringify(body).slice(0, 800) : '')

  let res: Response
  try {
    res = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': process.env.WA_WEB_SERVER_SECRET || '',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch (fetchErr) {
    console.error(`[wa-web] FETCH ERROR ${fullUrl}:`, fetchErr instanceof Error ? fetchErr.message : fetchErr)
    throw new Error(`WA Web server unreachable: ${fetchErr instanceof Error ? fetchErr.message : fetchErr}`)
  }

  const rawText = await res.text()
  console.log(`[wa-web] RESPONSE ${res.status} ${fullUrl}:`, rawText.slice(0, 500))

  if (!res.ok) {
    let errMsg = `Server error ${res.status}`
    try {
      const parsed = JSON.parse(rawText)
      errMsg = parsed?.error || parsed?.message || errMsg
    } catch {}
    throw new Error(`[wa-web] ${method} ${path} failed (${res.status}): ${errMsg} | body=${rawText.slice(0, 300)}`)
  }

  try {
    return JSON.parse(rawText)
  } catch {
    return { raw: rawText }
  }
}

export async function requestQRCode(instanceId: string, userId: string): Promise<{ qrCode?: string; message: string }> {
  const db = supabaseAdmin()

  try {
    const data = await callWAServer(`/instance/${instanceId}/qr`, { instanceId, userId }) as { qrCode?: string }
    if (data.qrCode) {
      await db.from('whatsapp_instances').update({ qr_code: data.qrCode, status: 'qr_pending' }).eq('id', instanceId)
      return { qrCode: data.qrCode, message: 'Scan QR code with WhatsApp' }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('WA_WEB_SERVER_URL not configured')) {
      await db.from('whatsapp_instances').update({ status: 'qr_pending' }).eq('id', instanceId)
      return { message: 'WA Web server not configured. Set WA_WEB_SERVER_URL in Netlify environment variables. See docs/baileys-server.md' }
    }
    throw err
  }

  await db.from('whatsapp_instances').update({ status: 'qr_pending' }).eq('id', instanceId)
  return { message: 'Waiting for QR code from WA server…' }
}

export async function disconnectWAWeb(instanceId: string): Promise<void> {
  const db = supabaseAdmin()
  try {
    await callWAServer(`/instance/${instanceId}/disconnect`)
  } catch {}
  await db.from('whatsapp_instances').update({ status: 'disconnected', qr_code: null }).eq('id', instanceId)
}

export async function sendWAWebMessage(params: { instanceId: string; to: string; text: string }): Promise<{ messageId: string }> {
  try {
    const data = await callWAServer(`/instance/${params.instanceId}/send`, { to: params.to, text: params.text }) as { messageId: string }
    return data
  } catch (err: any) {
    // If instance not found, try to restore the session automatically
    if (err?.message?.includes('Instance not found') || err?.message?.includes('404')) {
      console.log(`[wa-web] Instance ${params.instanceId} not found — attempting auto-restore...`)
      try {
        await callWAServer(`/instance/${params.instanceId}/restore`, {})
        // Retry send after restore
        const data = await callWAServer(`/instance/${params.instanceId}/send`, { to: params.to, text: params.text }) as { messageId: string }
        return data
      } catch (restoreErr: any) {
        throw new Error(`Instance not found and restore failed: ${restoreErr?.message}`)
      }
    }
    throw err
  }
}

// Send media (image/video/audio/document) via the Baileys server.
// Uses route /instance/:id/send-media on the Railway server.
// Throws on failure (same pattern as sendWAWebMessage above) so callers
// get the full detailed error from callWAServer's logging.
export async function sendWAWebMedia(params: {
  instanceId: string
  to: string
  mediaUrl: string
  mediaType: string
  caption?: string
  filename?: string
  mimetype?: string
}): Promise<{ messageId: string }> {
  const data = await callWAServer(`/instance/${params.instanceId}/send-media`, {
    to: params.to,
    mediaUrl: params.mediaUrl,
    mediaType: params.mediaType,
    caption: params.caption,
    filename: params.filename,
    mimetype: params.mimetype,
  }) as { messageId: string }
  return data
}
