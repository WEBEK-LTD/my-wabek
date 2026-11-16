import React from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import {
  ArrowTrendingUpIcon, ClipboardDocumentCheckIcon, DocumentMagnifyingGlassIcon, ExclamationTriangleIcon, GlobeAltIcon,
  MagnifyingGlassIcon, PresentationChartLineIcon, SparklesIcon, TagIcon,
} from '@heroicons/react/24/outline'
import { Button, PageHeader, StatCard, Tabs, formatNumber } from '@/components/ui'
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

type Group = { id: string; label: string; icon: React.ElementType; tabs: { id: string; label: string }[] }

export default function SeoAdminPage() {
  const { tr } = useAdminT()
  const s = useSeoAdmin()

  // 19 tools grouped in five areas; `s.tab` stays the leaf id so deep jumps (e.g. to "gsc") keep working.
  const groups: Group[] = [
    { id: 'overview', label: tr('نظرة عامة', 'Overview'), icon: PresentationChartLineIcon, tabs: [{ id: 'overview', label: tr('نظرة عامة', 'Overview') }] },
    {
      id: 'audit', label: tr('التدقيق', 'Audit'), icon: DocumentMagnifyingGlassIcon, tabs: [
        { id: 'pages', label: tr('محلل الصفحات', 'Page analyzer') }, { id: 'content', label: tr('المحتوى', 'Content SEO') },
        { id: 'crawl', label: tr('مراقبة الفحص', 'Crawl monitor') }, { id: 'speed', label: tr('مؤشرات الأداء', 'Core Web Vitals') },
        { id: 'links', label: tr('الروابط الداخلية', 'Internal links') },
      ],
    },
    {
      id: 'onpage', label: tr('داخل الصفحة', 'On-page'), icon: TagIcon, tabs: [
        { id: 'meta', label: tr('وسوم Meta', 'Meta tags') }, { id: 'og', label: 'Open Graph' }, { id: 'schema', label: tr('البيانات المنظمة', 'Structured data') },
        { id: 'sitemap', label: tr('خريطة الموقع', 'Sitemap') }, { id: 'technical', label: tr('تقني', 'Technical') }, { id: 'analytics', label: tr('التحليلات', 'Analytics') },
      ],
    },
    {
      id: 'growth', label: tr('البحث والنمو', 'Search & growth'), icon: ArrowTrendingUpIcon, tabs: [
        { id: 'gsc', label: 'Search Console' }, { id: 'keywords', label: tr('الكلمات المفتاحية', 'Keywords') }, { id: 'rank', label: tr('متتبّع الترتيب', 'Rank tracker') },
        { id: 'competitors', label: tr('المنافسون', 'Competitors') }, { id: 'backlinks', label: tr('الروابط الخلفية', 'Backlinks') }, { id: 'redirects', label: tr('التحويلات', 'Redirects') },
      ],
    },
    { id: 'ai', label: tr('المساعد الذكي', 'AI assistant'), icon: SparklesIcon, tabs: [{ id: 'ai', label: tr('المساعد الذكي', 'AI assistant') }] },
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
    <AdminLayout title={tr('إدارة SEO', 'SEO manager')}>
      <PageHeader
        eyebrow="SEO"
        title={tr('إدارة SEO', 'SEO manager')}
        description={tr('حلّل صفحاتك، وحسّن الوسوم والمحتوى، وتابع ظهورك في Google من مكان واحد.', 'Analyze pages, improve tags and content, and track your Google presence in one place.')}
        actions={<>
          <Button variant="secondary" icon={MagnifyingGlassIcon} loading={s.analyzeAll} onClick={s.runAnalyzeAll}>{tr('تحليل كل الصفحات', 'Analyze all pages')}</Button>
          <Button loading={s.saving} disabled={!s.formLoaded} onClick={() => s.save()}>{tr('حفظ الإعدادات', 'Save settings')}</Button>
        </>}
      >
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          <Tabs idPrefix="seo-group" value={group.id} onChange={pickGroup} aria-label={tr('أقسام SEO', 'SEO areas')}
            tabs={groups.map(g => ({ id: g.id, label: g.label, icon: g.icon }))} />
        </div>
      </PageHeader>

      <div className="mb-5 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <div className="flex items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-card">
          <ScoreRing value={s.avgScore} size={64} label={tr('درجة SEO', 'SEO score')} />
          <div>
            <p className="text-[13px] text-muted">{tr('متوسط درجة SEO', 'Average SEO score')}</p>
            <p className="text-xs text-muted">{s.analyzed ? tr(`من ${s.analyzed} صفحة محلَّلة`, `across ${s.analyzed} analyzed pages`) : tr('لم يبدأ التحليل', 'Not analyzed yet')}</p>
          </div>
        </div>
        <StatCard icon={ClipboardDocumentCheckIcon} label={tr('الصفحات المحلَّلة', 'Pages analyzed')} value={<span dir="ltr">{s.analyzed}<span className="text-lg text-muted"> / {PUBLIC_PAGES.length}</span></span>}
          progress={s.analyzed} progressMax={PUBLIC_PAGES.length} />
        <StatCard icon={GlobeAltIcon} label={tr('صفحات مفهرسة', 'Pages indexed')} value={s.analyzed ? formatNumber(s.indexed) : '—'} sub={tr('جاهزة لـ Google', 'ready for Google')} subTone="success" />
        <StatCard icon={ExclamationTriangleIcon} label={tr('مشكلات مكتشفة', 'Issues found')} value={s.analyzed ? formatNumber(s.issues) : '—'} sub={tr('تحتاج إصلاحًا', 'need fixing')} subTone={s.issues > 10 ? 'danger' : 'warning'} />
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
