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

  const res = await fetch(`${waServerUrl}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Secret': process.env.WA_WEB_SERVER_SECRET || '',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || `Server error ${res.status}`)
  }

  return res.json()
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
  const data = await callWAServer(`/instance/${params.instanceId}/send`, { to: params.to, text: params.text }) as { messageId: string }
  return data
}

// Send media (image/video/audio/document) via the Baileys server.
// Uses a NEW route (/instance/:id/send-media) on the same Railway server,
// following the exact same callWAServer() pattern as the existing /send
// and /qr routes — does not modify or affect them in any way.
//
// NOTE: if this route doesn't exist yet on the Railway server, it needs
// to be added there (see docs/baileys-server.md for the expected shape:
// POST /instance/:id/send-media { to, mediaUrl, mediaType, caption?, filename? }
// using sock.sendMessage(jid, { image/video/audio/document: { url }, caption, ... })).
export async function sendWAWebMedia(params: {
  instanceId: string
  to: string
  mediaUrl: string
  mediaType: string // 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'ptt'
  caption?: string
  filename?: string
}): Promise<{ messageId?: string; error?: string }> {
  try {
    const data = await callWAServer(`/instance/${params.instanceId}/send-media`, {
      to: params.to,
      mediaUrl: params.mediaUrl,
      mediaType: params.mediaType,
      caption: params.caption,
      filename: params.filename,
    }) as { messageId: string }
    return { messageId: data.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: msg }
  }
}
