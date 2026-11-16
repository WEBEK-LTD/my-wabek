/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { ArrowTopRightOnSquareIcon, ChartBarIcon, CursorArrowRaysIcon, EyeIcon, LinkIcon, LinkSlashIcon, MagnifyingGlassCircleIcon, TrophyIcon } from '@heroicons/react/24/outline'
import { AreaChart, Badge, Button, EmptyState, Input, Select, Skeleton, StatCard, Table, TBody, TD, TH, THead, TR, cn } from '@/components/ui'
import { useAdminT } from '../../i18n'
import { CopyButton, Notice, Steps } from '../../shared'
import type { SeoState } from '../useSeoAdmin'
import { ListRow, SeoCard } from '../ui'
import messages from '@/locales/admin/seo/gsc'

const ctrTone = (c: number) => (c > 5 ? 'text-success' : c > 2 ? 'text-warning' : 'text-danger')
const posTone = (p: number) => (p <= 5 ? 'text-success' : p <= 15 ? 'text-warning' : 'text-danger')

export function GscTab({ s }: { s: SeoState }) {
  const { t, fmtShort, fmtNumber, tn } = useAdminT(messages)
  const connected = !!s.gscStatus?.connected
  const redirectUri = (typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com') + '/api/admin/gsc-callback'
  const chart = (s.gscSummary?.chart || []) as { date: string; clicks: number; impressions?: number }[]
  const ctrOps = (s.gscData || []).filter((r: any) => r.impressions > 500 && r.ctr < 3)

  return (
    <div className="space-y-5">
      <SeoCard icon={MagnifyingGlassCircleIcon} title="Google Search Console" subtitle={t('realDataClicksImpressions')}
        action={connected ? (
          <div className="flex items-center gap-3">
            <div className="text-end"><Badge tone="success" dot size="sm">{t('connected')}</Badge><p dir="ltr" className="mt-0.5 text-2xs text-muted">{s.gscStatus.email}</p></div>
            <Button size="sm" variant="danger-soft" icon={LinkSlashIcon} onClick={s.disconnectGsc}>{t('disconnect')}</Button>
          </div>
        ) : <Button icon={LinkIcon} loading={s.gscConnecting} onClick={s.connectGsc}>{t('connectSearchConsole')}</Button>}>
        {!connected && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-line-soft bg-surface-2 p-4">
              <p className="text-sm font-semibold text-ink">{t('setupRequiredBeforeConnecting')}</p>
              <Steps items={[
                <span key="1">{t('openGoogleCloudConsole')} — <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-link hover:text-link-hover">console.cloud.google.com</a></span>,
                t('enableGoogleSearchConsole'),
                t('createOauth20'),
                t('addRedirectUriBelow'),
                t('addGoogleClientId'),
              ]} />
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs text-muted">{t('redirectUri')}</p>
                <div className="mt-1 flex items-center gap-2"><code dir="ltr" className="min-w-0 flex-1 break-all font-mono text-xs text-link">{redirectUri}</code><CopyButton text={redirectUri} /></div>
              </div>
              <Notice tone="warning">{t('missingGoogleClientId')}</Notice>
            </div>
          </div>
        )}
        {connected && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {s.gscSites.length > 0 ? (
              <Select className="flex-1" aria-label={t('site')} value={s.gscSite} onChange={e => s.setGscSite(e.target.value)} options={s.gscSites.map((x: any) => ({ value: x.siteUrl, label: x.siteUrl }))} />
            ) : (
              <Input dir="ltr" wrapperClassName="flex-1 min-w-[220px]" aria-label={t('siteUrl')} value={s.gscSite} onChange={e => s.setGscSite(e.target.value)} placeholder="https://waabek.com/" />
            )}
            <Select aria-label={t('range')} value={s.gscRange} onChange={e => s.setGscRange(e.target.value)} className="sm:w-44" options={[
              { value: '7', label: t('last7Days') }, { value: '28', label: t('last28Days') },
              { value: '90', label: t('last90Days') }, { value: '180', label: t('last6Months') },
            ]} />
            <Button icon={ChartBarIcon} loading={s.gscLoading} onClick={() => { s.loadGscData(); s.loadGscSites() }}>{t('loadData')}</Button>
          </div>
        )}
      </SeoCard>

      {connected && (s.gscLoading && !s.gscSummary ? (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-card" />)}</div>
      ) : !s.gscData ? (
        <EmptyState variant="card" icon={ChartBarIcon} title={t('noDataLoadedYet')} description={t('clickLoadDataFetch')} />
      ) : (
        <>
          {s.gscSummary && (
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
              <StatCard icon={CursorArrowRaysIcon} label={t('clicks')} value={fmtNumber(s.gscSummary.clicks)} sparkline={chart.length > 1 ? chart.map(d => d.clicks) : undefined} />
              <StatCard icon={EyeIcon} label={t('impressions')} value={fmtNumber(s.gscSummary.impressions)} />
              <StatCard icon={ChartBarIcon} label={t('avgCtr')} value={<span dir="ltr">{s.gscSummary.ctr}%</span>} />
              <StatCard icon={TrophyIcon} label={t('avgPosition')} value={<span dir="ltr">#{s.gscSummary.position}</span>} />
            </div>
          )}
          {chart.length > 0 && (
            <SeoCard title={t('clicksOverTime')}>
              <AreaChart height={220} labels={chart.map(d => fmtShort(d.date))}
                series={[{ name: t('clicks2'), data: chart.map(d => d.clicks) }]}
                ariaLabel={t('dailyClicksSearchConsole')} />
            </SeoCard>
          )}
          <div className="grid gap-5 xl:grid-cols-2">
            <SeoCard padding="none" headerClassName="px-5 pt-5 sm:px-6" title={t('topSearchQueries')}>
              {s.gscData.length === 0 ? <p className="px-5 pb-5 text-sm text-muted sm:px-6">{t('noQueriesRange')}</p> : (
                <Table minWidth={480} dense caption={t('topQueries')}>
                  <THead><TR><TH>{t('query')}</TH><TH align="end">{t('clicks2')}</TH><TH align="end">{t('impr')}</TH><TH align="end">CTR</TH><TH align="end">{t('pos')}</TH></TR></THead>
                  <TBody>
                    {s.gscData.map((r: any, i: number) => (
                      <TR key={i}>
                        <TD><span dir="auto" className="block max-w-[200px] truncate text-ink">{r.query}</span></TD>
                        <TD align="end" className="tabular font-mono text-xs text-success">{fmtNumber(r.clicks)}</TD>
                        <TD align="end" className="tabular font-mono text-xs text-muted">{fmtNumber(r.impressions)}</TD>
                        <TD align="end"><span dir="ltr" className={cn('tabular font-mono text-xs', ctrTone(r.ctr))}>{r.ctr}%</span></TD>
                        <TD align="end"><span dir="ltr" className={cn('tabular font-mono text-xs', posTone(r.position))}>#{r.position}</span></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </SeoCard>
            <SeoCard title={t('topPages')}>
              {s.gscPages.length === 0 ? <p className="text-sm text-muted">{t('noPages')}</p> : (
                <ul className="space-y-2">
                  {s.gscPages.map((r: any, i: number) => (
                    <li key={i}>
                      <ListRow end={<a href={r.page} target="_blank" rel="noopener noreferrer" aria-label={t('open')} className="text-muted hover:text-ink"><ArrowTopRightOnSquareIcon className="h-4 w-4" /></a>}>
                        <p dir="ltr" className="truncate text-start font-mono text-xs text-link">{r.page}</p>
                        <div dir="ltr" className="mt-1 flex flex-wrap gap-3 text-2xs">
                          <span className="text-success">{tn('clickCount', r.clicks, { n: fmtNumber(r.clicks) })}</span>
                          <span className="text-muted">{t('impressionCount', { n: fmtNumber(r.impressions) })}</span>
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
            <SeoCard title={t('ctrImprovementOpportunities')} subtitle={t('highImpressionsButLow')}>
              <ul className="space-y-2">
                {ctrOps.map((r: any, i: number) => (
                  <li key={i}>
                    <ListRow end={<Badge size="sm" tone="warning"><span dir="ltr">{fmtNumber(r.impressions)} · {r.ctr}% · #{r.position}</span></Badge>}>
                      <p dir="auto" className="text-sm text-ink">“{r.query}”</p>
                      <p className="text-2xs text-muted">{t('rankButOnlyClick', { position: r.position, ctr: r.ctr })}</p>
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
