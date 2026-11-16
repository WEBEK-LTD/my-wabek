import React from 'react'
import { AreaChart, Badge, ProgressBar } from '@/components/ui'

// Illustrative campaign used in the landing preview (labelled as such on screen).
const FUNNEL = [
  { key: 'mk_preview_sent', value: 8240, pct: 74 },
  { key: 'mk_preview_delivered', value: 8102, pct: 73 },
  { key: 'mk_preview_read', value: 6912, pct: 62 },
  { key: 'mk_preview_replies', value: 1304, pct: 18 },
]
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
const SENT = [420, 760, 780, 750, 770, 740, 710, 680, 670, 650, 670, 640]
const READ = [180, 520, 610, 640, 660, 650, 620, 600, 590, 580, 610, 642]

/**
 * ProductPreview — a campaign screen built from UI-kit components, shown at the
 * bottom of the landing hero. Figures are illustrative and marked as such.
 */
export function ProductPreview({ t, lang }: { t: (k: string) => string; lang: string }) {
  const fmt = (n: number) => n.toLocaleString(lang === 'ar' ? 'en-US' : lang)
  return (
    <section aria-label={t('mk_preview_label')} className="relative mx-auto max-w-[1160px] px-4 pt-14 sm:px-8 sm:pt-[70px]">
      <div className="rounded-t-hero border border-b-0 border-white/[0.14] bg-white/[0.06] p-2.5 pb-0 sm:p-3.5 sm:pb-0">
        <div className="flex min-h-[380px] flex-col gap-4 rounded-t-[18px] bg-canvas p-4 text-ink sm:gap-[18px] sm:p-6">
          {/* window dots */}
          <div aria-hidden="true" className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-lg font-semibold sm:text-xl">{t('mk_preview_campaign')}</span>
              <span className="text-[13px] text-muted">{t('mk_preview_meta')}</span>
            </div>
            <Badge tone="brand" dot pulse>{t('mk_preview_status')}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {FUNNEL.map(f => (
              <div key={f.key} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <span className="text-xs text-muted">{t(f.key)}</span>
                <span className="tabular text-2xl font-semibold sm:text-[26px]" dir="ltr">{fmt(f.value)}</span>
                <ProgressBar value={f.pct} size="sm" aria-label={`${t(f.key)} ${f.pct}%`} />
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
            <AreaChart
              height={170}
              labels={HOURS}
              showYAxis={false}
              gridLines={3}
              ariaLabel={t('mk_preview_chart')}
              series={[
                { name: t('mk_preview_sent'), data: SENT },
                { name: t('mk_preview_read'), data: READ, color: '#8BE07A' },
              ]}
            />
          </div>
          <span className="text-xs text-muted">{t('mk_illustrative')}</span>
        </div>
      </div>
    </section>
  )
}

export default ProductPreview
