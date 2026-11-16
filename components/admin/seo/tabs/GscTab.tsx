/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { ArrowTopRightOnSquareIcon, ChartBarIcon, CursorArrowRaysIcon, EyeIcon, LinkIcon, LinkSlashIcon, MagnifyingGlassCircleIcon, TrophyIcon } from '@heroicons/react/24/outline'
import { AreaChart, Badge, Button, EmptyState, Input, Select, Skeleton, StatCard, Table, TBody, TD, TH, THead, TR, cn, formatNumber } from '@/components/ui'
import { useAdminT } from '../../i18n'
import { CopyButton, Notice, Steps } from '../../shared'
import type { SeoState } from '../useSeoAdmin'
import { ListRow, SeoCard } from '../ui'

const ctrTone = (c: number) => (c > 5 ? 'text-success' : c > 2 ? 'text-warning' : 'text-danger')
const posTone = (p: number) => (p <= 5 ? 'text-success' : p <= 15 ? 'text-warning' : 'text-danger')

export function GscTab({ s }: { s: SeoState }) {
  const { tr, fmtShort } = useAdminT()
  const connected = !!s.gscStatus?.connected
  const redirectUri = (typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com') + '/api/admin/gsc-callback'
  const chart = (s.gscSummary?.chart || []) as { date: string; clicks: number; impressions?: number }[]
  const ctrOps = (s.gscData || []).filter((r: any) => r.impressions > 500 && r.ctr < 3)

  return (
    <div className="space-y-5">
      <SeoCard icon={MagnifyingGlassCircleIcon} title="Google Search Console" subtitle={tr('بيانات فعلية: النقرات، مرات الظهور، نسبة النقر، المركز لكل استعلام وصفحة.', 'Real data: clicks, impressions, CTR and position per query and page.')}
        action={connected ? (
          <div className="flex items-center gap-3">
            <div className="text-end"><Badge tone="success" dot size="sm">{tr('متصل', 'Connected')}</Badge><p dir="ltr" className="mt-0.5 text-2xs text-muted">{s.gscStatus.email}</p></div>
            <Button size="sm" variant="danger-soft" icon={LinkSlashIcon} onClick={s.disconnectGsc}>{tr('فصل', 'Disconnect')}</Button>
          </div>
        ) : <Button icon={LinkIcon} loading={s.gscConnecting} onClick={s.connectGsc}>{tr('ربط Search Console', 'Connect Search Console')}</Button>}>
        {!connected && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-line-soft bg-surface-2 p-4">
              <p className="text-sm font-semibold text-ink">{tr('إعداد مطلوب قبل الربط', 'Setup required before connecting')}</p>
              <Steps items={[
                <span key="1">{tr('افتح Google Cloud Console وأنشئ مشروعًا أو اختر واحدًا', 'Open Google Cloud Console and create/select a project')} — <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-link hover:text-link-hover">console.cloud.google.com</a></span>,
                tr('فعّل «Google Search Console API» من APIs & Services', 'Enable “Google Search Console API” in APIs & Services'),
                tr('أنشئ بيانات اعتماد OAuth 2.0 من نوع Web Application', 'Create OAuth 2.0 credentials → Web Application'),
                tr('أضف رابط إعادة التوجيه أدناه إلى Authorized redirect URIs', 'Add the redirect URI below to Authorized redirect URIs'),
                tr('أضف GOOGLE_CLIENT_ID وGOOGLE_CLIENT_SECRET إلى متغيرات البيئة في Netlify', 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Netlify environment variables'),
              ]} />
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs text-muted">{tr('رابط إعادة التوجيه', 'Redirect URI')}</p>
                <div className="mt-1 flex items-center gap-2"><code dir="ltr" className="min-w-0 flex-1 break-all font-mono text-xs text-link">{redirectUri}</code><CopyButton text={redirectUri} /></div>
              </div>
              <Notice tone="warning">{tr('إن لم يُضبط GOOGLE_CLIENT_ID أو GOOGLE_CLIENT_SECRET سيفشل الربط — أضفهما في Netlify.', 'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET makes connecting fail — add them in Netlify.')}</Notice>
            </div>
          </div>
        )}
        {connected && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {s.gscSites.length > 0 ? (
              <Select className="flex-1" aria-label={tr('الموقع', 'Site')} value={s.gscSite} onChange={e => s.setGscSite(e.target.value)} options={s.gscSites.map((x: any) => ({ value: x.siteUrl, label: x.siteUrl }))} />
            ) : (
              <Input dir="ltr" wrapperClassName="flex-1 min-w-[220px]" aria-label={tr('رابط الموقع', 'Site URL')} value={s.gscSite} onChange={e => s.setGscSite(e.target.value)} placeholder="https://waabek.com/" />
            )}
            <Select aria-label={tr('الفترة', 'Range')} value={s.gscRange} onChange={e => s.setGscRange(e.target.value)} className="sm:w-44" options={[
              { value: '7', label: tr('آخر 7 أيام', 'Last 7 days') }, { value: '28', label: tr('آخر 28 يومًا', 'Last 28 days') },
              { value: '90', label: tr('آخر 90 يومًا', 'Last 90 days') }, { value: '180', label: tr('آخر 6 أشهر', 'Last 6 months') },
            ]} />
            <Button icon={ChartBarIcon} loading={s.gscLoading} onClick={() => { s.loadGscData(); s.loadGscSites() }}>{tr('تحميل البيانات', 'Load data')}</Button>
          </div>
        )}
      </SeoCard>

      {connected && (s.gscLoading && !s.gscSummary ? (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-card" />)}</div>
      ) : !s.gscData ? (
        <EmptyState variant="card" icon={ChartBarIcon} title={tr('لم تُحمَّل البيانات بعد', 'No data loaded yet')} description={tr('اضغط «تحميل البيانات» لجلب بيانات Search Console الفعلية.', 'Click “Load data” to fetch your real Search Console data.')} />
      ) : (
        <>
          {s.gscSummary && (
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
              <StatCard icon={CursorArrowRaysIcon} label={tr('النقرات', 'Clicks')} value={formatNumber(s.gscSummary.clicks)} sparkline={chart.length > 1 ? chart.map(d => d.clicks) : undefined} />
              <StatCard icon={EyeIcon} label={tr('مرات الظهور', 'Impressions')} value={formatNumber(s.gscSummary.impressions)} />
              <StatCard icon={ChartBarIcon} label={tr('متوسط نسبة النقر', 'Avg CTR')} value={<span dir="ltr">{s.gscSummary.ctr}%</span>} />
              <StatCard icon={TrophyIcon} label={tr('متوسط المركز', 'Avg position')} value={<span dir="ltr">#{s.gscSummary.position}</span>} />
            </div>
          )}
          {chart.length > 0 && (
            <SeoCard title={tr('النقرات عبر الزمن', 'Clicks over time')}>
              <AreaChart height={220} labels={chart.map(d => fmtShort(d.date))}
                series={[{ name: tr('نقرات', 'Clicks'), data: chart.map(d => d.clicks) }]}
                ariaLabel={tr('النقرات اليومية من Search Console', 'Daily clicks from Search Console')} />
            </SeoCard>
          )}
          <div className="grid gap-5 xl:grid-cols-2">
            <SeoCard padding="none" headerClassName="px-5 pt-5 sm:px-6" title={tr('أهم الاستعلامات', 'Top search queries')}>
              {s.gscData.length === 0 ? <p className="px-5 pb-5 text-sm text-muted sm:px-6">{tr('لا توجد استعلامات في هذه الفترة', 'No queries in this range')}</p> : (
                <Table minWidth={480} dense caption={tr('أهم الاستعلامات', 'Top queries')}>
                  <THead><TR><TH>{tr('الاستعلام', 'Query')}</TH><TH align="end">{tr('نقرات', 'Clicks')}</TH><TH align="end">{tr('ظهور', 'Impr.')}</TH><TH align="end">CTR</TH><TH align="end">{tr('المركز', 'Pos.')}</TH></TR></THead>
                  <TBody>
                    {s.gscData.map((r: any, i: number) => (
                      <TR key={i}>
                        <TD><span dir="auto" className="block max-w-[200px] truncate text-ink">{r.query}</span></TD>
                        <TD align="end" className="tabular font-mono text-xs text-success">{formatNumber(r.clicks)}</TD>
                        <TD align="end" className="tabular font-mono text-xs text-muted">{formatNumber(r.impressions)}</TD>
                        <TD align="end"><span dir="ltr" className={cn('tabular font-mono text-xs', ctrTone(r.ctr))}>{r.ctr}%</span></TD>
                        <TD align="end"><span dir="ltr" className={cn('tabular font-mono text-xs', posTone(r.position))}>#{r.position}</span></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </SeoCard>
            <SeoCard title={tr('أهم الصفحات', 'Top pages')}>
              {s.gscPages.length === 0 ? <p className="text-sm text-muted">{tr('لا توجد صفحات', 'No pages')}</p> : (
                <ul className="space-y-2">
                  {s.gscPages.map((r: any, i: number) => (
                    <li key={i}>
                      <ListRow end={<a href={r.page} target="_blank" rel="noopener noreferrer" aria-label={tr('فتح', 'Open')} className="text-muted hover:text-ink"><ArrowTopRightOnSquareIcon className="h-4 w-4" /></a>}>
                        <p dir="ltr" className="truncate text-start font-mono text-xs text-link">{r.page}</p>
                        <div dir="ltr" className="mt-1 flex flex-wrap gap-3 text-2xs">
                          <span className="text-success">{formatNumber(r.clicks)} clicks</span>
                          <span className="text-muted">{formatNumber(r.impressions)} impr</span>
                          <span className={ctrTone(r.ctr)}>{r.ctr}% CTR</span>
                          <span className={posTone(r.position)}>#{r.position}</span>
                        </div>
                      </ListRow>
                    </li>
                  ))}
                </ul>
              )}
            </SeoCard>
          </div>
          {ctrOps.length > 0 && (
            <SeoCard title={tr('فرص تحسين نسبة النقر', 'CTR improvement opportunities')} subtitle={tr('استعلامات بظهور مرتفع ونقر منخفض — حسّن العنوان والوصف لها.', 'High impressions but low CTR — improve the title and meta for these.')}>
              <ul className="space-y-2">
                {ctrOps.map((r: any, i: number) => (
                  <li key={i}>
                    <ListRow end={<Badge size="sm" tone="warning"><span dir="ltr">{formatNumber(r.impressions)} · {r.ctr}% · #{r.position}</span></Badge>}>
                      <p dir="auto" className="text-sm text-ink">“{r.query}”</p>
                      <p className="text-2xs text-muted">{tr(`المركز #${r.position} لكن نسبة النقر ${r.ctr}% فقط — اجعل العنوان والوصف أكثر جاذبية لهذا الاستعلام.`, `Rank #${r.position} but only ${r.ctr}% click-through — make the title and meta more compelling for this query.`)}</p>
                    </ListRow>
                  </li>
                ))}
              </ul>
            </SeoCard>
          )}
        </>
      ))}
    </div>
  )
}
