import { isToday, isYesterday } from 'date-fns'
import { localeFor } from '@/lib/i18n-local'
import type { MessageKey as InboxCopyKey } from '@/locales/dashboard/inbox'

type C = (k: InboxCopyKey, v?: Record<string, string | number>) => string

export const MEDIA_PLACEHOLDER = /^\[(image|video|audio|document|sticker|ptt)\]$/

/** List / bubble time: HH:mm today, "Yesterday", otherwise a short date. */
export function formatTime(d: string | number | Date | null | undefined, lang: string, c: C): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  if (isToday(date)) return new Intl.DateTimeFormat(localeFor(lang), { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
  if (isYesterday(date)) return c('yesterday')
  return new Intl.DateTimeFormat(localeFor(lang), { day: 'numeric', month: 'short' }).format(date)
}

export function clockTime(d: string | Date, lang: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d))
}

/** Day separator label. */
export function dayLabel(d: string | Date, lang: string, c: C): string {
  const date = new Date(d)
  if (isToday(date)) return c('today')
  if (isYesterday(date)) return c('yesterday')
  return new Intl.DateTimeFormat(localeFor(lang), { weekday: 'long', day: 'numeric', month: 'long', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(date)
}

export function dateTime(d: string | null | undefined, lang: string): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat(localeFor(lang), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d))
}

export function formatBytes(bytes: number): string {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

/** Short preview of a message for the conversation list. */
export function previewText(msg: any, c: C): string {
  if (!msg) return c('no_messages_yet')
  const content = typeof msg.content === 'string' ? msg.content : ''
  const mediaKey = `media_${msg.type}` as InboxCopyKey
  const isMedia = ['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(msg.type)
  if (isMedia && (!content || MEDIA_PLACEHOLDER.test(content))) return c(mediaKey)
  if (!content) return isMedia ? c(mediaKey) : c('no_messages_yet')
  return content
}

const DAY = 24 * 60 * 60 * 1000

export type WindowState =
  | { kind: 'na' }                      // WA Web numbers: no 24h rule
  | { kind: 'open'; msLeft: number }
  | { kind: 'closed'; lastInbound: string | null }

/**
 * 24-hour customer-service window for THIS number (instance): opened only by
 * the customer's own messages to it. Based on the loaded messages.
 */
export function windowState(messages: any[], instance: { id?: string; instance_type?: string | null; type?: string | null } | null | undefined): WindowState {
  const kind = instance?.instance_type || instance?.type
  if (kind === 'wa_web') return { kind: 'na' }
  let last: string | null = null
  for (const m of messages) {
    if (m.direction !== 'inbound') continue
    if (instance?.id && m.instance_id && m.instance_id !== instance.id) continue
    if (!last || new Date(m.created_at) > new Date(last)) last = m.created_at
  }
  if (!last) return { kind: 'closed', lastInbound: null }
  const left = DAY - (Date.now() - new Date(last).getTime())
  return left > 0 ? { kind: 'open', msLeft: left } : { kind: 'closed', lastInbound: last }
}

export function isAiMessage(m: any): boolean {
  return m?.type === 'ai_reply' || m?.meta?.source === 'ai_assistant'
}
