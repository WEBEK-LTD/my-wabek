/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import {
  ArrowPathIcon, ArrowTopRightOnSquareIcon, BoltIcon, BugAntIcon, DocumentMagnifyingGlassIcon, ExclamationTriangleIcon, GlobeAltIcon, LinkIcon, MagnifyingGlassIcon, ShareIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, EmptyState, StatCard, Tooltip, cn, formatNumber } from '@/components/ui'
import { useAdminT } from '../../i18n'
import { Notice, ScoreRing } from '../../shared'
import { PUBLIC_PAGES, type PublicPage } from '../data'
import type { SeoState } from '../useSeoAdmin'
import { Check, ListRow, Meter, ScoreBadge, SeoCard, SerpPreview } from '../ui'

function usePageLabel() {
  const { lang } = useAdminT()
  return (p: PublicPage) => (lang === 'ar' ? p.ar : p.label)
}

function PageHead({ page, children, extra }: { page: PublicPage; children?: React.ReactNode; extra?: React.ReactNode }) {
  const { tr } = useAdminT()
  const label = usePageLabel()
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{label(page)}</h3>{extra}</div>
        <p dir="ltr" className="text-start font-mono text-xs text-muted">{page.path}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {children}
        <Tooltip content={tr('فتح الصفحة', 'Open page')}><Button size="icon-sm" variant="ghost" icon={ArrowTopRightOnSquareIcon} href={page.path} external aria-label={tr(`فتح ${label(page)}`, `Open ${label(page)}`)} /></Tooltip>
      </div>
    </div>
  )
}

/* ── Page analyzer ── */
export function PagesTab({ s }: { s: SeoState }) {
  const { tr } = useAdminT()
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{tr('تحليل فعلي للصفحات المنشورة: يجلب HTML ويفحص إشارات SEO.', 'Live analysis of your deployed pages — fetches the HTML and checks SEO signals.')}</p>
        <Button size="sm" variant="secondary" icon={ArrowPathIcon} loading={s.analyzeAll} onClick={s.runAnalyzeAll}>{tr('تحليل الكل', 'Analyze all')}</Button>
      </div>
      {PUBLIC_PAGES.map(page => {
        const sc = s.pageScores[page.path]
        const busy = s.analyzing === page.path
        return (
          <Card key={page.path} className="space-y-4">
            <PageHead page={page} extra={sc && !sc.error ? <><ScoreBadge score={sc.score} /><Badge size="sm" tone={sc.indexed ? 'success' : 'danger'}>{sc.indexed ? tr('مفهرسة', 'Indexed') : tr('غير مفهرسة', 'Not indexed')}</Badge></> : undefined}>
              {sc && !sc.error && <ScoreRing value={sc.score} size={48} />}
              <Button size="sm" variant="secondary" icon={sc ? ArrowPathIcon : MagnifyingGlassIcon} loading={busy} onClick={() => s.analyzePage(page.path)}>{sc ? tr('إعادة', 'Re-run') : tr('تحليل', 'Analyze')}</Button>
            </PageHead>
            {sc?.error && <Notice tone="danger" icon={ExclamationTriangleIcon}>{(sc.issues || []).join(' · ')}</Notice>}
            {sc && !sc.error && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Meter label={tr('العنوان', 'Title')} value={sc.title} detail={sc.titleLen ? tr(`${sc.titleLen} حرفًا`, `${sc.titleLen} chars`) : undefined} />
                  <Meter label={tr('الوصف', 'Meta desc')} value={sc.meta} detail={sc.metaLen ? tr(`${sc.metaLen} حرفًا`, `${sc.metaLen} chars`) : undefined} />
                  <Meter label="H1" value={sc.h1} detail={sc.h1Count !== undefined ? tr(`${sc.h1Count} موجود`, `${sc.h1Count} found`) : undefined} />
                  <Meter label={tr('السرعة', 'Speed')} value={sc.speed} detail={sc.sizeKB ? `${sc.sizeKB}KB` : undefined} />
                  <Meter label={tr('الجوال', 'Mobile')} value={sc.mobile} detail="Viewport" />
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Check ok={!!sc.hasCanonical} label={tr('رابط canonical', 'Canonical URL')} />
                  <Check ok={!!sc.hasOgImage} label={tr('صورة OG', 'OG image')} />
                  <Check ok={!!sc.hasStructuredData} label={tr('بيانات منظمة', 'Structured data')} />
                  <Check ok={!sc.imgWithoutAlt} label={tr('نص بديل للصور', 'Alt text')} />
                </div>
                {sc.issues?.length > 0 && (
                  <Notice tone="danger" icon={ExclamationTriangleIcon} title={tr(`${sc.issues.length} مشكلة`, `${sc.issues.length} issue(s) found`)}>
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
  const { tr } = useAdminT()
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{tr('يجلب HTML الفعلي ويفحص الكلمات وسهولة القراءة وعدد الكلمات والعناوين.', 'Fetches the real HTML and checks keywords, readability, word count and headings.')}</p>
        <Button size="sm" variant="secondary" icon={ArrowPathIcon} loading={s.parseAll} onClick={s.runParseAll}>{tr('تحليل كل الصفحات', 'Parse all pages')}</Button>
      </div>
      {PUBLIC_PAGES.slice(0, 7).map(page => {
        const d = s.parsedPages[page.path]
        const busy = s.parsing === page.path
        const topKws = d?.keywords ? Object.entries(d.keywords).slice(0, 8) : []
        const noAlt = d?.images ? d.images.filter((img: any) => !img.hasAlt).length : 0
        return (
          <Card key={page.path} className="space-y-4">
            <PageHead page={page} extra={d && !d.error ? <>
              <Badge size="sm" tone="neutral" className="tabular">{tr(`${formatNumber(d.wordCount)} كلمة`, `${formatNumber(d.wordCount)} words`)}</Badge>
              <Badge size="sm" tone={d.readabilityScore > 70 ? 'success' : 'warning'}>{tr('سهولة القراءة', 'Readability')} {d.readabilityScore}/100</Badge>
            </> : undefined}>
              <Button size="sm" variant="secondary" icon={d ? ArrowPathIcon : DocumentMagnifyingGlassIcon} loading={busy} onClick={() => s.parsePage(page.path)}>{d ? tr('إعادة', 'Re-run') : tr('تحليل', 'Parse')}</Button>
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
                      {!h.items.length && <p className="text-xs text-danger">{tr('لا يوجد', 'None found')}</p>}
                    </div>
                  ))}
                </div>
                <ListRow end={<span className={cn('text-xs', noAlt ? 'text-danger' : 'text-success')}>{noAlt ? tr(`${noAlt} صورة بلا نص بديل`, `${noAlt} images missing alt text`) : tr('كل الصور لها نص بديل', 'All images have alt text')}</span>}>
                  <span className="text-xs text-muted">{tr('الصور:', 'Images:')} <span className="tabular font-medium text-ink">{(d.images || []).length}</span></span>
                </ListRow>
                {topKws.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs text-muted">{tr('أبرز الكلمات في الصفحة:', 'Top keywords on the page:')}</p>
                    <div className="flex flex-wrap gap-1.5">{topKws.map(([kw, density]: [string, any]) => <Badge key={kw} size="sm" tone="neutral"><span dir="auto">{kw}</span> <span className="tabular opacity-70">{density}%</span></Badge>)}</div>
                  </div>
                )}
                {(d.title || d.metaDescription) && (
                  <div className="space-y-1.5">
                    <SerpPreview title={d.title} url={`waabek.com${page.path}`} description={d.metaDescription} />
                    <div className="flex gap-3 text-2xs">
                      <span className={d.titleLen >= 30 && d.titleLen <= 60 ? 'text-success' : 'text-danger'}>{tr('العنوان:', 'Title:')} {d.titleLen}</span>
                      <span className={d.metaLen >= 120 && d.metaLen <= 160 ? 'text-success' : 'text-danger'}>{tr('الوصف:', 'Meta:')} {d.metaLen}</span>
                    </div>
                  </div>
                )}
                <ul className="space-y-1 text-xs">
                  {(d.h1 || []).length === 0 && <li className="text-danger">{tr('لا يوجد وسم H1 — أضف واحدًا بالكلمة الأساسية', 'No H1 tag — add one with your primary keyword')}</li>}
                  {(d.h1 || []).length > 1 && <li className="text-warning">{tr(`عدة وسوم H1 (${d.h1.length}) — استخدم واحدًا فقط`, `Multiple H1 tags (${d.h1.length}) — use only one`)}</li>}
                  {d.wordCount < 300 && <li className="text-warning">{tr(`عدد كلمات قليل (${d.wordCount}) — استهدف 500+`, `Low word count (${d.wordCount}) — aim for 500+`)}</li>}
                  {d.wordCount > 300 && (d.h2 || []).length === 0 && <li className="text-warning">{tr('لا عناوين H2 — نظّم المحتوى بها', 'No H2 subheadings — add structure with H2 tags')}</li>}
                  {d.titleLen > 60 && <li className="text-warning">{tr(`العنوان طويل (${d.titleLen}) — يقطعه Google عند 60`, `Title too long (${d.titleLen}) — Google truncates at 60`)}</li>}
                  {d.titleLen < 30 && d.titleLen > 0 && <li className="text-warning">{tr(`العنوان قصير (${d.titleLen}) — استهدف 50-60`, `Title too short (${d.titleLen}) — aim for 50-60`)}</li>}
                  {d.metaLen < 100 && <li className="text-warning">{tr(`الوصف قصير (${d.metaLen}) — استهدف 150-160`, `Meta description too short (${d.metaLen}) — aim for 150-160`)}</li>}
                  {d.readabilityScore < 50 && <li className="text-warning">{tr(`سهولة قراءة منخفضة (${d.readabilityScore}/100) — جمل أقصر`, `Low readability (${d.readabilityScore}/100) — use shorter sentences`)}</li>}
                  {(d.h1 || []).length === 1 && d.wordCount >= 300 && d.titleLen >= 30 && d.titleLen <= 60 && <li className="text-success">{tr('بنية الصفحة جيدة', 'Page structure looks good')}</li>}
                </ul>
              </>
            )}
            {d?.error && <Notice tone="danger" icon={ExclamationTriangleIcon}>{tr('تعذّر تحليل الصفحة:', 'Could not parse page:')} {d.error}</Notice>}
            {!d && !busy && <p className="text-xs text-muted">{tr('اضغط «تحليل» لفحص هذه الصفحة', 'Click Parse to analyze this page')}</p>}
          </Card>
        )
      })}
    </div>
  )
}

/* ── Crawl monitor ── */
export function CrawlTab({ s }: { s: SeoState }) {
  const { tr } = useAdminT()
  const rows = Array.isArray(s.crawlResults) ? s.crawlResults.filter(Boolean) : []
  return (
    <div className="space-y-5">
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3.5">
          <StatCard label={tr('صفحات سليمة', 'Pages OK')} value={formatNumber(rows.filter(r => r.status === 200).length)} subTone="success" />
          <StatCard label={tr('أخطاء', 'Errors')} value={formatNumber(rows.filter(r => r.status !== 200).length)} subTone="danger" />
          <StatCard label={tr('إجمالي المشكلات', 'Total issues')} value={formatNumber(rows.reduce((a, r) => a + (r?.issues || 0), 0))} />
        </div>
      )}
      <SeoCard icon={BugAntIcon} title={tr('مراقبة فحص الموقع', 'Site crawl monitor')} subtitle={tr('يفحص الصفحات العامة ويكشف 404 والوسوم الناقصة والمشكلات التقنية.', 'Crawls public pages and detects 404s, missing tags and technical issues.')}
        action={<Button size="sm" icon={BugAntIcon} loading={s.crawling} onClick={s.runCrawl}>{tr('فحص كامل', 'Run full crawl')}</Button>}>
        {rows.length === 0 ? (
          <EmptyState size="sm" icon={BugAntIcon} title={tr('لا توجد نتائج فحص بعد', 'No crawl results yet')} description={tr('شغّل الفحص لتحليل كل الصفحات العامة.', 'Run a crawl to analyze all public pages.')} />
        ) : (
          <ul className="space-y-2">
            {rows.map((r: any, i: number) => {
              const bad = r.status === 404 || r.status === 'error'
              return (
                <li key={i} className={cn('flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5', bad ? 'border border-danger/25 bg-danger-bg' : 'bg-surface-2')}>
                  <Badge size="sm" tone={r.status === 200 ? 'success' : r.status === 404 ? 'danger' : 'neutral'}><span dir="ltr">{r.status}</span></Badge>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm text-ink">{r.label}</p><p dir="ltr" className="text-start font-mono text-2xs text-muted">{r.path}</p></div>
                  <div className="flex flex-wrap gap-1.5 text-2xs">
                    {r.score > 0 && !isNaN(r.score) && <Badge size="sm" tone={r.score >= 80 ? 'success' : r.score >= 60 ? 'warning' : 'danger'}>SEO {Math.round(r.score)}</Badge>}
                    {r.issues > 0 && <Badge size="sm" tone="warning">{tr(`${r.issues} مشكلة`, `${r.issues} issues`)}</Badge>}
                    {!!r.size && <Badge size="sm" tone="neutral">{r.size}KB</Badge>}
                    {r.hasCanonical === false && <Badge size="sm" tone="warning">{tr('بلا canonical', 'No canonical')}</Badge>}
                    {r.hasStructuredData === false && <Badge size="sm" tone="violet">{tr('بلا مخطط', 'No schema')}</Badge>}
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
  const { tr } = useAdminT()
  const guide = [
    { check: tr('استخدم next/image لتحويل WebP والتحميل الكسول تلقائيًا', 'Use next/image for automatic WebP + lazy loading'), impact: 'HIGH', effort: 'LOW' },
    { check: tr('فعّل تحسين أصول Netlify (تصغير CSS/JS)', 'Enable Netlify asset optimization (minify CSS/JS)'), impact: 'HIGH', effort: 'LOW' },
    { check: tr('حمّل الخطوط الأساسية مسبقًا', 'Preload critical fonts to eliminate render-blocking'), impact: 'MEDIUM', effort: 'LOW' },
    { check: tr('استيراد ديناميكي لمكوّنات اللوحة الكبيرة', 'Use dynamic imports for large dashboard components'), impact: 'HIGH', effort: 'MEDIUM' },
    { check: tr('أزل CSS غير المستخدم من Tailwind', 'Remove unused CSS from Tailwind build'), impact: 'MEDIUM', effort: 'LOW' },
    { check: tr('أضف تلميحات الموارد (dns-prefetch, preconnect)', 'Add resource hints (dns-prefetch, preconnect)'), impact: 'MEDIUM', effort: 'LOW' },
    { check: tr('خزّن ردود API مؤقتًا (SWR)', 'Implement SWR caching for API responses'), impact: 'HIGH', effort: 'MEDIUM' },
    { check: tr('حدّد أبعاد الصور لتجنّب CLS', 'Set explicit width/height on all images to prevent CLS'), impact: 'MEDIUM', effort: 'LOW' },
  ]
  return (
    <div className="space-y-5">
      <SeoCard icon={BoltIcon} title={tr('مؤشرات أداء الويب الأساسية', 'Core Web Vitals')} subtitle={tr('درجات فعلية من Google PageSpeed (جوال). حلّل كل صفحة على حدة.', 'Real scores from Google PageSpeed (mobile). Analyze each page.')}>
        <div className="space-y-3">
          {PUBLIC_PAGES.slice(0, 7).map(page => {
            const d = s.speedData[page.path]
            return (
              <div key={page.path} className="space-y-3 rounded-xl border border-line-soft p-4">
                <PageHead page={page}>
                  <Button size="sm" variant="secondary" icon={d ? ArrowPathIcon : BoltIcon} loading={s.speedLoading === page.path} onClick={() => s.checkSpeed(page.path)}>{d ? tr('إعادة الفحص', 'Re-check') : tr('تحليل', 'Analyze')}</Button>
                </PageHead>
                {d?.error && <Notice tone="danger" icon={ExclamationTriangleIcon}>{tr('تعذّر الحصول على نتيجة PageSpeed لهذه الصفحة.', 'Could not get a PageSpeed result for this page.')}{d.status ? ` (HTTP ${d.status})` : ''}</Notice>}
                {d && !d.error && (
                  <>
                    <div className="grid grid-cols-4 gap-2">
                      {[{ l: tr('الأداء', 'Performance'), v: d.performance }, { l: 'SEO', v: d.seo }, { l: tr('الإتاحة', 'Accessibility'), v: d.accessibility }, { l: tr('أفضل الممارسات', 'Best practices'), v: d.bestPractices }].map(m => (
                        <div key={m.l} className="flex flex-col items-center gap-1 rounded-xl bg-surface-2 p-2.5 text-center">
                          <ScoreRing value={m.v} size={48} good={90} fair={50} label={m.l} />
                          <span className="text-2xs text-muted">{m.l}</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ l: 'LCP', v: d.lcp, tip: tr('يجب أن يكون أقل من 2.5 ث', 'Should be < 2.5s') }, { l: 'CLS', v: d.cls, tip: tr('يجب أن يكون أقل من 0.1', 'Should be < 0.1') }, { l: 'TTI', v: d.fid, tip: tr('يجب أن يكون أقل من 3.8 ث', 'Should be < 3.8s') }].map(v => (
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
      <SeoCard title={tr('دليل تحسين الأداء', 'Performance optimization guide')}>
        <div className="space-y-2">
          {guide.map((g, i) => (
            <ListRow key={i} end={<div className="flex gap-1"><Badge size="sm" tone={g.impact === 'HIGH' ? 'success' : 'warning'}>{tr('الأثر', 'Impact')}: {g.impact === 'HIGH' ? tr('عالٍ', 'High') : tr('متوسط', 'Medium')}</Badge><Badge size="sm" tone={g.effort === 'LOW' ? 'brand' : 'warning'}>{tr('الجهد', 'Effort')}: {g.effort === 'LOW' ? tr('قليل', 'Low') : tr('متوسط', 'Medium')}</Badge></div>}>
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
  const { tr } = useAdminT()
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
        <p className="text-sm text-muted">{tr('اكتشاف فعلي للروابط من HTML الصفحات: الداخلية والخارجية والصفحات اليتيمة.', 'Real link detection from page HTML: internal, external and orphan pages.')}</p>
        <Button size="sm" variant="secondary" icon={ArrowPathIcon} loading={s.parseAll} onClick={s.runParseAll}>{tr('فحص كل الصفحات', 'Crawl all pages')}</Button>
      </div>
      {!has ? (
        <EmptyState variant="card" icon={ShareIcon} title={tr('لا توجد بيانات روابط بعد', 'No link data yet')} description={tr('افحص الصفحات لاكتشاف الروابط الفعلية.', 'Crawl the pages to detect real links.')}
          action={<Button size="sm" loading={s.parseAll} onClick={s.runParseAll}>{tr('بدء الفحص', 'Start crawl')}</Button>} />
      ) : (
        <>
          <SeoCard icon={ShareIcon} title={tr('خريطة الروابط', 'Page link map')}>
            <ul className="space-y-2">
              {pages.map(page => {
                const d = parsed[page.path]
                if (!d || d.error) return (
                  <li key={page.path} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5 opacity-70">
                    <p className="min-w-0 flex-1 text-sm text-muted">{label(page)} — {tr('لم يُحلَّل بعد', 'not parsed yet')}</p>
                    <Button size="xs" variant="secondary" loading={s.parsing === page.path} onClick={() => s.parsePage(page.path)}>{tr('تحليل', 'Parse')}</Button>
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
                          {orphan && <Badge size="sm" tone="danger">{tr('يتيمة', 'Orphan')}</Badge>}
                          <p className="text-sm font-medium text-ink">{label(page)}</p>
                          <p dir="ltr" className="font-mono text-2xs text-muted">{page.path}</p>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                          <span>{tr(`${internal.length} داخلية صادرة`, `${internal.length} internal out`)}</span>
                          <span>{tr(`${external.length} خارجية صادرة`, `${external.length} external out`)}</span>
                          <span className={orphan ? 'text-danger' : 'text-success'}>{tr(`${inbound.length} واردة`, `${inbound.length} inbound`)}</span>
                        </div>
                        {orphan && <p className="mt-1 text-xs text-danger">{tr('لا تربط أي صفحة أخرى بهذه الصفحة — قد لا يكتشفها Google', 'No other page links here — Google may not discover it')}</p>}
                      </div>
                      <Button size="icon-sm" variant="ghost" icon={ArrowPathIcon} aria-label={tr('إعادة التحليل', 'Re-parse')} loading={s.parsing === page.path} onClick={() => s.parsePage(page.path)} />
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
            <SeoCard icon={LinkIcon} title={tr('فرص ربط داخلي', 'Internal link opportunities')}>
              {opportunities.length === 0 ? <p className="text-sm text-success">{tr('لا توجد فرص واضحة ناقصة — الصفحات المرتبطة موصولة.', 'No obvious opportunities missing — related pages seem linked.')}</p> : (
                <ul className="space-y-2">
                  {opportunities.slice(0, 8).map((o, i) => (
                    <ListRow key={i}>
                      <p dir="ltr" className="text-start font-mono text-xs"><span className="text-link">{o.from}</span> → <span className="text-success">{o.to}</span></p>
                      <p className="text-2xs text-muted">{tr('المواضيع متقاربة — أضف رابطًا سياقيًا', 'Content topics overlap — add a contextual link')}</p>
                    </ListRow>
                  ))}
                </ul>
              )}
            </SeoCard>
            <SeoCard icon={GlobeAltIcon} title={tr('روابط خارجية', 'External links found')}>
              {externals.length === 0 ? <p className="text-sm text-muted">{tr('لم تُكتشف روابط خارجية بعد', 'No external links detected yet')}</p> : (
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
