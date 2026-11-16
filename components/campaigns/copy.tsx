// Translated copy helpers for the campaigns / contacts / integrations pages
// (same look as CopyButton / CopyField / CodeBlock in components/settings/Shared).
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { CheckIcon, ClipboardDocumentIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { Button, Tooltip, cn } from '@/components/ui'
import { copyText } from '@/components/settings/format'
import { useT } from '@/lib/i18n-local'
import common from '@/locales/dashboard/common-a'

export function CopyButton({ text, label, size = 'icon-sm', className, onCopied }: {
  text: string
  label?: string
  size?: 'icon-sm' | 'icon' | 'sm' | 'xs'
  className?: string
  onCopied?: () => void
}) {
  const { t } = useT(common)
  const lbl = label ?? t('copy')
  const [done, setDone] = useState(false)
  const copy = async () => {
    const ok = await copyText(text)
    if (ok) {
      setDone(true)
      toast.success(t('copied'))
      onCopied?.()
      setTimeout(() => setDone(false), 1800)
    } else {
      toast.error(t('copy_failed'))
    }
  }
  if (size === 'sm' || size === 'xs') {
    return (
      <Button variant="secondary" size={size} icon={done ? CheckIcon : ClipboardDocumentIcon} onClick={copy} className={className}>
        {done ? t('copied') : lbl}
      </Button>
    )
  }
  return (
    <Tooltip content={done ? t('copied') : lbl}>
      <Button variant="ghost" size={size} icon={done ? CheckIcon : ClipboardDocumentIcon} onClick={copy} aria-label={lbl} className={cn(done && 'text-success', className)} />
    </Tooltip>
  )
}

/** Read-only LTR value (ID, URL, key prefix) with copy and optional reveal. */
export function CopyField({ value, label, secret, mono = true, className, copyable = true, placeholder }: {
  value: string
  label?: React.ReactNode
  secret?: boolean
  mono?: boolean
  className?: string
  copyable?: boolean
  placeholder?: string
}) {
  const { t } = useT(common)
  const [shown, setShown] = useState(!secret)
  return (
    <div className={cn('flex min-w-0 items-center gap-2 rounded-field border border-line bg-surface-2 py-1.5 pe-1.5 ps-3', className)}>
      {label && <span className="shrink-0 text-xs text-muted">{label}</span>}
      <code dir="ltr" className={cn('min-w-0 flex-1 truncate text-[13px] text-ink', mono && 'font-mono', label && 'text-end')}>
        {value ? (shown ? value : '•'.repeat(Math.min(32, Math.max(12, value.length)))) : (placeholder || '—')}
      </code>
      {secret && value && (
        <Button variant="ghost" size="icon-sm" icon={shown ? EyeSlashIcon : EyeIcon} onClick={() => setShown(v => !v)} aria-label={shown ? t('hide') : t('show')} />
      )}
      {copyable && value && <CopyButton text={value} />}
    </div>
  )
}

/** Code sample with a header label and a copy button. */
export function CodeBlock({ code, label, className }: { code: string; label?: React.ReactNode; className?: string }) {
  const { t } = useT(common)
  return (
    <div className={cn('overflow-hidden rounded-card border border-line bg-surface-2', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-2">
        <span className="truncate text-xs font-medium text-muted" dir="ltr">{label}</span>
        <CopyButton text={code} label={t('copy_code')} />
      </div>
      <pre dir="ltr" className="overflow-x-auto px-4 py-3 text-start font-mono text-[12.5px] leading-relaxed text-ink scrollbar-none">
        <code>{code}</code>
      </pre>
    </div>
  )
}
