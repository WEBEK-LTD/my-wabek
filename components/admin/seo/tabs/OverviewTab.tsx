import React from 'react'
import { ArrowTopRightOnSquareIcon, MagnifyingGlassIcon, RocketLaunchIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/20/solid'
import { Button, EmptyState, ProgressBar, cn } from '@/components/ui'
import { useAdminT } from '../../i18n'
import { ScoreRing } from '../../shared'
import { PUBLIC_PAGES } from '../data'
import type { SeoState } from '../useSeoAdmin'
import { PriorityBadge, ScoreBadge, SeoCard, usePageLabel } from '../ui'
import messages from '@/locales/admin/seo/overview'

export function OverviewTab({ s }: { s: SeoState }) {
  const { t } = useAdminT(messages)
  const pageLabel = usePageLabel()
  const f = s.form as Record<string, unknown>
  const actions = [
    { p: 'HIGH', t: t('submitSitemapGoogleSearch'), url: 'https://search.google.com/search-console', done: !!s.gscStatus?.connected },
    { p: 'HIGH', t: t('addGoogleAnalytics4'), go: 'analytics', done: !!f.ga_id },
    { p: 'HIGH', t: t('connectGoogleSearchConsole'), go: 'gsc', done: !!s.gscStatus?.connected },
    { p: 'HIGH', t: t('saveOrganizationJsonLd'), go: 'schema', done: !!f.schema_organization },
    { p: 'HIGH', t: t('setGlobalMetaTitle'), go: 'meta', done: !!(f.site_title && f.site_description) },
    { p: 'MEDIUM', t: t('createOgImage1200x630px'), go: 'og', done: !!f.og_image },
    { p: 'MEDIUM', t: t('addCanonicalDomainPrevent'), go: 'meta', done: !!f.canonical },
    { p: 'MEDIUM', t: t('runFullPageAnalysis'), go: 'pages', done: Object.keys(s.pageScores).length >= 5 },
    { p: 'MEDIUM', t: t('runSiteCrawlFind'), go: 'crawl', done: s.crawlResults.length > 0 },
    { p: 'MEDIUM', t: t('listG2CapterraProduct'), go: 'backlinks', done: false },
    { p: 'LOW', t: t('optimizeImageAltTags'), go: 'content', done: !Object.values(s.pageScores).some((p: { imgWithoutAlt?: number }) => (p?.imgWithoutAlt || 0) > 0) },
    { p: 'LOW', t: t('addFaqSchemaHomepage'), go: 'schema', done: !!f.schema_faqpage },
    { p: 'LOW', t: t('saveKeywordRankSnapshot'), go: 'rank', done: Object.keys(s.rankHistory).length > 0 },
  ]
  const done = actions.filter(a => a.done).length

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" title={t('pageHealth')} subtitle={t('barsTitleMetaH1')}>
        {!s.analyzed ? (
          <EmptyState size="sm" icon={MagnifyingGlassIcon} title={t('noPagesAnalyzedYet')} description={t('runAnalysisGetReal')}
            action={<Button size="sm" loading={s.analyzeAll} onClick={s.runAnalyzeAll}>{t('startAnalysis')}</Button>} />
        ) : (
          <ul className="space-y-2">
            {PUBLIC_PAGES.map(p => {
              const sc = s.pageScores[p.path]
              const label = pageLabel(p)
              if (!sc || sc.error) return (
                <li key={p.path} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 opacity-60">
                  <ScoreRing value={null} size={36} />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">{label}</span>
                  <span className="text-xs text-muted">{sc?.error ? t('fetchFailed') : t('notAnalyzed')}</span>
                </li>
              )
              return (
                <li key={p.path} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                  <ScoreRing value={sc.score} size={36} label={label} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{label}</p>
                    <p dir="ltr" className="truncate text-start font-mono text-2xs text-muted">{p.path}</p>
                  </div>
                  <div className="hidden items-end gap-1 sm:flex" aria-hidden="true">
                    {[sc.title, sc.meta, sc.h1, sc.speed, sc.mobile].map((v: number, i: number) => (
                      <span key={i} className="flex h-6 w-1.5 items-end overflow-hidden rounded-full bg-track">
                        <span className={cn('w-full rounded-full', v >= 80 ? 'bg-success' : v >= 60 ? 'bg-warning' : 'bg-danger')} style={{ height: `${Math.max(0, Math.min(100, v || 0))}%` }} />
                      </span>
                    ))}
                  </div>
                  <ScoreBadge score={sc.score} />
                  <span className={cn('text-xs', sc.indexed ? 'text-success' : 'text-danger')}>{sc.indexed ? t('indexed') : t('notIndexed')}</span>
                </li>
              )
            })}
          </ul>
        )}
      </SeoCard>

      <SeoCard className="xl:col-span-2" icon={RocketLaunchIcon} title={t('priorityActions')} subtitle={t('done', { done, actionsCount: actions.length })}>
        <ProgressBar value={done} max={actions.length} size="sm" aria-label={t('progress')} />
        <ul className="space-y-2">
          {actions.map((a, i) => (
            <li key={i} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5">
              {a.done ? <CheckCircleIcon className="h-5 w-5 shrink-0 text-success" aria-hidden="true" /> : <PriorityBadge p={a.p} />}
              <p className={cn('min-w-0 flex-1 text-sm', a.done ? 'text-muted line-through' : 'text-ink')}>{a.t}</p>
              {!a.done && (a.url
                ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-link hover:text-link-hover">{t('go')}<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" /></a>
                : a.go ? <button type="button" onClick={() => s.setTab(a.go!)} className="shrink-0 text-xs font-medium text-link hover:text-link-hover">{t('openAlt')}</button> : null)}
            </li>
          ))}
        </ul>
      </SeoCard>
    </div>
  )
}
