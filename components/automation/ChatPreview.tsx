import { useEffect, useRef } from 'react'
import { ArrowPathIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { Button, cn } from '@/components/ui'

export interface ChatMessage {
  role: 'user' | 'bot'
  text: string
  /** Small muted line under a bot bubble (e.g. triggered steps). */
  meta?: string
  error?: boolean
}

export interface ChatPreviewProps {
  title: string
  subtitle?: string
  messages: ChatMessage[]
  loading?: boolean
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onReset?: () => void
  placeholder?: string
  emptyHint?: React.ReactNode
  disabled?: boolean
  className?: string
  /** Height of the message area. */
  height?: string
  avatar?: React.ReactNode
}

/**
 * ChatPreview — a WhatsApp-like conversation pane for testing bots: deep
 * header, bubbles, typing indicator and a composer.
 */
export function ChatPreview({
  title, subtitle, messages, loading, value, onChange, onSend, onReset, placeholder = 'اكتب رسالة تجريبية…',
  emptyHint, disabled, className, height = 'h-[380px]', avatar,
}: ChatPreviewProps) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [messages.length, loading])

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-card', className)}>
      <div className="flex items-center gap-3 bg-deep-hero px-4 py-3 text-deep-ink">
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          {subtitle && <p className="truncate text-xs text-deep-muted">{subtitle}</p>}
        </div>
        {onReset && messages.length > 0 && (
          <Button size="xs" variant="on-deep-ghost" icon={ArrowPathIcon} onClick={onReset}>مسح</Button>
        )}
      </div>

      <div
        className={cn('flex flex-col gap-2.5 overflow-y-auto bg-surface-2 px-3 py-4', height)}
        style={{ backgroundImage: 'radial-gradient(rgb(var(--line) / 0.9) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
        role="log" aria-live="polite" aria-label="محادثة الاختبار"
      >
        {messages.length === 0 && !loading && (
          <div className="m-auto max-w-[260px] rounded-card bg-surface/90 px-4 py-3 text-center text-xs leading-relaxed text-muted shadow-sm">
            {emptyHint || 'أرسل رسالة كما سيكتبها عميلك لترى الرد.'}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-start' : 'justify-end')}>
            <div className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm',
              m.role === 'user' ? 'rounded-ss-sm bg-surface text-ink'
                : m.error ? 'rounded-se-sm bg-danger-bg text-danger'
                  : 'rounded-se-sm bg-chip text-ink')} dir="auto">
              {m.text}
              {m.meta && <p className="mt-1 text-2xs text-muted">{m.meta}</p>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-end" aria-label="جارٍ الرد">
            <div className="flex gap-1 rounded-2xl rounded-se-sm bg-chip px-4 py-3">
              {[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-ink" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="flex items-center gap-2 border-t border-line bg-surface p-2.5" onSubmit={e => { e.preventDefault(); if (value.trim() && !loading && !disabled) onSend() }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="رسالة الاختبار"
          className="h-10 min-w-0 flex-1 rounded-full border border-line-strong bg-surface-2 px-4 text-sm text-ink placeholder:text-muted focus:border-brand-teal focus:outline-none disabled:opacity-50"
        />
        <Button type="submit" size="icon" icon={PaperAirplaneIcon} aria-label="إرسال" disabled={!value.trim() || loading || disabled} className="rounded-full rtl:[&>svg]:-scale-x-100" />
      </form>
    </div>
  )
}

export default ChatPreview
