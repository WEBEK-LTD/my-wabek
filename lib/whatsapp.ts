import axios from 'axios'

const WA_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0'
const WA_BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`

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
  type: 'image' | 'document' | 'audio' | 'video'
  mediaUrl: string
  caption?: string
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
  console.log(`[whatsapp] sendTextMessage URL=https://graph.facebook.com/${WA_API_VERSION}${url} to=${formatPhone(to)} tokenPrefix=${accessToken?.slice(0,10)}...`)
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
}: SendMediaMessageParams): Promise<WAMessage> {
  const client = waAxios(accessToken)
  const mediaPayload: Record<string, unknown> = { link: mediaUrl }
  if (caption) mediaPayload.caption = caption
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
  if (
    mode === 'subscribe' &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return challenge
  }
  return null
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
