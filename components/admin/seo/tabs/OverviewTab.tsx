import React from 'react'
import { ArrowTopRightOnSquareIcon, MagnifyingGlassIcon, RocketLaunchIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/20/solid'
import { Button, EmptyState, ProgressBar, cn } from '@/components/ui'
import { useAdminT } from '../../i18n'
import { ScoreRing } from '../../shared'
import { PUBLIC_PAGES } from '../data'
import type { SeoState } from '../useSeoAdmin'
import { PriorityBadge, ScoreBadge, SeoCard } from '../ui'

export function OverviewTab({ s }: { s: SeoState }) {
  const { tr, lang } = useAdminT()
  const f = s.form as Record<string, unknown>
  const actions = [
    { p: 'HIGH', t: tr('إرسال خريطة الموقع إلى Google Search Console', 'Submit sitemap to Google Search Console'), url: 'https://search.google.com/search-console', done: !!s.gscStatus?.connected },
    { p: 'HIGH', t: tr('إضافة تتبّع Google Analytics 4', 'Add Google Analytics 4 tracking'), go: 'analytics', done: !!f.ga_id },
    { p: 'HIGH', t: tr('ربط Google Search Console للحصول على بيانات حقيقية', 'Connect Google Search Console for real data'), go: 'gsc', done: !!s.gscStatus?.connected },
    { p: 'HIGH', t: tr('حفظ مخطط Organization (البيانات المنظمة)', 'Save Organization JSON-LD schema (Structured data)'), go: 'schema', done: !!f.schema_organization },
    { p: 'HIGH', t: tr('ضبط العنوان والوصف العامين (وسوم Meta)', 'Set global meta title & description (Meta tags)'), go: 'meta', done: !!(f.site_title && f.site_description) },
    { p: 'MEDIUM', t: tr('إنشاء صورة og:image بمقاس 1200×630', 'Create og:image (1200x630px) for social sharing'), go: 'og', done: !!f.og_image },
    { p: 'MEDIUM', t: tr('إضافة النطاق الأساسي (canonical)', 'Add canonical domain to prevent duplicate content'), go: 'meta', done: !!f.canonical },
    { p: 'MEDIUM', t: tr('تحليل 5 صفحات على الأقل (محلل الصفحات)', 'Run full page analysis (Page analyzer)'), go: 'pages', done: Object.keys(s.pageScores).length >= 5 },
    { p: 'MEDIUM', t: tr('فحص الموقع لاكتشاف 404 والروابط المعطلة', 'Run site crawl to find 404s & broken links'), go: 'crawl', done: s.crawlResults.length > 0 },
    { p: 'MEDIUM', t: tr('الإدراج في G2 وCapterra وProduct Hunt للروابط الخلفية', 'List on G2, Capterra, Product Hunt for backlinks'), go: 'backlinks', done: false },
    { p: 'LOW', t: tr('إضافة نص بديل لكل الصور', 'Optimize image alt tags across all pages'), go: 'content', done: !Object.values(s.pageScores).some((p: { imgWithoutAlt?: number }) => (p?.imgWithoutAlt || 0) > 0) },
    { p: 'LOW', t: tr('إضافة مخطط FAQ للرئيسية وصفحة الدعم', 'Add FAQ schema to homepage & support page'), go: 'schema', done: !!f.schema_faqpage },
    { p: 'LOW', t: tr('حفظ لقطة لمراكز الكلمات (متتبّع الترتيب)', 'Save keyword rank snapshot (Rank tracker)'), go: 'rank', done: Object.keys(s.rankHistory).length > 0 },
  ]
  const done = actions.filter(a => a.done).length

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" title={tr('صحة الصفحات', 'Page health')} subtitle={tr('الأشرطة: العنوان · الوصف · H1 · السرعة · الجوال', 'Bars: Title · Meta · H1 · Speed · Mobile')}>
        {!s.analyzed ? (
          <EmptyState size="sm" icon={MagnifyingGlassIcon} title={tr('لم تُحلَّل أي صفحة بعد', 'No pages analyzed yet')} description={tr('شغّل التحليل للحصول على درجات SEO الفعلية لكل صفحة.', 'Run the analysis to get real SEO scores for each page.')}
            action={<Button size="sm" loading={s.analyzeAll} onClick={s.runAnalyzeAll}>{tr('بدء التحليل', 'Start analysis')}</Button>} />
        ) : (
          <ul className="space-y-2">
            {PUBLIC_PAGES.map(p => {
              const sc = s.pageScores[p.path]
              const label = lang === 'ar' ? p.ar : p.label
              if (!sc || sc.error) return (
                <li key={p.path} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 opacity-60">
                  <ScoreRing value={null} size={36} />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">{label}</span>
                  <span className="text-xs text-muted">{sc?.error ? tr('تعذّر الجلب', 'Fetch failed') : tr('لم يُحلَّل', 'Not analyzed')}</span>
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
                  <span className={cn('text-xs', sc.indexed ? 'text-success' : 'text-danger')}>{sc.indexed ? tr('مفهرسة', 'Indexed') : tr('غير مفهرسة', 'Not indexed')}</span>
                </li>
              )
            })}
          </ul>
        )}
      </SeoCard>

      <SeoCard className="xl:col-span-2" icon={RocketLaunchIcon} title={tr('إجراءات ذات أولوية', 'Priority actions')} subtitle={tr(`${done} من ${actions.length} منجزة`, `${done} of ${actions.length} done`)}>
        <ProgressBar value={done} max={actions.length} size="sm" aria-label={tr('التقدّم', 'Progress')} />
        <ul className="space-y-2">
          {actions.map((a, i) => (
            <li key={i} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5">
              {a.done ? <CheckCircleIcon className="h-5 w-5 shrink-0 text-success" aria-hidden="true" /> : <PriorityBadge p={a.p} />}
              <p className={cn('min-w-0 flex-1 text-sm', a.done ? 'text-muted line-through' : 'text-ink')}>{a.t}</p>
              {!a.done && (a.url
                ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-link hover:text-link-hover">{tr('اذهب', 'Go')}<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" /></a>
                : a.go ? <button type="button" onClick={() => s.setTab(a.go!)} className="shrink-0 text-xs font-medium text-link hover:text-link-hover">{tr('افتح', 'Open')}</button> : null)}
            </li>
          ))}
        </ul>
      </SeoCard>
    </div>
  )
}
