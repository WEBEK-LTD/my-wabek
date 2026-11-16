/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import toast from 'react-hot-toast'
import { BeakerIcon, CodeBracketIcon, DocumentTextIcon, KeyIcon, PlusIcon, SparklesIcon, TagIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { Badge, Button, Card, Input, Select, Textarea } from '@/components/ui'
import { useAdminT } from '../../i18n'
import { CopyButton, ScoreRing } from '../../shared'
import { PUBLIC_PAGES } from '../data'
import type { SeoState } from '../useSeoAdmin'
import { CharCount, ListRow, PriorityBadge, SeoCard, SerpPreview } from '../ui'

export function AiTab({ s }: { s: SeoState }) {
  const { tr, lang } = useAdminT()
  const cats: Record<string, string> = {
    primary: tr('كلمات أساسية', 'Primary keywords'), longtail: tr('كلمات طويلة', 'Long-tail keywords'), question: tr('كلمات أسئلة', 'Question keywords'),
    competitor: tr('فجوات المنافسين', 'Competitor gap keywords'), niche: tr('كلمات متخصصة', 'Niche keywords'),
  }
  return (
    <div className="space-y-5">
      <Card variant="deep" padding="lg" className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-violet opacity-30 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><SparklesIcon className="h-6 w-6 text-brand-green" aria-hidden="true" /></span>
          <div>
            <h2 className="text-lg font-semibold text-white">{tr('مساعد SEO الذكي', 'AI SEO assistant')}</h2>
            <p className="text-sm text-deep-muted">{tr('يولّد ويحسّن ويصلح محتوى SEO. راجع النتائج قبل تطبيقها.', 'Generates, optimizes and fixes SEO content. Review results before applying them.')}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Meta generator */}
        <SeoCard icon={TagIcon} title={tr('مولّد وسوم Meta', 'AI meta generator')} subtitle={tr('الصق محتوى الصفحة أو صفها ← عنوان (60) ووصف (160) وكلمات.', 'Paste or describe the page → title (60), description (160) and keywords.')}>
          <Textarea rows={5} value={s.metaInput} onChange={e => s.setMetaInput(e.target.value)} aria-label={tr('محتوى الصفحة', 'Page content')}
            placeholder={tr('مثال: صفحة ميزات لمنصة أتمتة واتساب: حملات جماعية، روبوت ذكي، صندوق فريق.', 'Example: Features page for a WhatsApp automation SaaS with bulk campaigns, AI chatbot, team inbox.')} />
          <Button icon={SparklesIcon} loading={s.aiLoading === 'meta'} onClick={s.generateMeta}>{tr('توليد الوسوم', 'Generate meta tags')}</Button>
          {s.metaResult && (
            <div className="space-y-3">
              <SerpPreview title={s.metaResult.title} url="waabek.com" description={s.metaResult.description} />
              {[
                { label: tr('العنوان', 'Title tag'), value: s.metaResult.title, max: 60, key: 'site_title' },
                { label: tr('الوصف', 'Meta description'), value: s.metaResult.description, max: 160, key: 'site_description' },
                { label: tr('الكلمات', 'Focus keywords'), value: s.metaResult.keywords, max: 0, key: 'focus_kw' },
              ].map(f => (
                <ListRow key={f.key} end={<Button size="xs" variant="ghost" onClick={() => { s.setForm(p => ({ ...p, [f.key]: f.value })); toast.success(tr('طُبّق', 'Applied')) }}>{tr('تطبيق', 'Apply')}</Button>}>
                  <div className="flex items-center gap-2"><span className="text-xs font-medium text-ink">{f.label}</span>{f.max > 0 && <CharCount n={f.value.length} max={f.max} />}</div>
                  <p dir="auto" className="text-xs text-body">{f.value}</p>
                </ListRow>
              ))}
              <Button fullWidth loading={s.saving} onClick={() => s.applyAndSave({ site_title: s.metaResult!.title, site_description: s.metaResult!.description, focus_kw: s.metaResult!.keywords })}>
                {tr('تطبيق الكل والحفظ', 'Apply all & save to site')}
              </Button>
            </div>
          )}
        </SeoCard>

        {/* Content optimizer */}
        <SeoCard icon={DocumentTextIcon} title={tr('محسّن المحتوى', 'AI content optimizer')} subtitle={tr('محتوى + كلمة مستهدفة ← إعادة صياغة بكثافة وعناوين وقراءة أفضل.', 'Content + target keyword → rewrite with better density, headings and readability.')}>
          <Input value={s.contentKw} onChange={e => s.setContentKw(e.target.value)} placeholder={tr('الكلمة المستهدفة', 'Target keyword (e.g. WhatsApp automation platform)')} aria-label={tr('الكلمة المستهدفة', 'Target keyword')} />
          <Textarea rows={6} value={s.contentInput} onChange={e => s.setContentInput(e.target.value)} placeholder={tr('الصق المحتوى المراد تحسينه…', 'Paste the content you want to optimize…')} aria-label={tr('المحتوى', 'Content')} />
          <Button icon={SparklesIcon} loading={s.aiLoading === 'content'} onClick={s.optimizeContent}>{tr('تحسين المحتوى', 'Optimize content')}</Button>
          {s.contentResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><p className="text-sm font-medium text-ink">{tr('المحتوى المحسّن', 'Optimized content')}</p><CopyButton size="xs" text={s.contentResult} label={tr('نسخ', 'Copy')} /></div>
              <div dir="auto" className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-4 font-mono text-xs leading-relaxed text-body">{s.contentResult}</div>
            </div>
          )}
        </SeoCard>

        {/* Schema generator */}
        <SeoCard icon={CodeBracketIcon} title={tr('مولّد المخططات', 'AI schema generator')} subtitle={tr('صف الصفحة ← JSON-LD كامل وصالح جاهز لـ Google.', 'Describe the page → complete, valid JSON-LD ready for Google.')}>
          <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
            <Select value={s.schemaType} onChange={e => s.setSchemaType(e.target.value)} aria-label={tr('نوع المخطط', 'Schema type')}
              options={['Organization', 'SoftwareApplication', 'FAQPage', 'Article', 'BreadcrumbList', 'Product', 'LocalBusiness', 'WebPage'].map(t => ({ value: t, label: t }))} />
            <Input value={s.schemaDesc} onChange={e => s.setSchemaDesc(e.target.value)} placeholder={tr('صف الصفحة', 'Describe the page (e.g. homepage for a WhatsApp SaaS with a free plan)')} aria-label={tr('وصف الصفحة', 'Page description')} />
          </div>
          <Button icon={SparklesIcon} loading={s.aiLoading === 'schema'} onClick={s.generateSchema}>{tr('توليد المخطط', 'Generate schema')}</Button>
          {s.schemaResult && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="violet">{s.schemaType}</Badge>
                <div className="flex gap-1.5">
                  <CopyButton size="xs" text={s.schemaResult} label={tr('نسخ', 'Copy')} />
                  <Button size="xs" variant="secondary" icon={BeakerIcon} href="https://search.google.com/test/rich-results" external>{tr('اختبار', 'Test')}</Button>
                  <Button size="xs" onClick={() => s.saveSchema(s.schemaType, s.schemaResult)}>{tr('حفظ وحقن', 'Save & inject')}</Button>
                </div>
              </div>
              <Textarea rows={12} dir="ltr" className="font-mono text-xs" value={s.schemaResult} onChange={e => s.setSchemaResult(e.target.value)} aria-label="JSON-LD" />
            </div>
          )}
        </SeoCard>

        {/* Audit */}
        <SeoCard icon={WrenchScrewdriverIcon} title={tr('تدقيق وإصلاح تلقائي', 'AI SEO audit + auto-fix')} subtitle={tr('اختر صفحة ← تحليل المشكلات وإصلاحات جاهزة للتطبيق.', 'Pick a page → issues found and ready-to-apply fixes.')}>
          <div className="flex gap-2">
            <Select className="flex-1" value={s.auditPage} onChange={e => s.setAuditPage(e.target.value)} aria-label={tr('الصفحة', 'Page')}
              options={PUBLIC_PAGES.slice(0, 8).map(p => ({ value: p.path, label: `${lang === 'ar' ? p.ar : p.label} (${p.path})` }))} />
            <Button icon={SparklesIcon} loading={s.aiLoading === 'audit'} onClick={s.runAiAudit}>{tr('تدقيق', 'Run audit')}</Button>
          </div>
          {s.auditResult && (
            <div className="space-y-3">
              <ListRow>
                <div className="flex items-center gap-3">
                  <ScoreRing value={s.auditResult.score} size={52} />
                  <div><p className="text-sm font-medium text-ink">{tr('درجة', 'Score for')} <span dir="ltr">{s.auditPage}</span></p><p className="text-xs text-muted">{tr(`${s.auditResult.fixes?.length || 0} إصلاحًا مقترحًا`, `${s.auditResult.fixes?.length || 0} suggested fixes`)}</p></div>
                </div>
              </ListRow>
              {s.auditResult.fixes?.map((fix: any, i: number) => (
                <div key={i} className="space-y-1 rounded-xl bg-surface-2 p-3">
                  <div className="flex items-start gap-2"><PriorityBadge p={fix.priority} /><p dir="auto" className="text-xs font-medium text-ink">{fix.issue}</p></div>
                  <p dir="auto" className="text-xs text-success">{fix.fix}</p>
                  {fix.example && <p dir="auto" className="rounded-lg bg-surface px-2 py-1 font-mono text-2xs text-muted">{fix.example}</p>}
                </div>
              ))}
              <div className="space-y-2 rounded-xl border border-success/25 bg-success-bg/50 p-3">
                <p className="text-sm font-semibold text-success">{tr('اقتراحات قابلة للتطبيق', 'Suggestions you can apply')}</p>
                {s.auditResult.suggested_title && (
                  <ListRow end={<Button size="xs" onClick={() => { s.setForm(f => ({ ...f, site_title: s.auditResult.suggested_title })); toast.success(tr('طُبّق العنوان', 'Title applied')) }}>{tr('تطبيق', 'Apply')}</Button>}>
                    <p className="text-2xs text-muted">{tr('عنوان مقترح', 'Suggested title')} ({s.auditResult.suggested_title.length})</p><p dir="auto" className="text-sm text-ink">{s.auditResult.suggested_title}</p>
                  </ListRow>
                )}
                {s.auditResult.suggested_meta && (
                  <ListRow end={<Button size="xs" onClick={() => { s.setForm(f => ({ ...f, site_description: s.auditResult.suggested_meta })); toast.success(tr('طُبّق الوصف', 'Meta applied')) }}>{tr('تطبيق', 'Apply')}</Button>}>
                    <p className="text-2xs text-muted">{tr('وصف مقترح', 'Suggested meta')} ({s.auditResult.suggested_meta.length})</p><p dir="auto" className="text-sm text-ink">{s.auditResult.suggested_meta}</p>
                  </ListRow>
                )}
                {s.auditResult.suggested_h1 && (
                  <ListRow end={<CopyButton size="xs" text={s.auditResult.suggested_h1} label={tr('نسخ', 'Copy')} />}>
                    <p className="text-2xs text-muted">{tr('H1 مقترح — أضفه إلى كود الصفحة', 'Suggested H1 — add it to the page code')}</p><p dir="auto" className="text-sm text-ink">{s.auditResult.suggested_h1}</p>
                  </ListRow>
                )}
                <Button fullWidth loading={s.saving} onClick={() => s.save()}>{tr('حفظ التغييرات المطبّقة', 'Save all applied changes')}</Button>
              </div>
            </div>
          )}
        </SeoCard>
      </div>

      {/* Keyword research */}
      <SeoCard icon={KeyIcon} title={tr('بحث الكلمات المفتاحية', 'AI keyword research')} subtitle={tr('صف نشاطك ← أكثر من 20 كلمة مع النية والصعوبة والصفحة المستهدفة.', 'Describe your business → 20+ keywords with intent, difficulty and target page.')}>
        <Textarea rows={4} value={s.kwBusiness} onChange={e => s.setKwBusiness(e.target.value)} aria-label={tr('وصف النشاط', 'Business description')}
          placeholder={tr('مثال: منصة أتمتة واتساب للمتاجر والوكالات وشركات الاستضافة…', 'Example: WhatsApp automation SaaS for e-commerce, agencies, hosting companies…')} />
        <Button icon={SparklesIcon} loading={s.aiLoading === 'keywords'} onClick={s.researchKeywords}>{tr('ابحث عن كلمات', 'Research keywords')}</Button>
        {s.kwResult.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">{tr(`${s.kwResult.length} كلمة`, `${s.kwResult.length} keywords found`)}</p>
              <div className="flex gap-1.5">
                <CopyButton size="xs" text={s.kwResult.map((k: any) => k.keyword).join(', ')} label={tr('نسخ الكل', 'Copy all')} />
                <Button size="xs" loading={s.saving} onClick={() => s.applyAndSave({ focus_kw: s.kwResult.map((k: any) => k.keyword).join(', ').slice(0, 500) })}>
                  {tr('حفظ كلها كلمات مفتاحية', 'Save all to focus keywords')}
                </Button>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {['primary', 'longtail', 'question', 'competitor', 'niche'].map(cat => {
                const list = s.kwResult.filter((k: any) => k.category === cat)
                if (!list.length) return null
                return (
                  <div key={cat} className="space-y-1.5">
                    <p className="eyebrow">{cats[cat]}</p>
                    {list.map((kw: any, i: number) => (
                      <ListRow key={i} end={<Button size="xs" variant="ghost" icon={PlusIcon} disabled={s.trackingKws.some(t => t.kw === kw.keyword)} onClick={() => { s.trackKeyword(kw.keyword, kw.suggestion || '/'); toast.success(tr('أُضيفت إلى متتبّع الترتيب', 'Added to rank tracker')) }}>{tr('تتبّع', 'Track')}</Button>}>
                        <p dir="auto" className="text-sm text-ink">{kw.keyword}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge size="sm" tone={kw.intent === 'transactional' ? 'success' : kw.intent === 'commercial' ? 'brand' : 'neutral'}>{kw.intent}</Badge>
                          <Badge size="sm" tone={kw.difficulty === 'easy' ? 'success' : kw.difficulty === 'medium' ? 'warning' : 'danger'}>{kw.difficulty}</Badge>
                          {kw.suggestion && <Badge size="sm" tone="neutral"><span dir="ltr" className="font-mono">{kw.suggestion}</span></Badge>}
                        </div>
                      </ListRow>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </SeoCard>
    </div>
  )
}
