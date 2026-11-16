import React from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import {
  ArrowTrendingUpIcon, ClipboardDocumentCheckIcon, DocumentMagnifyingGlassIcon, ExclamationTriangleIcon, GlobeAltIcon,
  MagnifyingGlassIcon, PresentationChartLineIcon, SparklesIcon, TagIcon,
} from '@heroicons/react/24/outline'
import { Button, PageHeader, StatCard, Tabs } from '@/components/ui'
import { useAdminT } from '@/components/admin/i18n'
import { ScoreRing } from '@/components/admin/shared'
import { PUBLIC_PAGES } from '@/components/admin/seo/data'
import { useSeoAdmin } from '@/components/admin/seo/useSeoAdmin'
import { OverviewTab } from '@/components/admin/seo/tabs/OverviewTab'
import { ContentTab, CrawlTab, LinksTab, PagesTab, SpeedTab } from '@/components/admin/seo/tabs/AuditTabs'
import { AnalyticsTab, MetaTab, OgTab, SchemaTab, SitemapTab, TechnicalTab } from '@/components/admin/seo/tabs/OnPageTabs'
import { BacklinksTab, CompetitorsTab, KeywordsTab, RankTab, RedirectsTab } from '@/components/admin/seo/tabs/GrowthTabs'
import { GscTab } from '@/components/admin/seo/tabs/GscTab'
import { AiTab } from '@/components/admin/seo/tabs/AiTab'
import messages from '@/locales/admin/seo/page'

type Group = { id: string; label: string; icon: React.ElementType; tabs: { id: string; label: string }[] }

export default function SeoAdminPage() {
  const { t, fmtNumber } = useAdminT(messages)
  const s = useSeoAdmin()

  // 19 tools grouped in five areas; `s.tab` stays the leaf id so deep jumps (e.g. to "gsc") keep working.
  const groups: Group[] = [
    { id: 'overview', label: t('overview'), icon: PresentationChartLineIcon, tabs: [{ id: 'overview', label: t('overview') }] },
    {
      id: 'audit', label: t('audit'), icon: DocumentMagnifyingGlassIcon, tabs: [
        { id: 'pages', label: t('pageAnalyzer') }, { id: 'content', label: t('contentSeo') },
        { id: 'crawl', label: t('crawlMonitor') }, { id: 'speed', label: t('coreWebVitals') },
        { id: 'links', label: t('internalLinks') },
      ],
    },
    {
      id: 'onpage', label: t('page'), icon: TagIcon, tabs: [
        { id: 'meta', label: t('metaTags') }, { id: 'og', label: 'Open Graph' }, { id: 'schema', label: t('structuredData') },
        { id: 'sitemap', label: t('sitemap') }, { id: 'technical', label: t('technical') }, { id: 'analytics', label: t('analytics') },
      ],
    },
    {
      id: 'growth', label: t('searchGrowth'), icon: ArrowTrendingUpIcon, tabs: [
        { id: 'gsc', label: 'Search Console' }, { id: 'keywords', label: t('keywords') }, { id: 'rank', label: t('rankTracker') },
        { id: 'competitors', label: t('competitors') }, { id: 'backlinks', label: t('backlinks') }, { id: 'redirects', label: t('redirects') },
      ],
    },
    { id: 'ai', label: t('aiAssistant'), icon: SparklesIcon, tabs: [{ id: 'ai', label: t('aiAssistant') }] },
  ]
  const group = groups.find(g => g.tabs.some(t => t.id === s.tab)) || groups[0]
  const pickGroup = (id: string) => { const g = groups.find(x => x.id === id); if (g) s.setTab(g.tabs[0].id) }

  const panels: Record<string, React.ReactNode> = {
    overview: <OverviewTab s={s} />, pages: <PagesTab s={s} />, content: <ContentTab s={s} />, crawl: <CrawlTab s={s} />, speed: <SpeedTab s={s} />, links: <LinksTab s={s} />,
    meta: <MetaTab s={s} />, og: <OgTab s={s} />, schema: <SchemaTab s={s} />, sitemap: <SitemapTab s={s} />, technical: <TechnicalTab s={s} />, analytics: <AnalyticsTab s={s} />,
    gsc: <GscTab s={s} />, keywords: <KeywordsTab s={s} />, rank: <RankTab s={s} />, competitors: <CompetitorsTab s={s} />, backlinks: <BacklinksTab />, redirects: <RedirectsTab s={s} />,
    ai: <AiTab s={s} />,
  }

  return (
    <AdminLayout title={t('seoManager')}>
      <PageHeader className="mb-6"
        eyebrow="SEO"
        title={t('seoManager')}
        description={t('analyzePagesImproveTags')}
        actions={<>
          <Button variant="secondary" icon={MagnifyingGlassIcon} loading={s.analyzeAll} onClick={s.runAnalyzeAll}>{t('analyzeAllPages')}</Button>
          <Button loading={s.saving} disabled={!s.formLoaded} onClick={() => s.save()}>{t('saveSettings')}</Button>
        </>}
      >
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          <Tabs idPrefix="seo-group" value={group.id} onChange={pickGroup} aria-label={t('seoAreas')}
            tabs={groups.map(g => ({ id: g.id, label: g.label, icon: g.icon }))} />
        </div>
      </PageHeader>

      <div className="mb-5 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <div className="flex items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-card">
          <ScoreRing value={s.avgScore} size={64} label={t('seoScore')} />
          <div>
            <p className="text-[13px] text-muted">{t('averageSeoScore')}</p>
            <p className="text-xs text-muted">{s.analyzed ? t('acrossAnalyzedPages', { analyzed: s.analyzed }) : t('notAnalyzedYet')}</p>
          </div>
        </div>
        <StatCard icon={ClipboardDocumentCheckIcon} label={t('pagesAnalyzed')} value={<span dir="ltr">{s.analyzed}<span className="text-lg text-muted"> / {PUBLIC_PAGES.length}</span></span>}
          progress={s.analyzed} progressMax={PUBLIC_PAGES.length} />
        <StatCard icon={GlobeAltIcon} label={t('pagesIndexed')} value={s.analyzed ? fmtNumber(s.indexed) : '—'} sub={t('readyGoogle')} subTone="success" />
        <StatCard icon={ExclamationTriangleIcon} label={t('issuesFound')} value={s.analyzed ? fmtNumber(s.issues) : '—'} sub={t('needFixing')} subTone={s.issues > 10 ? 'danger' : 'warning'} />
      </div>

      {group.tabs.length > 1 && (
        <div className="-mx-4 mb-5 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          <Tabs idPrefix="seo" variant="pills" size="sm" value={s.tab} onChange={s.setTab} aria-label={group.label} tabs={group.tabs} />
        </div>
      )}

      <div role="tabpanel" id={group.tabs.length > 1 ? `seo-panel-${s.tab}` : `seo-group-panel-${group.id}`} aria-labelledby={group.tabs.length > 1 ? `seo-tab-${s.tab}` : `seo-group-tab-${group.id}`} className="animate-fade-in" key={s.tab}>
        {panels[s.tab] || panels.overview}
      </div>
    </AdminLayout>
  )
}
