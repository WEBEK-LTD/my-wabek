import React, { useState } from 'react'
import { ChatBubbleLeftRightIcon, UsersIcon, SignalIcon, GiftIcon } from '@heroicons/react/24/outline'
import { Button, Card, Field, Input, Skeleton, cn } from '@/components/ui'
import { fmtLimit } from '@/components/settings/format'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/billing'

function Meter({ icon: Icon, label, used, limit, loading }: {
  icon: React.ElementType
  label: string
  used: number | null
  limit: number | null | undefined
  loading?: boolean
}) {
  const { t, lang, fmtNumber } = useT(messages)
  const unlimited = limit === -1
  const pct = !unlimited && limit && used !== null ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const tone = pct >= 90 ? 'bg-danger' : pct >= 75 ? 'bg-warning' : 'bg-brand-gradient-x'
  return (
    <div className="min-w-0 rounded-card border border-line-soft bg-surface-2/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-muted">
          <Icon className="h-4 w-4 text-brand-ink" aria-hidden="true" />{label}
        </span>
        {!unlimited && limit ? <span className={cn('text-xs font-semibold tabular', pct >= 90 ? 'text-danger' : pct >= 75 ? 'text-warning' : 'text-muted')}>{pct}%</span> : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-24" />
      ) : (
        <p className="mt-2 text-2xl font-bold text-ink tabular">
          {used === null ? '—' : fmtNumber(used)}
          <span className="ms-1 text-sm font-normal text-muted">/ {fmtLimit(limit, lang)}</span>
        </p>
      )}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-track" role="progressbar" aria-label={label}
        aria-valuemin={0} aria-valuemax={unlimited ? undefined : limit || undefined} aria-valuenow={used ?? undefined}
        aria-valuetext={unlimited ? t('unlimited') : undefined}>
        <div className={cn('h-full rounded-full transition-[width] duration-700', unlimited ? 'w-full bg-brand-gradient-x opacity-30' : tone)} style={unlimited ? undefined : { width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function UsageMeters({ plan, usage, loading }: {
  plan?: { max_messages_month?: number; max_contacts?: number; max_instances?: number } | null
  usage?: { messages: number; contacts: number; instances: number } | null
  loading?: boolean
}) {
  const { t } = useT(messages)
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Meter icon={ChatBubbleLeftRightIcon} label={t('meterMessages')} used={usage ? usage.messages : null} limit={plan?.max_messages_month} loading={loading} />
      <Meter icon={UsersIcon} label={t('meterContacts')} used={usage ? usage.contacts : null} limit={plan?.max_contacts} loading={loading} />
      <Meter icon={SignalIcon} label={t('meterNumbers')} used={usage ? usage.instances : null} limit={plan?.max_instances} loading={loading} />
    </div>
  )
}

export function GiftCodeCard({ onRedeem, loading, className }: { onRedeem: (code: string, done: () => void) => void; loading?: boolean; className?: string }) {
  const { t } = useT(messages)
  const [code, setCode] = useState('')
  return (
    <Card className={className}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-bg text-violet"><GiftIcon className="h-5 w-5" aria-hidden="true" /></span>
        <div>
          <h2 className="font-semibold text-ink">{t('giftTitle')}</h2>
          <p className="text-xs text-muted">{t('giftDesc')}</p>
        </div>
      </div>
      <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); if (code) onRedeem(code, () => setCode('')) }}>
        <Field label={t('giftLabel')} srOnlyLabel className="min-w-0 flex-1">
          <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="GIFT-XXXX-XXXX" dir="ltr" className="font-mono" />
        </Field>
        <Button type="submit" variant="secondary" loading={loading} disabled={!code}>{t('redeem')}</Button>
      </form>
    </Card>
  )
}
