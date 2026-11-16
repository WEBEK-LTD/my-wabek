// WhatsApp Web via external Baileys server
// Baileys is NOT bundled with WABEK to avoid Netlify secrets scanner false positives.
// Run the Baileys server separately on a VPS — see docs/baileys-server.md

import { supabaseAdmin } from './supabase'
import { assertSafeMediaUrl } from './media-storage'

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

/** Only instance ids we generate (UUIDs) may appear in Baileys URL paths. */
export function isValidInstanceId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id)
}

export async function callWAServer(path: string, body?: object, opts: { method?: string } = {}): Promise<unknown> {
  const waServerUrl = process.env.WA_WEB_SERVER_URL
  if (!waServerUrl) throw new Error('WA_WEB_SERVER_URL not configured')
  const secret = process.env.WA_WEB_SERVER_SECRET
  if (!secret) throw new Error('WA_WEB_SERVER_SECRET not configured')

  const fullUrl = `${waServerUrl.replace(/\/+$/, '')}${path}`
  const method  = opts.method || (body ? 'POST' : 'GET')

  // Request log — never the secret, never message bodies
  console.log(`[wa-web] ${method} ${path}`)

  let res: Response
  try {
    res = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': secret,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch (fetchErr) {
    console.error(`[wa-web] FETCH ERROR ${fullUrl}:`, fetchErr instanceof Error ? fetchErr.message : fetchErr)
    throw new Error(`WA Web server unreachable: ${fetchErr instanceof Error ? fetchErr.message : fetchErr}`)
  }

  const rawText = await res.text()
  console.log(`[wa-web] RESPONSE ${res.status} ${path}`)

  if (!res.ok) {
    let errMsg = `Server error ${res.status}`
    try {
      const parsed = JSON.parse(rawText)
      errMsg = parsed?.error || parsed?.message || errMsg
    } catch {}
    console.error(`[wa-web] ${method} ${path} failed (${res.status}): ${rawText.slice(0, 300)}`)
    throw new Error(`[wa-web] ${method} ${path} failed (${res.status}): ${errMsg}`)
  }

  try {
    return JSON.parse(rawText)
  } catch {
    return { raw: rawText }
  }
}

export async function requestQRCode(instanceId: string, userId: string): Promise<{ qrCode?: string; message: string }> {
  const db = supabaseAdmin()
  if (!isValidInstanceId(instanceId)) throw new Error('Invalid instance id')

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
  if (!isValidInstanceId(instanceId)) throw new Error('Invalid instance id')
  try {
    // POST-only route on the WA server (no body would make this a GET).
    await callWAServer(`/instance/${instanceId}/disconnect`, {})
  } catch {}
  await db.from('whatsapp_instances').update({ status: 'disconnected', qr_code: null }).eq('id', instanceId)
}

export async function sendWAWebMessage(params: { instanceId: string; to: string; text: string }): Promise<{ messageId: string }> {
  if (!isValidInstanceId(params.instanceId)) throw new Error('Invalid instance id')
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
  if (!isValidInstanceId(params.instanceId)) throw new Error('Invalid instance id')
  // SSRF guard: the Baileys server fetches this URL, so only public https
  // URLs (or our own storage) may be passed on.
  const mediaUrl = await assertSafeMediaUrl(params.mediaUrl)
  const data = await callWAServer(`/instance/${params.instanceId}/send-media`, {
    to: params.to,
    mediaUrl,
    mediaType: params.mediaType,
    caption: params.caption,
    filename: params.filename,
    mimetype: params.mimetype,
  }) as { messageId: string }
  return data
}

/**
 * Keep the dashboard honest about QR numbers.
 *
 * Asks the Baileys server which sessions it actually holds and marks
 * `wa_web` instances that WABEK still lists as "connected" — but that the
 * server no longer has — as disconnected, so the owner sees "scan the QR
 * again" instead of a green badge on a number whose sends all fail.
 *
 * Skipped while the Baileys server is (re)starting, so a deploy never causes
 * false "disconnected" marks.
 */
export async function reconcileWAWebStatuses(): Promise<{ checked: number; markedDisconnected: number; skipped?: string }> {
  if (!process.env.WA_WEB_SERVER_URL || !process.env.WA_WEB_SERVER_SECRET) return { checked: 0, markedDisconnected: 0, skipped: 'wa_web_not_configured' }
  const info = await callWAServer('/instances') as {
    restoreDone?: boolean; uptimeSeconds?: number
    instances?: { id: string; connected: boolean; status: string }[]
  }
  // Older Baileys builds don't report restore state: don't guess.
  if (info?.restoreDone !== true) return { checked: 0, markedDisconnected: 0, skipped: 'server_restoring_or_old_build' }
  if ((info.uptimeSeconds ?? 0) < 180) return { checked: 0, markedDisconnected: 0, skipped: 'server_just_started' }

  const live = new Set((info.instances || []).map(i => i.id))
  const db = supabaseAdmin()
  const { data: rows } = await db.from('whatsapp_instances')
    .select('id')
    .eq('instance_type', 'wa_web')
    .eq('status', 'connected')
  const missing = (rows || []).map(r => r.id as string).filter(id => !live.has(id))
  if (missing.length) {
    await db.from('whatsapp_instances')
      .update({ status: 'disconnected', qr_code: null, updated_at: new Date().toISOString() })
      .in('id', missing)
      .eq('status', 'connected')
    console.warn(`[wa-web] reconcile: ${missing.length} QR number(s) had no live session — marked disconnected`)
  }
  return { checked: rows?.length || 0, markedDisconnected: missing.length }
}
