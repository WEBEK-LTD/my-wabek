import axios from 'axios'
import { createHmac } from 'crypto'
import { safeEqual } from './security'

// ── Graph API version: ONE place for the whole app ──────────────────────────
// Every Graph call (messages, media, templates, OAuth, catalog) uses this.
export const WA_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0'
export const GRAPH_BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`
// /{waba}/subscribed_apps was observed to reject older versions with #200, so
// it keeps its own (env-overridable) version instead of WA_API_VERSION.
export const WA_SUBSCRIBE_API_VERSION = process.env.WHATSAPP_SUBSCRIBE_API_VERSION || 'v25.0'
export const GRAPH_SUBSCRIBE_BASE_URL = `https://graph.facebook.com/${WA_SUBSCRIBE_API_VERSION}`
const WA_BASE_URL = GRAPH_BASE_URL

export interface SendTextMessageParams {
  phoneNumberId: string
  accessToken: string
  to: string
  text: string
  previewUrl?: boolean
}

export interface SendTemplateMessageParams {
  phoneNumberId: string
  accessToken: string
  to: string
  templateName: string
  languageCode: string
  components?: unknown[]
}

export interface SendMediaMessageParams {
  phoneNumberId: string
  accessToken: string
  to: string
  type: 'image' | 'document' | 'audio' | 'video' | 'sticker'
  mediaUrl: string
  caption?: string
  filename?: string // document only — Meta rejects this field for other types
}

export interface WAMessage {
  messaging_product: string
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string; message_status: string }>
}

const waAxios = (accessToken: string) =>
  axios.create({
    baseURL: WA_BASE_URL,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

export async function sendTextMessage({
  phoneNumberId,
  accessToken,
  to,
  text,
  previewUrl = false,
}: SendTextMessageParams): Promise<WAMessage> {
  const client = waAxios(accessToken)
  const url = `/${phoneNumberId}/messages`
  console.log(`[whatsapp] sendTextMessage phone_number_id=${phoneNumberId} to=${formatPhone(to)}`)
  try {
    const { data } = await client.post(url, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formatPhone(to),
      type: 'text',
      text: { preview_url: previewUrl, body: text },
    })
    return data
  } catch (err: any) {
    console.error(`[whatsapp] sendTextMessage FAILED status=${err?.response?.status} body=`, JSON.stringify(err?.response?.data))
    throw err
  }
}

export async function sendTemplateMessage({
  phoneNumberId,
  accessToken,
  to,
  templateName,
  languageCode,
  components = [],
}: SendTemplateMessageParams): Promise<WAMessage> {
  const client = waAxios(accessToken)
  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to: formatPhone(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  })
  return data
}

export async function sendMediaMessage({
  phoneNumberId,
  accessToken,
  to,
  type,
  mediaUrl,
  caption,
  filename,
}: SendMediaMessageParams): Promise<WAMessage> {
  const client = waAxios(accessToken)
  const mediaPayload: Record<string, unknown> = { link: mediaUrl }

  // Per Meta's exact rules:
  // - caption: supported on image/video/document — NOT on audio or sticker
  // - filename: supported ONLY on document — rejected on any other type
  if (caption && (type === 'image' || type === 'video' || type === 'document')) {
    mediaPayload.caption = caption
  }
  if (filename && type === 'document') {
    mediaPayload.filename = filename
  }

  const { data } = await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to: formatPhone(to),
    type,
    [type]: mediaPayload,
  })
  return data
}

export async function markMessageAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
): Promise<void> {
  const client = waAxios(accessToken)
  await client.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  })
}

// ── Inbound media (Cloud API) ──────────────────────────────────────────────
// Meta inbound messages only include a `media.id`, not a usable URL.
// Step 1: GET /{media-id} → returns a short-lived (a few minutes) signed URL.
// Step 2: download the bytes from that URL using the same access token.
// The caller is responsible for re-uploading the bytes to permanent
// storage before the signed URL expires.
export async function fetchInboundMedia(
  mediaId: string,
  accessToken: string
): Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number } | null> {
  try {
    const client = waAxios(accessToken)
    const { data: meta } = await client.get(`/${mediaId}`)
    const url = meta?.url as string | undefined
    if (!url) return null

    const fileRes = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
      timeout: 30000,
    })
    return {
      buffer: Buffer.from(fileRes.data),
      mimeType: meta?.mime_type || fileRes.headers['content-type'] || 'application/octet-stream',
      sizeBytes: Number(meta?.file_size) || fileRes.data.byteLength,
    }
  } catch (err) {
    console.error('[whatsapp] fetchInboundMedia failed:', err instanceof Error ? err.message : err)
    return null
  }
}

export async function getPhoneNumberInfo(
  phoneNumberId: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const client = waAxios(accessToken)
  const { data } = await client.get(`/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,platform_type`)
  return data
}

export async function getBusinessProfile(
  phoneNumberId: string,
  accessToken: string
): Promise<Record<string, unknown>> {
  const client = waAxios(accessToken)
  const { data } = await client.get(`/${phoneNumberId}/whatsapp_business_profile`)
  return data
}

export async function getMessageTemplates(
  wabaId: string,
  accessToken: string
): Promise<{ data: unknown[] }> {
  const client = waAxios(accessToken)
  const { data } = await client.get(`/${wabaId}/message_templates`)
  return data
}

export function verifyWebhook(
  mode: string,
  token: string,
  challenge: string
): string | null {
  // Fail closed: with no verify token configured, never echo the challenge.
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  if (!expected) {
    console.error('[whatsapp] WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set — rejecting webhook verification')
    return null
  }
  if (mode === 'subscribe' && safeEqual(token, expected) && typeof challenge === 'string') {
    return challenge
  }
  return null
}

/** App secrets that may sign Meta webhooks: META_APP_SECRET plus the comma-separated META_APP_SECRETS. */
export function getMetaAppSecrets(): string[] {
  const list = [process.env.META_APP_SECRET || '', ...(process.env.META_APP_SECRETS || '').split(',')]
  return Array.from(new Set(list.map(s => s.trim()).filter(Boolean)))
}

/**
 * Verify X-Hub-Signature-256 (HMAC-SHA256 of the RAW body with the app secret).
 * Returns 'valid', 'invalid', or 'unconfigured' (no app secret in env).
 */
export function verifyMetaSignature(rawBody: Buffer, header: unknown): 'valid' | 'invalid' | 'unconfigured' {
  const secrets = getMetaAppSecrets()
  if (!secrets.length) return 'unconfigured'
  if (typeof header !== 'string' || !header.startsWith('sha256=')) return 'invalid'
  const received = header.slice(7).trim().toLowerCase()
  for (const secret of secrets) {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    if (safeEqual(received, expected)) return 'valid'
  }
  return 'invalid'
}

export function parseWebhookPayload(body: unknown): {
  messages: WebhookMessage[]
  statuses: WebhookStatus[]
} {
  const messages: WebhookMessage[] = []
  const statuses: WebhookStatus[] = []

  const entry = (body as any)?.entry || []
  for (const e of entry) {
    const changes = e?.changes || []
    for (const change of changes) {
      if (change?.field !== 'messages') continue
      const value = change?.value || {}
      const phoneNumberId = value?.metadata?.phone_number_id

      for (const msg of value?.messages || []) {
        messages.push({
          phoneNumberId,
          from: msg.from,
          messageId: msg.id,
          timestamp: msg.timestamp,
          type: msg.type,
          text: msg.text?.body,
          image: msg.image,
          document: msg.document,
          audio: msg.audio,
          video: msg.video,
          sticker: msg.sticker,
          contactName: value?.contacts?.[0]?.profile?.name,
        })
      }

      for (const status of value?.statuses || []) {
        statuses.push({
          phoneNumberId,
          messageId: status.id,
          recipientId: status.recipient_id,
          recipient_id: status.recipient_id,
          status: status.status,
          timestamp: status.timestamp,
          errors: status.errors,
        })
      }
    }
  }

  return { messages, statuses }
}

export interface WebhookMessage {
  phoneNumberId: string
  from: string
  messageId: string
  timestamp: string
  type: string
  text?: string
  image?: unknown
  document?: unknown
  audio?: unknown
  video?: unknown
  sticker?: unknown
  contactName?: string
}

export interface WebhookStatus {
  phoneNumberId: string
  messageId: string
  recipientId: string
  recipient_id?: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  errors?: Array<{
    code?: string | number
    title?: string
    message?: string
    error_data?: Record<string, unknown>
  }>
}

function formatPhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')
  // Remove leading zeros only (don't add any country code)
  return digits.replace(/^0+/, '') || digits
}

// ── Instance rows sent to the browser ───────────────────────────────────────
// Never include access_token, session data or verify tokens. An allowlist (not
// a SELECT list) so that optional columns missing in older schemas never make
// the query fail.
const PUBLIC_INSTANCE_FIELDS = [
  'id', 'user_id', 'name', 'display_name', 'phone_number', 'phone_number_id', 'waba_id',
  'status', 'instance_type', 'type', 'is_default', 'qr_code', 'webhook_url',
  'last_seen_at', 'battery_level', 'is_phone_connected', 'created_at', 'updated_at',
] as const

export function toPublicInstance(row: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!row) return null
  const out: Record<string, unknown> = {}
  for (const k of PUBLIC_INSTANCE_FIELDS) if (k in row) out[k] = row[k]
  return out
}
