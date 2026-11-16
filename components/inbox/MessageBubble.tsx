import React from 'react'
import {
  CheckIcon, ClockIcon, ExclamationCircleIcon, DocumentTextIcon, DocumentIcon, TableCellsIcon,
  ArchiveBoxIcon, PresentationChartBarIcon, PaperClipIcon, MicrophoneIcon, MusicalNoteIcon, ArrowDownTrayIcon,
  SparklesIcon, CpuChipIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/components/ui/utils'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/inbox'
import { MEDIA_PLACEHOLDER, clockTime, isAiMessage } from './utils'

function docIconFor(mime?: string, filename?: string): React.ElementType {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || ''
  if (mime?.includes('pdf') || ext === 'pdf') return DocumentTextIcon
  if (mime?.includes('word') || ['doc', 'docx'].includes(ext)) return DocumentIcon
  if (mime?.includes('sheet') || mime?.includes('excel') || ['xls', 'xlsx'].includes(ext)) return TableCellsIcon
  if (mime?.includes('zip') || mime?.includes('compressed') || ['zip', 'rar', '7z'].includes(ext)) return ArchiveBoxIcon
  if (mime?.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return PresentationChartBarIcon
  return PaperClipIcon
}

/**
 * Media portion of a bubble (image / video / audio / ptt / document / sticker).
 * Returns null for plain text; any unrecognized / missing media_url falls back
 * to nothing extra (the text content still renders).
 */
export function MediaBubbleContent({ msg }: { msg: any }) {
  const { t } = useT(messages)
  if (!msg.media_url) return null
  const isData = typeof msg.media_url === 'string' && msg.media_url.startsWith('data:')

  switch (msg.type) {
    case 'image':
      return (
        <a
          href={isData ? undefined : msg.media_url}
          onClick={isData ? (e) => { e.preventDefault(); window.open(msg.media_url) } : undefined}
          target="_blank" rel="noopener noreferrer"
          className="mb-1 block cursor-zoom-in overflow-hidden rounded-xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={msg.media_url} alt={t('image_alt')} className="max-h-72 w-full max-w-[280px] object-cover transition hover:scale-[1.02]" loading="lazy" />
        </a>
      )
    case 'sticker':
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={msg.media_url} alt={t('sticker_alt')} className="mb-1 h-32 w-32" loading="lazy" />
    case 'video':
      return <video src={msg.media_url} controls className="mb-1 max-h-72 w-full max-w-[280px] rounded-xl" />
    case 'ptt':
    case 'audio': {
      const Icon = msg.type === 'ptt' ? MicrophoneIcon : MusicalNoteIcon
      return (
        <div className="mb-1 flex min-w-[220px] items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-[#04282C]">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <audio src={msg.media_url} controls className="h-9 w-full max-w-[220px]" />
        </div>
      )
    }
    case 'document': {
      const Icon = docIconFor(msg.media_mime_type, msg.media_filename)
      return (
        <button
          type="button"
          onClick={() => {
            const url = msg.media_url
            if (!url) return
            if (url.startsWith('data:')) {
              // data URI — create blob and download (target=_blank fails for data URIs)
              const [meta, b64] = url.split(',')
              const mime = meta.split(':')[1]?.split(';')[0] || 'application/octet-stream'
              const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0))
              const blob = new Blob([bytes], { type: mime })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = msg.media_filename || 'file'
              a.click()
              URL.revokeObjectURL(a.href)
            } else {
              window.open(url, '_blank', 'noopener,noreferrer')
            }
          }}
          className="mb-1 flex w-full min-w-[220px] items-center gap-3 rounded-xl border border-line bg-surface/70 px-3 py-2.5 text-start transition hover:border-line-strong"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chip text-chip-ink">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-ink" dir="auto">{msg.media_filename || t('document')}</span>
            <span className="block text-[11px] text-muted">{t('open_download')}</span>
          </span>
          <ArrowDownTrayIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        </button>
      )
    }
    default:
      return null
  }
}

export function DeliveryTicks({ status, windowWarning }: { status?: string; windowWarning?: boolean }) {
  const { t } = useT(messages)
  if (windowWarning) return <ExclamationCircleIcon className="h-3.5 w-3.5 text-warning" aria-label={t('not_delivered_window')} />
  switch (status) {
    case 'pending': case 'waiting': case 'sending':
      return <ClockIcon className="h-3.5 w-3.5 text-muted" aria-label={t('status_pending')} />
    case 'failed':
      return <ExclamationCircleIcon className="h-3.5 w-3.5 text-danger" aria-label={t('status_failed')} />
    case 'delivered':
    case 'read':
      return (
        <span className={cn('flex', status === 'read' ? 'text-brand-ink' : 'text-muted')} role="img" aria-label={status === 'read' ? t('status_read') : t('status_delivered')} dir="ltr">
          <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
          <CheckIcon className="-ms-2 h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
        </span>
      )
    default:
      return <CheckIcon className="h-3.5 w-3.5 text-muted" strokeWidth={2.4} aria-label={t('status_sent')} />
  }
}

export function MessageBubble({ msg, grouped }: { msg: any; grouped?: boolean }) {
  const { t, lang } = useT(messages)
  const isOut = msg.direction === 'outbound'
  const isMediaOnly = msg.media_url && MEDIA_PLACEHOLDER.test(msg.content || '')
  const hasText = !!msg.content && !isMediaOnly
  const ai = isAiMessage(msg)
  const bot = msg.meta?.source === 'chatbot'

  return (
    <div className={cn('flex w-full', isOut ? 'justify-end' : 'justify-start', grouped ? 'mt-0.5' : 'mt-3')}>
      <div className={cn('flex max-w-[85%] flex-col sm:max-w-[72%]', isOut ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'relative rounded-[18px] px-3.5 py-2 text-sm shadow-[0_1px_0_rgb(var(--shadow)/0.04)]',
            isOut
              ? 'bg-chip text-ink ' + (grouped ? '' : 'rounded-se-md')
              : 'border border-line bg-surface text-ink ' + (grouped ? '' : 'rounded-ss-md'),
            ai && isOut && 'bg-violet-bg',
            msg._windowWarning && 'opacity-70',
          )}
        >
          <MediaBubbleContent msg={msg} />
          {hasText && <p className="whitespace-pre-wrap break-words leading-relaxed" dir="auto">{msg.content}</p>}
          <div className={cn('mt-1 flex items-center gap-1.5 text-[10.5px] text-muted', isOut ? 'justify-end' : 'justify-start')}>
            {ai && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet/10 px-1.5 py-0.5 font-medium text-violet">
                <SparklesIcon className="h-3 w-3" aria-hidden="true" />{t('ai_badge')}
              </span>
            )}
            {bot && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-1.5 py-0.5 font-medium text-chip-ink">
                <CpuChipIcon className="h-3 w-3" aria-hidden="true" />{t('bot_badge')}
              </span>
            )}
            <time dateTime={msg.created_at} className="tabular">{msg.created_at ? clockTime(msg.created_at, lang) : ''}</time>
            {isOut && <DeliveryTicks status={msg.status} windowWarning={msg._windowWarning} />}
          </div>
        </div>
        {msg._windowWarning && (
          <p className="mt-1 text-[11px] font-medium text-warning">{t('not_delivered_window')}</p>
        )}
        {!msg._windowWarning && msg.status === 'failed' && msg.meta?.error_code && (
          <p className="mt-1 text-[11px] font-medium text-danger">
            {msg.meta.error_code === 131047
              ? t('err_131047')
              : msg.meta.error_code === 131026
                ? t('err_131026')
                : t('err_failed', { code: msg.meta.error_code, msg: msg.meta.error_msg || t('unknown_error') })}
          </p>
        )}
      </div>
    </div>
  )
}
