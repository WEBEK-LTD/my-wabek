// Shapes returned by the WABEK API (pages/api/** on the web app).

export interface Instance {
  id: string
  display_name: string | null
  phone_number: string | null
  status: string // connected | disconnected | qr_pending | initializing | ...
  instance_type: string | null // wa_web | cloud_api
  type?: string | null
  is_default?: boolean
  created_at?: string
}

export interface Contact {
  id: string
  name: string | null
  phone: string
  tags?: string[] | null
}

export interface LastMessage {
  content: string | null
  direction: 'inbound' | 'outbound'
  created_at: string
  type: string | null
  media_url?: string | null
}

export interface Conversation {
  id: string
  contact_id: string
  instance_id: string | null
  status: 'open' | 'pending' | 'resolved' | 'spam'
  priority?: string
  assigned_to: string | null
  last_message_at: string | null
  unread_count?: number | null
  contacts: Contact | null
  assigned_user: { id: string; name: string | null; email: string } | null
  last_message: LastMessage | null
  whatsapp_instances: Pick<Instance, 'id' | 'phone_number' | 'display_name' | 'instance_type' | 'type'> | null
}

export interface Message {
  id: string
  contact_id: string | null
  instance_id: string | null
  direction: 'inbound' | 'outbound'
  type: string | null
  content: string | null
  status: string | null
  created_at: string
  media_url?: string | null
  media_mime_type?: string | null
  media_filename?: string | null
  /** client-only: optimistic message still sending / failed */
  local?: 'sending' | 'failed'
}

export interface DashboardStats {
  stats: {
    total_messages: number
    sent_this_month: number
    sent_last_month: number
    mom_growth: number
    total_contacts: number
    open_conversations: number
    inbound_this_month: number
    delivery_rate: number
    read_rate: number
    link_clicks_total: number
    ai_replies_30d?: number
    team_replies_30d?: number
    active_campaigns?: number
  }
  status_breakdown: Record<string, number>
  daily_chart: { date: string; sent: number; delivered: number; received: number }[]
  recent_campaigns: { id: string; name: string; status: string; sent_count?: number; delivered_count?: number; read_count?: number; failed_count?: number; total_contacts?: number; created_at?: string }[]
  top_links: { id?: string; title?: string | null; original_url?: string; short_code?: string; click_count?: number }[]
  instances: Instance[]
}

export interface Template {
  name: string
  status: string
  category?: string
  language: string
  body: string
  parameterFormat: 'NAMED' | 'POSITIONAL'
  paramNames: string[]
  variableCount: number
}

export interface Ticket {
  id: string
  ticket_number: number
  subject: string
  status: string
  created_at: string
  updated_at?: string | null
  users?: { id: string; name: string | null; email: string; plan_id?: string | null } | null
  support_messages?: { id: string; content: string; sender_type: string; created_at: string }[]
}

export interface TicketMessage {
  id: string
  content: string
  sender_type: 'user' | 'admin' | 'ai' | string
  created_at: string
}

/** "966501234567" → "+966501234567" (numbers are stored without the plus). */
export const fmtPhone = (p: string | null | undefined) => {
  const s = String(p || '').trim()
  if (!s || s === 'pending') return ''
  return /^\d{6,}$/.test(s) ? `+${s}` : s
}
export const isConnected = (s: string | null | undefined) => s === 'connected'
/** Meta Cloud API number (anything that is not a QR / WhatsApp Web session). */
export const isCloud = (i: Pick<Instance, 'instance_type' | 'type'> | null | undefined) =>
  !!i && i.instance_type !== 'wa_web' && i.type !== 'wa_web'
export const instanceName = (i: Pick<Instance, 'display_name' | 'phone_number'> | null | undefined, fallback: string) =>
  (i?.display_name || fmtPhone(i?.phone_number) || fallback).trim()
