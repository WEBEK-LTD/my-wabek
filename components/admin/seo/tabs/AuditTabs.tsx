/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import {
  ArrowPathIcon, ArrowTopRightOnSquareIcon, BoltIcon, BugAntIcon, DocumentMagnifyingGlassIcon, ExclamationTriangleIcon, GlobeAltIcon, LinkIcon, MagnifyingGlassIcon, ShareIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, EmptyState, StatCard, Tooltip, cn } from '@/components/ui'
import { useAdminT } from '../../i18n'
import { Notice, ScoreRing } from '../../shared'
import { PUBLIC_PAGES, type PublicPage } from '../data'
import type { SeoState } from '../useSeoAdmin'
import { Check, ListRow, Meter, ScoreBadge, SeoCard, SerpPreview, usePageLabel } from '../ui'
import messages from '@/locales/admin/seo/audit'

function PageHead({ page, children, extra }: { page: PublicPage; children?: React.ReactNode; extra?: React.ReactNode }) {
  const { t } = useAdminT(messages)
  const label = usePageLabel()
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{label(page)}</h3>{extra}</div>
        <p dir="ltr" className="text-start font-mono text-xs text-muted">{page.path}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {children}
        <Tooltip content={t('openPage')}><Button size="icon-sm" variant="ghost" icon={ArrowTopRightOnSquareIcon} href={page.path} external aria-label={t('openAlt', { page: label(page) })} /></Tooltip>
      </div>
    </div>
  )
}

/* ── Page analyzer ── */
export function PagesTab({ s }: { s: SeoState }) {
  const { t, tn } = useAdminT(messages)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('liveAnalysisDeployedPages')}</p>
        <Button size="sm" variant="secondary" icon={ArrowPathIcon} loading={s.analyzeAll} onClick={s.runAnalyzeAll}>{t('analyzeAll')}</Button>
      </div>
      {PUBLIC_PAGES.map(page => {
        const sc = s.pageScores[page.path]
        const busy = s.analyzing === page.path
        return (
          <Card key={page.path} className="space-y-4">
            <PageHead page={page} extra={sc && !sc.error ? <><ScoreBadge score={sc.score} /><Badge size="sm" tone={sc.indexed ? 'success' : 'danger'}>{sc.indexed ? t('indexed') : t('notIndexed')}</Badge></> : undefined}>
              {sc && !sc.error && <ScoreRing value={sc.score} size={48} />}
              <Button size="sm" variant="secondary" icon={sc ? ArrowPathIcon : MagnifyingGlassIcon} loading={busy} onClick={() => s.analyzePage(page.path)}>{sc ? t('reRun') : t('analyze')}</Button>
            </PageHead>
            {sc?.error && <Notice tone="danger" icon={ExclamationTriangleIcon}>{(sc.issues || []).join(' · ')}</Notice>}
            {sc && !sc.error && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Meter label={t('title')} value={sc.title} detail={sc.titleLen ? t('chars', { titleLen: sc.titleLen }) : undefined} />
                  <Meter label={t('metaDesc')} value={sc.meta} detail={sc.metaLen ? t('chars2', { metaLen: sc.metaLen }) : undefined} />
                  <Meter label="H1" value={sc.h1} detail={sc.h1Count !== undefined ? t('found', { h1Count: sc.h1Count }) : undefined} />
                  <Meter label={t('speed')} value={sc.speed} detail={sc.sizeKB ? `${sc.sizeKB}KB` : undefined} />
                  <Meter label={t('mobile')} value={sc.mobile} detail="Viewport" />
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Check ok={!!sc.hasCanonical} label={t('canonicalUrl')} />
                  <Check ok={!!sc.hasOgImage} label={t('ogImage')} />
                  <Check ok={!!sc.hasStructuredData} label={t('structuredData')} />
                  <Check ok={!sc.imgWithoutAlt} label={t('altText')} />
                </div>
                {sc.issues?.length > 0 && (
                  <Notice tone="danger" icon={ExclamationTriangleIcon} title={tn('issuesFound', sc.issues.length, { n: sc.issues.length })}>
                    <ul className="mt-1 list-disc space-y-0.5 ps-4">{sc.issues.map((iss: string, i: number) => <li key={i}>{iss}</li>)}</ul>
                  </Notice>
                )}
              </>
            )}
          </Card>
        )
      })}
    </div>
  )
}

/* ── Content SEO ── */
export function ContentTab({ s }: { s: SeoState }) {
  const { t, fmtNumber, tn } = useAdminT(messages)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('fetchesRealHtmlChecks')}</p>
        <Button size="sm" variant="secondary" icon={ArrowPathIcon} loading={s.parseAll} onClick={s.runParseAll}>{t('parseAllPages')}</Button>
      </div>
      {PUBLIC_PAGES.slice(0, 7).map(page => {
        const d = s.parsedPages[page.path]
        const busy = s.parsing === page.path
        const topKws = d?.keywords ? Object.entries(d.keywords).slice(0, 8) : []
        const noAlt = d?.images ? d.images.filter((img: any) => !img.hasAlt).length : 0
        return (
          <Card key={page.path} className="space-y-4">
            <PageHead page={page} extra={d && !d.error ? <>
              <Badge size="sm" tone="neutral" className="tabular">{tn('wordCount', d.wordCount, { n: fmtNumber(d.wordCount) })}</Badge>
              <Badge size="sm" tone={d.readabilityScore > 70 ? 'success' : 'warning'}>{t('readability')} {d.readabilityScore}/100</Badge>
            </> : undefined}>
              <Button size="sm" variant="secondary" icon={d ? ArrowPathIcon : DocumentMagnifyingGlassIcon} loading={busy} onClick={() => s.parsePage(page.path)}>{d ? t('reRun') : t('parse')}</Button>
            </PageHead>

            {d && !d.error && (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[{ label: 'H1', items: d.h1 || [], good: (d.h1 || []).length === 1 }, { label: 'H2', items: d.h2 || [], good: (d.h2 || []).length > 0 }, { label: 'H3', items: d.h3 || [], good: true }].map(h => (
                    <div key={h.label} className="rounded-xl bg-surface-2 p-3">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className={cn('text-xs font-bold', h.good ? 'text-success' : 'text-danger')}>{h.label}</span>
                        <span className="tabular text-xs text-muted">({h.items.length})</span>
                      </div>
                      {h.items.slice(0, 2).map((item: string, i: number) => <p key={i} dir="auto" className="truncate text-xs text-body">{item}</p>)}
                      {!h.items.length && <p className="text-xs text-danger">{t('noneFound')}</p>}
                    </div>
                  ))}
                </div>
                <ListRow end={<span className={cn('text-xs', noAlt ? 'text-danger' : 'text-success')}>{noAlt ? tn('imagesNoAlt', noAlt, { n: noAlt }) : t('allImagesHaveAlt')}</span>}>
                  <span className="text-xs text-muted">{t('images')} <span className="tabular font-medium text-ink">{(d.images || []).length}</span></span>
                </ListRow>
                {topKws.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs text-muted">{t('topKeywordsPage')}</p>
                    <div className="flex flex-wrap gap-1.5">{topKws.map(([kw, density]: [string, any]) => <Badge key={kw} size="sm" tone="neutral"><span dir="auto">{kw}</span> <span className="tabular opacity-70">{density}%</span></Badge>)}</div>
                  </div>
                )}
                {(d.title || d.metaDescription) && (
                  <div className="space-y-1.5">
                    <SerpPreview title={d.title} url={`waabek.com${page.path}`} description={d.metaDescription} />
                    <div className="flex gap-3 text-2xs">
                      <span className={d.titleLen >= 30 && d.titleLen <= 60 ? 'text-success' : 'text-danger'}>{t('title2')} {d.titleLen}</span>
                      <span className={d.metaLen >= 120 && d.metaLen <= 160 ? 'text-success' : 'text-danger'}>{t('meta')} {d.metaLen}</span>
                    </div>
                  </div>
                )}
                <ul className="space-y-1 text-xs">
                  {(d.h1 || []).length === 0 && <li className="text-danger">{t('noH1TagAdd')}</li>}
                  {(d.h1 || []).length > 1 && <li className="text-warning">{t('multipleH1TagsUse', { h1Count: d.h1.length })}</li>}
                  {d.wordCount < 300 && <li className="text-warning">{t('lowWordCountAim', { wordCount: d.wordCount })}</li>}
                  {d.wordCount > 300 && (d.h2 || []).length === 0 && <li className="text-warning">{t('noH2SubheadingsAdd')}</li>}
                  {d.titleLen > 60 && <li className="text-warning">{t('titleTooLongGoogle', { titleLen: d.titleLen })}</li>}
                  {d.titleLen < 30 && d.titleLen > 0 && <li className="text-warning">{t('titleTooShortAim', { titleLen: d.titleLen })}</li>}
                  {d.metaLen < 100 && <li className="text-warning">{t('metaDescriptionTooShort', { metaLen: d.metaLen })}</li>}
                  {d.readabilityScore < 50 && <li className="text-warning">{t('lowReadability100Use', { readabilityScore: d.readabilityScore })}</li>}
                  {(d.h1 || []).length === 1 && d.wordCount >= 300 && d.titleLen >= 30 && d.titleLen <= 60 && <li className="text-success">{t('pageStructureLooksGood')}</li>}
                </ul>
              </>
            )}
            {d?.error && <Notice tone="danger" icon={ExclamationTriangleIcon}>{t('couldNotParsePage')} {d.error}</Notice>}
            {!d && !busy && <p className="text-xs text-muted">{t('clickParseAnalyzePage')}</p>}
          </Card>
        )
      })}
    </div>
  )
}

/* ── Crawl monitor ── */
export function CrawlTab({ s }: { s: SeoState }) {
  const { t, fmtNumber, tn } = useAdminT(messages)
  const pageLabel = usePageLabel()
  const rows = Array.isArray(s.crawlResults) ? s.crawlResults.filter(Boolean) : []
  return (
    <div className="space-y-5">
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3.5">
          <StatCard label={t('pagesOk')} value={fmtNumber(rows.filter(r => r.status === 200).length)} subTone="success" />
          <StatCard label={t('errors')} value={fmtNumber(rows.filter(r => r.status !== 200).length)} subTone="danger" />
          <StatCard label={t('totalIssues')} value={fmtNumber(rows.reduce((a, r) => a + (r?.issues || 0), 0))} />
        </div>
      )}
      <SeoCard icon={BugAntIcon} title={t('siteCrawlMonitor')} subtitle={t('crawlsPublicPagesDetects')}
        action={<Button size="sm" icon={BugAntIcon} loading={s.crawling} onClick={s.runCrawl}>{t('runFullCrawl')}</Button>}>
        {rows.length === 0 ? (
          <EmptyState size="sm" icon={BugAntIcon} title={t('noCrawlResultsYet')} description={t('runCrawlAnalyzeAll')} />
        ) : (
          <ul className="space-y-2">
            {rows.map((r: any, i: number) => {
              const bad = r.status === 404 || r.status === 'error'
              return (
                <li key={i} className={cn('flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5', bad ? 'border border-danger/25 bg-danger-bg' : 'bg-surface-2')}>
                  <Badge size="sm" tone={r.status === 200 ? 'success' : r.status === 404 ? 'danger' : 'neutral'}><span dir="ltr">{r.status}</span></Badge>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm text-ink">{pageLabel(r)}</p><p dir="ltr" className="text-start font-mono text-2xs text-muted">{r.path}</p></div>
                  <div className="flex flex-wrap gap-1.5 text-2xs">
                    {r.score > 0 && !isNaN(r.score) && <Badge size="sm" tone={r.score >= 80 ? 'success' : r.score >= 60 ? 'warning' : 'danger'}>SEO {Math.round(r.score)}</Badge>}
                    {r.issues > 0 && <Badge size="sm" tone="warning">{tn('issueCount', r.issues, { n: r.issues })}</Badge>}
                    {!!r.size && <Badge size="sm" tone="neutral">{r.size}KB</Badge>}
                    {r.hasCanonical === false && <Badge size="sm" tone="warning">{t('noCanonical')}</Badge>}
                    {r.hasStructuredData === false && <Badge size="sm" tone="violet">{t('noSchema')}</Badge>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SeoCard>
    </div>
  )
}

/* ── Core Web Vitals ── */
export function SpeedTab({ s }: { s: SeoState }) {
  const { t } = useAdminT(messages)
  const guide = [
    { check: t('useNextImageAutomatic'), impact: 'HIGH', effort: 'LOW' },
    { check: t('enableNetlifyAssetOptimization'), impact: 'HIGH', effort: 'LOW' },
    { check: t('preloadCriticalFontsEliminate'), impact: 'MEDIUM', effort: 'LOW' },
    { check: t('useDynamicImportsLarge'), impact: 'HIGH', effort: 'MEDIUM' },
    { check: t('removeUnusedCssTailwind'), impact: 'MEDIUM', effort: 'LOW' },
    { check: t('addResourceHintsDns'), impact: 'MEDIUM', effort: 'LOW' },
    { check: t('implementSwrCachingApi'), impact: 'HIGH', effort: 'MEDIUM' },
    { check: t('setExplicitWidthHeight'), impact: 'MEDIUM', effort: 'LOW' },
  ]
  return (
    <div className="space-y-5">
      <SeoCard icon={BoltIcon} title={t('coreWebVitals')} subtitle={t('realScoresGooglePagespeed')}>
        <div className="space-y-3">
          {PUBLIC_PAGES.slice(0, 7).map(page => {
            const d = s.speedData[page.path]
            return (
              <div key={page.path} className="space-y-3 rounded-xl border border-line-soft p-4">
                <PageHead page={page}>
                  <Button size="sm" variant="secondary" icon={d ? ArrowPathIcon : BoltIcon} loading={s.speedLoading === page.path} onClick={() => s.checkSpeed(page.path)}>{d ? t('reCheck') : t('analyze')}</Button>
                </PageHead>
                {d?.error && <Notice tone="danger" icon={ExclamationTriangleIcon}>{t('couldNotGetPagespeed')}{d.status ? ` (HTTP ${d.status})` : ''}</Notice>}
                {d && !d.error && (
                  <>
                    <div className="grid grid-cols-4 gap-2">
                      {[{ l: t('performance'), v: d.performance }, { l: 'SEO', v: d.seo }, { l: t('accessibility'), v: d.accessibility }, { l: t('bestPractices'), v: d.bestPractices }].map(m => (
                        <div key={m.l} className="flex flex-col items-center gap-1 rounded-xl bg-surface-2 p-2.5 text-center">
                          <ScoreRing value={m.v} size={48} good={90} fair={50} label={m.l} />
                          <span className="text-2xs text-muted">{m.l}</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ l: 'LCP', v: d.lcp, tip: t('should25s') }, { l: 'CLS', v: d.cls, tip: t('should01') }, { l: 'TTI', v: d.fid, tip: t('should38s') }].map(v => (
                        <div key={v.l} className="rounded-xl bg-surface-2 p-2.5 text-center">
                          <p dir="ltr" className="tabular text-sm font-bold text-ink">{v.v}</p>
                          <p className="text-2xs text-muted">{v.l} · {v.tip}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </SeoCard>
      <SeoCard title={t('performanceOptimizationGuide')}>
        <div className="space-y-2">
          {guide.map((g, i) => (
            <ListRow key={i} end={<div className="flex gap-1"><Badge size="sm" tone={g.impact === 'HIGH' ? 'success' : 'warning'}>{t('impact')}: {g.impact === 'HIGH' ? t('high') : t('medium')}</Badge><Badge size="sm" tone={g.effort === 'LOW' ? 'brand' : 'warning'}>{t('effort')}: {g.effort === 'LOW' ? t('low') : t('medium')}</Badge></div>}>
              <p className="text-sm text-ink">{g.check}</p>
            </ListRow>
          ))}
        </div>
      </SeoCard>
    </div>
  )
}

/* ── Internal links ── */
export function LinksTab({ s }: { s: SeoState }) {
  const { t } = useAdminT(messages)
  const label = usePageLabel()
  const pages = PUBLIC_PAGES.slice(0, 7)
  const parsed = s.parsedPages
  const has = Object.keys(parsed).length > 0

  const opportunities: { from: string; to: string }[] = []
  pages.forEach(fromPage => {
    const fromData = parsed[fromPage.path]
    if (!fromData) return
    pages.forEach(toPage => {
      if (fromPage.path === toPage.path) return
      const linked = fromData.links?.some((l: any) => l.href === toPage.path || l.href?.includes(toPage.path))
      if (linked) return
      const fromKws = Object.keys(fromData.keywords || {}).slice(0, 10)
      const toLabel = toPage.label.toLowerCase()
      if (fromKws.some(kw => toLabel.includes(kw) || kw.includes(toLabel.split(' ')[0]))) opportunities.push({ from: fromPage.path, to: toPage.path })
    })
  })
  const externals = Object.entries(parsed).flatMap(([path, d]: [string, any]) => (d?.links || []).filter((l: any) => l.isExternal).slice(0, 3).map((l: any) => ({ path, l }))).slice(0, 10)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('realLinkDetectionPage')}</p>
        <Button size="sm" variant="secondary" icon={ArrowPathIcon} loading={s.parseAll} onClick={s.runParseAll}>{t('crawlAllPages')}</Button>
      </div>
      {!has ? (
        <EmptyState variant="card" icon={ShareIcon} title={t('noLinkDataYet')} description={t('crawlPagesDetectReal')}
          action={<Button size="sm" loading={s.parseAll} onClick={s.runParseAll}>{t('startCrawl')}</Button>} />
      ) : (
        <>
          <SeoCard icon={ShareIcon} title={t('pageLinkMap')}>
            <ul className="space-y-2">
              {pages.map(page => {
                const d = parsed[page.path]
                if (!d || d.error) return (
                  <li key={page.path} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 opacity-70">
                    <p className="min-w-0 flex-1 text-sm text-muted">{label(page)} — {t('notParsedYet')}</p>
                    <Button size="xs" variant="secondary" loading={s.parsing === page.path} onClick={() => s.parsePage(page.path)}>{t('parse')}</Button>
                  </li>
                )
                const internal = (d.links || []).filter((l: any) => l.isInternal)
                const external = (d.links || []).filter((l: any) => l.isExternal)
                const inbound = pages.filter(p => { const pd = parsed[p.path]; return pd && p.path !== page.path && pd.links?.some((l: any) => l.href === page.path || l.href?.includes(page.path)) })
                const orphan = inbound.length === 0
                return (
                  <li key={page.path} className={cn('space-y-2 rounded-xl border p-3', orphan ? 'border-danger/25 bg-danger-bg/50' : 'border-line-soft bg-surface-2')}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {orphan && <Badge size="sm" tone="danger">{t('orphan')}</Badge>}
                          <p className="text-sm font-medium text-ink">{label(page)}</p>
                          <p dir="ltr" className="font-mono text-2xs text-muted">{page.path}</p>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                          <span>{t('internalOut', { internalCount: internal.length })}</span>
                          <span>{t('externalOut', { externalCount: external.length })}</span>
                          <span className={orphan ? 'text-danger' : 'text-success'}>{t('inbound', { inboundCount: inbound.length })}</span>
                        </div>
                        {orphan && <p className="mt-1 text-xs text-danger">{t('noOtherPageLinks')}</p>}
                      </div>
                      <Button size="icon-sm" variant="ghost" icon={ArrowPathIcon} aria-label={t('reParse')} loading={s.parsing === page.path} onClick={() => s.parsePage(page.path)} />
                    </div>
                    {internal.length > 0 && (
                      <div className="flex flex-wrap gap-1" dir="ltr">
                        {internal.slice(0, 6).map((l: any, i: number) => <span key={i} className="rounded-md bg-chip px-1.5 py-0.5 font-mono text-2xs text-chip-ink">{l.href?.slice(0, 25)}</span>)}
                        {internal.length > 6 && <span className="text-2xs text-muted">+{internal.length - 6}</span>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </SeoCard>
          <div className="grid gap-5 lg:grid-cols-2">
            <SeoCard icon={LinkIcon} title={t('internalLinkOpportunities')}>
              {opportunities.length === 0 ? <p className="text-sm text-success">{t('noObviousOpportunitiesMissing')}</p> : (
                <ul className="space-y-2">
                  {opportunities.slice(0, 8).map((o, i) => (
                    <ListRow key={i}>
                      <p dir="ltr" className="text-start font-mono text-xs"><span className="text-link">{o.from}</span> → <span className="text-success">{o.to}</span></p>
                      <p className="text-2xs text-muted">{t('contentTopicsOverlapAdd')}</p>
                    </ListRow>
                  ))}
                </ul>
              )}
            </SeoCard>
            <SeoCard icon={GlobeAltIcon} title={t('externalLinksFound')}>
              {externals.length === 0 ? <p className="text-sm text-muted">{t('noExternalLinksDetected')}</p> : (
                <ul className="space-y-1.5">
                  {externals.map(({ path, l }, i) => (
                    <li key={path + i} dir="ltr" className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">
                      <span className="shrink-0 font-mono text-muted">{path}</span><span className="text-muted">→</span>
                      <span className="min-w-0 flex-1 truncate text-link">{l.href?.slice(0, 60)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SeoCard>
          </div>
        </>
      )}
    </div>
  )
}
