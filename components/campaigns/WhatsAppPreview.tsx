import React from 'react'
import { CheckIcon } from '@heroicons/react/20/solid'
import { Avatar, cn } from '@/components/ui'
import { localeFor, translate, useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/campaign-components'
import { currentLang } from './shared'

/** Example values for the preview only (never sent), in the UI language. */
export function sampleValues(contactName: string, lang: string = currentLang()): Record<string, string> {
  let date: string
  try { date = new Date().toLocaleDateString(localeFor(lang)) } catch { date = new Date().toLocaleDateString('en-GB') }
  return {
    name: contactName || translate(messages, lang, 'sample_name'),
    phone: '+966500000000',
    company: translate(messages, lang, 'sample_company'),
    amount: '99.00',
    date,
    link: 'https://example.com',
  }
}

/** Replace {{name}} / {name} style placeholders with example values. */
export function fillSample(text: string, contactName: string, extra: Record<string, string> = {}, lang?: string): string {
  const vals = { ...sampleValues(contactName, lang), ...extra }
  return String(text || '')
    .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => (k.toLowerCase() in vals ? vals[k.toLowerCase()] : m))
    .replace(/\{([\w.-]+)\}/g, (m, k) => (k.toLowerCase() in vals ? vals[k.toLowerCase()] : m))
}

/** WhatsApp inline formatting (*bold*, _italic_, ~strike~) rendered as React nodes — no HTML injection. */
function formatLine(line: string, key: number): React.ReactNode {
  const parts = line.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g)
  return (
    <React.Fragment key={key}>
      {parts.map((p, i) => {
        if (/^\*[^*]+\*$/.test(p)) return <strong key={i} className="font-semibold">{p.slice(1, -1)}</strong>
        if (/^_[^_]+_$/.test(p)) return <em key={i} className="opacity-80">{p.slice(1, -1)}</em>
        if (/^~[^~]+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>
        return <React.Fragment key={i}>{p}</React.Fragment>
      })}
    </React.Fragment>
  )
}

export function WhatsAppPreview({ message, contactName: contactNameProp, header, footer, buttons, className, placeholder }: {
  message: string
  contactName?: string
  header?: React.ReactNode
  footer?: React.ReactNode
  buttons?: string[]
  className?: string
  placeholder?: string
}) {
  const text = String(message || '').trim()
  const { t, fmtTime } = useT(messages)
  const contactName = contactNameProp ?? t('sample_name')
  const time = fmtTime(new Date())
  return (
    <figure className={cn('overflow-hidden rounded-panel border border-line bg-surface shadow-card', className)} aria-label={t('preview_aria')}>
      <div className="flex items-center gap-3 bg-deep-hero px-4 py-3 text-deep-ink">
        <Avatar name={contactName || t('preview_contact')} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{contactName || t('preview_contact')}</p>
          <p className="text-[11px] text-deep-muted">{t('preview_online')}</p>
        </div>
      </div>
      <div
        className="min-h-[180px] bg-surface-2 p-4"
        style={{ backgroundImage: 'radial-gradient(rgb(var(--line) / 0.9) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
      >
        {header}
        <div className="flex justify-end">
          <div className="relative max-w-[92%] sm:max-w-[85%]">
            <div className="rounded-2xl rounded-se-md bg-chip px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink shadow-sm">
              {text ? (
                <p dir="auto" className="whitespace-pre-wrap break-words">
                  {text.split('\n').map((line, i, arr) => (
                    <React.Fragment key={i}>{formatLine(line, i)}{i < arr.length - 1 && <br />}</React.Fragment>
                  ))}
                </p>
              ) : (
                <p className="text-muted">{placeholder ?? t('preview_placeholder')}</p>
              )}
              {footer && <p className="mt-1.5 text-[11.5px] text-muted">{footer}</p>}
              <p className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-muted">
                <span className="tabular">{time}</span>
                <span className="flex -space-x-1.5 text-brand-ink rtl:space-x-reverse" aria-hidden="true">
                  <CheckIcon className="h-3.5 w-3.5" /><CheckIcon className="h-3.5 w-3.5" />
                </span>
              </p>
            </div>
            {buttons && buttons.length > 0 && (
              <div className="mt-1 grid gap-1">
                {buttons.map((b, i) => (
                  <span key={i} className="rounded-xl bg-surface px-3 py-2 text-center text-[13px] font-medium text-link shadow-sm">{b}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </figure>
  )
}
