import React from 'react'
import { BoltIcon, CheckIcon, InboxStackIcon, MegaphoneIcon } from '@heroicons/react/24/outline'
import { Avatar, Badge, ProgressBar } from '@/components/ui'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/hero'

/**
 * HeroIllustration — the product cards of the original landing hero
 * (campaign, team inbox, auto-reply and a WhatsApp chat), drawn with the
 * Lagoon UI kit. Figures are illustrative.
 */
export default function HeroIllustration() {
  const { t, fmtNumber } = useT(messages)
  const card = 'rounded-card border border-line bg-surface p-5 text-ink shadow-card'
  const head = (Icon: React.ElementType, title: string, sub?: string, side?: React.ReactNode) => (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-chip text-chip-ink"><Icon className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{title}</p>
          {sub && <p className="truncate text-xs text-muted">{sub}</p>}
        </div>
      </div>
      {side}
    </div>
  )
  const inbox = [t('m1'), t('m2'), t('m3')]

  return (
    <section aria-label={t('label')} className="mx-auto w-full max-w-[1280px] px-4 pt-14 sm:px-8 sm:pt-16">
      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_1fr_340px]">
        <div className="flex flex-col gap-4">
          {/* Campaign */}
          <div className={card}>
            {head(MegaphoneIcon, t('camp_title'), t('camp_sub', { n: fmtNumber(4820) }), <Badge tone="brand" dot pulse>{t('camp_live')}</Badge>)}
            <dl className="grid grid-cols-3 gap-2">
              {[
                { n: fmtNumber(4612), l: t('delivered') },
                { n: `${fmtNumber(96)}%`, l: t('read') },
                { n: fmtNumber(341), l: t('replies') },
              ].map(s => (
                <div key={s.l} className="flex flex-col gap-1 rounded-xl bg-canvas px-3 py-2.5">
                  <dt className="order-2 text-[11px] text-muted">{s.l}</dt>
                  <dd className="tabular order-1 text-lg font-semibold" dir="ltr">{s.n}</dd>
                </div>
              ))}
            </dl>
            <ProgressBar value={96} size="sm" className="mt-4" aria-label={`${t('read')} 96%`} />
          </div>
          {/* Auto-reply */}
          <div className={card}>
            {head(BoltIcon, t('reply_title'), t('reply_sub', { n: fmtNumber(48) }))}
            <div className="flex flex-col gap-2 text-[13px] leading-relaxed">
              <p className="w-fit max-w-[90%] rounded-2xl rounded-ss-md bg-canvas px-3.5 py-2">{t('q')}</p>
              <p className="ms-auto w-fit max-w-[90%] rounded-2xl rounded-se-md bg-chip px-3.5 py-2 text-chip-ink">{t('a')}</p>
              <p className="ms-auto inline-flex items-center gap-1 text-[11px] font-medium text-brand-ink"><CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />{t('replied')}</p>
            </div>
          </div>
        </div>

        {/* Team inbox */}
        <div className={card}>
          {head(InboxStackIcon, t('inbox_title'), undefined, <Badge tone="warning">{t('inbox_open', { n: fmtNumber(12) })}</Badge>)}
          <ul className="flex flex-col gap-2.5">
            {inbox.map((m, i) => {
              const [who, ...rest] = m.split(':')
              return (
                <li key={i} className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-3">
                  <Avatar name={who} size="sm" />
                  <p className="min-w-0 flex-1 text-[13px] leading-snug"><span className="font-semibold">{who}:</span>{rest.join(':')}</p>
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-brand-green" />
                </li>
              )
            })}
          </ul>
        </div>

        {/* WhatsApp chat */}
        <div className="relative overflow-hidden rounded-card bg-[#04282C] p-4 text-deep-ink shadow-hero">
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-2.5">
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-[#04282C]">{t('wa_name').slice(0, 1)}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{t('wa_name')}</p>
              <p className="inline-flex items-center gap-1.5 text-[11px] text-deep-muted"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-green" />{t('wa_online')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 py-4 text-[13px] leading-relaxed">
            <p className="w-fit max-w-[85%] rounded-2xl rounded-ss-md bg-white/10 px-3.5 py-2">{t('m_recv1')}</p>
            <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-se-md bg-brand-gradient px-3.5 py-2 text-[#04282C]">{t('m_sent1')}</p>
            <div className="w-fit max-w-[85%] rounded-2xl rounded-ss-md bg-white/10 px-3.5 py-2">
              <div className="mb-1.5 rounded-xl bg-white/10 px-3 py-2">
                <p className="font-semibold">{t('m_order')}</p>
                <p className="text-[11px] text-deep-muted">{t('m_ships')}</p>
              </div>
              {t('m_recv2')}
            </div>
            <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-se-md bg-brand-gradient px-3.5 py-2 text-[#04282C]">{t('m_sent2')}</p>
          </div>
          <div className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] text-deep-muted">{t('wa_message')}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-green" />{t('badge_rate')}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium">{t('badge_del')}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
