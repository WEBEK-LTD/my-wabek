import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  PaperAirplaneIcon, PaperClipIcon, FaceSmileIcon, BoltIcon, XMarkIcon, SparklesIcon, PencilSquareIcon,
  ChatBubbleBottomCenterTextIcon, DocumentDuplicateIcon, ClockIcon, MusicalNoteIcon, DocumentIcon,
} from '@heroicons/react/24/outline'
import { Button, Spinner, Tooltip } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useInboxCopy } from './copy'
import type { InboxCopyKey } from './copy'
import type { WindowState } from './utils'
import { formatBytes } from './utils'

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✅', '💯', '🎉']

export interface ComposerProps {
  mode: 'reply' | 'note'
  onMode: (m: 'reply' | 'note') => void
  text: string
  onText: (v: string | ((prev: string) => string)) => void
  onSend: () => void
  onAddNote: () => void
  sending: boolean
  savingNote?: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement>
  // Quick replies
  quickReplies: { id: string; title: string; message: string }[]
  showQuickReplies: boolean
  onShowQuickReplies: (v: boolean | ((p: boolean) => boolean)) => void
  showEmoji: boolean
  onShowEmoji: (v: boolean | ((p: boolean) => boolean)) => void
  // Attachments
  attachment: { file: File; previewUrl: string | null; type: string; caption: string } | null
  onAttachmentCaption: (v: string) => void
  fileInputRef: React.RefObject<HTMLInputElement>
  onPickAttachment: (e: React.ChangeEvent<HTMLInputElement>) => void
  onCancelAttachment: () => void
  onSendAttachment: () => void
  uploadingAttachment: boolean
  // Window & templates
  windowState: WindowState
  onOpenTemplates: () => void
  // AI
  aiAvailable: boolean
  aiSuggestion: string | null
  aiLoading: boolean
  onSuggest: () => void
  onUseSuggestion: () => void
  onDismissSuggestion: () => void
}

export function Composer(p: ComposerProps) {
  const { c } = useInboxCopy()
  const [hi, setHi] = useState(0)

  // "/" at the start opens quick replies filtered by what follows.
  const slash = p.mode === 'reply' && p.text.startsWith('/')
  const query = slash ? p.text.slice(1).toLowerCase() : p.text.toLowerCase()
  const qrOpen = p.mode === 'reply' && (slash || p.showQuickReplies)
  const qrItems = useMemo(() => p.quickReplies.filter(r =>
    !query || r.title?.toLowerCase().includes(query) || r.message?.toLowerCase().includes(query)), [p.quickReplies, query])
  useEffect(() => { setHi(0) }, [query, qrOpen])

  const pickReply = (r: { message: string }) => {
    p.onText(r.message)
    p.onShowQuickReplies(false)
    p.textareaRef.current?.focus()
  }

  const closed = p.mode === 'reply' && p.windowState.kind === 'closed'
  const isNote = p.mode === 'note'

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (qrOpen && qrItems.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi(i => (i + 1) % qrItems.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHi(i => (i - 1 + qrItems.length) % qrItems.length); return }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pickReply(qrItems[hi] || qrItems[0]); return }
    }
    if (e.key === 'Escape' && qrOpen) { e.preventDefault(); p.onShowQuickReplies(false); if (slash) p.onText(''); return }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isNote) p.onAddNote(); else p.onSend()
    }
  }

  const typeKey = (`t_${p.attachment?.type}`) as InboxCopyKey

  return (
    <div className="border-t border-line-soft bg-surface px-3 pb-3 pt-2 sm:px-4">
      {/* 24h window closed */}
      {closed && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-warning/25 bg-warning-bg px-3.5 py-2.5 text-[13px] text-warning" role="status">
          <ClockIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="min-w-[200px] flex-1 leading-relaxed">{c('window_closed_d')}</p>
          <Button size="xs" variant="secondary" icon={DocumentDuplicateIcon} onClick={p.onOpenTemplates}>{c('templates')}</Button>
        </div>
      )}

      {/* AI suggestion */}
      {p.mode === 'reply' && (p.aiSuggestion || p.aiLoading) && (
        <div className="mb-2 rounded-2xl border border-violet/20 bg-violet-bg px-3.5 py-2.5" aria-live="polite">
          <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-violet">
            <SparklesIcon className="h-4 w-4" aria-hidden="true" />{c('ai_suggestion')}
          </p>
          {p.aiLoading ? (
            <p className="flex items-center gap-2 text-sm text-violet"><Spinner />{c('ai_thinking')}</p>
          ) : (
            <>
              <p className="line-clamp-4 whitespace-pre-wrap text-sm text-ink" dir="auto">{p.aiSuggestion}</p>
              <div className="mt-2 flex gap-2">
                <Button size="xs" onClick={p.onUseSuggestion}>{c('ai_use')}</Button>
                <Button size="xs" variant="ghost" onClick={p.onDismissSuggestion}>{c('ai_dismiss')}</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Quick replies */}
      {qrOpen && (
        <div className="mb-2 max-h-56 overflow-y-auto rounded-2xl border border-line bg-surface shadow-dropdown" role="listbox" aria-label={c('quick_replies')}>
          {qrItems.length === 0 ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted">
              <span>{c('no_quick_replies')}</span>
              <Link href="/dashboard/quick-replies" className="text-[13px] font-medium text-link hover:text-link-hover">{c('manage_quick_replies')}</Link>
            </div>
          ) : qrItems.map((r, i) => (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={i === hi}
              onMouseEnter={() => setHi(i)}
              onClick={() => pickReply(r)}
              className={cn('flex w-full flex-col gap-0.5 border-b border-line-soft px-4 py-2.5 text-start last:border-0', i === hi ? 'bg-chip/60' : 'hover:bg-surface-2')}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><BoltIcon className="h-3.5 w-3.5 text-brand-ink" aria-hidden="true" />{r.title}</span>
              <span className="truncate text-xs text-muted" dir="auto">{r.message}</span>
            </button>
          ))}
        </div>
      )}

      {/* Emoji */}
      {p.showEmoji && (
        <div className="mb-2 flex flex-wrap gap-1 rounded-2xl border border-line bg-surface p-2 shadow-dropdown">
          {EMOJIS.map(e => (
            <button key={e} type="button" onClick={() => { p.onText(t => t + e); p.onShowEmoji(false) }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-xl transition hover:scale-110 hover:bg-surface-3" aria-label={e}>
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Attachment preview */}
      {p.attachment && (
        <div className="mb-2 rounded-2xl border border-line bg-surface-2 p-3">
          <div className="flex items-start gap-3">
            {p.attachment.previewUrl && p.attachment.type === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.attachment.previewUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            )}
            {p.attachment.previewUrl && p.attachment.type === 'video' && (
              <video src={p.attachment.previewUrl} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            )}
            {!p.attachment.previewUrl && (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-chip text-chip-ink">
                {p.attachment.type === 'audio' || p.attachment.type === 'ptt'
                  ? <MusicalNoteIcon className="h-7 w-7" aria-hidden="true" />
                  : <DocumentIcon className="h-7 w-7" aria-hidden="true" />}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink" dir="auto">{p.attachment.file.name}</p>
              <p className="tabular text-xs text-muted">{formatBytes(p.attachment.file.size)}</p>
              <input
                value={p.attachment.caption}
                onChange={e => p.onAttachmentCaption(e.target.value)}
                placeholder={c('caption_ph')}
                aria-label={c('caption_ph')}
                dir="auto"
                className="mt-1.5 h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-xs text-ink outline-none focus:border-brand-teal focus:shadow-ring"
              />
            </div>
            <Button size="icon-sm" variant="ghost" icon={XMarkIcon} aria-label={c('remove_attachment')} onClick={p.onCancelAttachment} />
          </div>
          <Button size="sm" fullWidth className="mt-2.5" loading={p.uploadingAttachment} icon={PaperAirplaneIcon} onClick={p.onSendAttachment}>
            {p.uploadingAttachment ? c('sending') : c('send_attachment', { type: c(typeKey) || p.attachment.type })}
          </Button>
        </div>
      )}

      {/* Mode switch */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex gap-1" role="tablist" aria-label={c('mode_reply')}>
          {([['reply', 'mode_reply', ChatBubbleBottomCenterTextIcon], ['note', 'mode_note', PencilSquareIcon]] as const).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={p.mode === m}
              onClick={() => p.onMode(m)}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition',
                p.mode === m ? (m === 'note' ? 'bg-warning-bg text-warning' : 'bg-chip text-chip-ink') : 'text-muted hover:bg-surface-3 hover:text-ink')}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />{c(label)}
            </button>
          ))}
        </div>
        {p.mode === 'reply' && p.aiAvailable && !p.aiSuggestion && !p.aiLoading && (
          <button type="button" onClick={p.onSuggest}
            className="inline-flex items-center gap-1.5 rounded-full border border-violet/25 bg-violet-bg px-3 py-1 text-xs font-medium text-violet transition hover:brightness-95">
            <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />{c('ai_suggest')}
          </button>
        )}
      </div>

      {/* Input row */}
      <div className={cn('flex items-end gap-1.5 rounded-[20px] border p-1.5 transition-[border-color,box-shadow] focus-within:border-brand-teal focus-within:shadow-ring',
        isNote ? 'border-warning/30 bg-warning-bg/60' : 'border-line-strong bg-surface')}>
        {!isNote && (
          <>
            <input ref={p.fileInputRef} type="file" className="hidden" onChange={p.onPickAttachment} tabIndex={-1}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.ppt,.pptx" />
            <Tooltip content={c('attach')}>
              <Button size="icon-sm" variant="ghost" icon={PaperClipIcon} aria-label={c('attach')} onClick={() => p.fileInputRef.current?.click()} />
            </Tooltip>
            <Tooltip content={c('emoji')}>
              <Button size="icon-sm" variant="ghost" icon={FaceSmileIcon} aria-label={c('emoji')} aria-pressed={p.showEmoji}
                onClick={() => { p.onShowEmoji(v => !v); p.onShowQuickReplies(false) }} />
            </Tooltip>
            <Tooltip content={c('quick_replies')}>
              <Button size="icon-sm" variant="ghost" icon={BoltIcon} aria-label={c('quick_replies')} aria-pressed={p.showQuickReplies}
                onClick={() => { p.onShowQuickReplies(v => !v); p.onShowEmoji(false) }} />
            </Tooltip>
          </>
        )}
        <textarea
          ref={p.textareaRef}
          value={p.text}
          onChange={e => p.onText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isNote ? c('note_ph') : c('reply_ph')}
          aria-label={isNote ? c('mode_note') : c('mode_reply')}
          rows={1}
          dir="auto"
          style={{ resize: 'none', maxHeight: '140px' }}
          className="min-h-[36px] flex-1 bg-transparent px-2 py-2 text-sm text-ink outline-none placeholder:text-muted/80"
          onInput={e => {
            const t = e.currentTarget
            t.style.height = 'auto'
            t.style.height = Math.min(t.scrollHeight, 140) + 'px'
          }}
        />
        {isNote ? (
          <Button size="sm" variant="dark" loading={p.savingNote} disabled={!p.text.trim()} onClick={p.onAddNote} className="h-9 shrink-0">
            {c('add_note')}
          </Button>
        ) : (
          <Button size="icon" icon={PaperAirplaneIcon} aria-label={c('send')} disabled={!p.text.trim() || p.sending} onClick={p.onSend}
            className="h-9 w-9 shrink-0 rounded-full rtl:[&_svg]:-scale-x-100" />
        )}
      </div>
      <p className="mt-1 hidden px-2 text-[11px] text-muted sm:block">{c('enter_hint')}</p>
    </div>
  )
}
