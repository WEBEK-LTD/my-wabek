/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import toast from 'react-hot-toast'
import { BeakerIcon, CodeBracketIcon, DocumentTextIcon, KeyIcon, PlusIcon, SparklesIcon, TagIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { Badge, Button, Card, Input, Select, Textarea } from '@/components/ui'
import { useAdminT } from '../../i18n'
import { CopyButton, ScoreRing } from '../../shared'
import { PUBLIC_PAGES } from '../data'
import type { SeoState } from '../useSeoAdmin'
import { CharCount, ListRow, PriorityBadge, SeoCard, SerpPreview, usePageLabel } from '../ui'
import messages from '@/locales/admin/seo/ai'

export function AiTab({ s }: { s: SeoState }) {
  const { t, tn } = useAdminT(messages)
  const pageLabel = usePageLabel()
  const cats: Record<string, string> = {
    primary: t('primaryKeywords'), longtail: t('longTailKeywords'), question: t('questionKeywords'),
    competitor: t('competitorGapKeywords'), niche: t('nicheKeywords'),
  }
  return (
    <div className="space-y-5">
      <Card variant="deep" padding="lg" className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-violet opacity-30 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><SparklesIcon className="h-6 w-6 text-brand-green" aria-hidden="true" /></span>
          <div>
            <h2 className="text-lg font-semibold text-white">{t('aiSeoAssistant')}</h2>
            <p className="text-sm text-deep-muted">{t('generatesOptimizesFixesSeo')}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Meta generator */}
        <SeoCard icon={TagIcon} title={t('aiMetaGenerator')} subtitle={t('pasteDescribePageTitle')}>
          <Textarea rows={5} value={s.metaInput} onChange={e => s.setMetaInput(e.target.value)} aria-label={t('pageContent')}
            placeholder={t('exampleFeaturesPageWhatsapp')} />
          <Button icon={SparklesIcon} loading={s.aiLoading === 'meta'} onClick={s.generateMeta}>{t('generateMetaTags')}</Button>
          {s.metaResult && (
            <div className="space-y-3">
              <SerpPreview title={s.metaResult.title} url="waabek.com" description={s.metaResult.description} />
              {[
                { label: t('titleTag'), value: s.metaResult.title, max: 60, key: 'site_title' },
                { label: t('metaDescriptionAlt'), value: s.metaResult.description, max: 160, key: 'site_description' },
                { label: t('focusKeywords'), value: s.metaResult.keywords, max: 0, key: 'focus_kw' },
              ].map(f => (
                <ListRow key={f.key} end={<Button size="xs" variant="ghost" onClick={() => { s.setForm(p => ({ ...p, [f.key]: f.value })); toast.success(t('applied')) }}>{t('apply')}</Button>}>
                  <div className="flex items-center gap-2"><span className="text-xs font-medium text-ink">{f.label}</span>{f.max > 0 && <CharCount n={f.value.length} max={f.max} />}</div>
                  <p dir="auto" className="text-xs text-body">{f.value}</p>
                </ListRow>
              ))}
              <Button fullWidth loading={s.saving} onClick={() => s.applyAndSave({ site_title: s.metaResult!.title, site_description: s.metaResult!.description, focus_kw: s.metaResult!.keywords })}>
                {t('applyAllSaveSite')}
              </Button>
            </div>
          )}
        </SeoCard>

        {/* Content optimizer */}
        <SeoCard icon={DocumentTextIcon} title={t('aiContentOptimizer')} subtitle={t('contentTargetKeywordRewrite')}>
          <Input value={s.contentKw} onChange={e => s.setContentKw(e.target.value)} placeholder={t('targetKeywordEG')} aria-label={t('targetKeyword')} />
          <Textarea rows={6} value={s.contentInput} onChange={e => s.setContentInput(e.target.value)} placeholder={t('pasteContentYouWant')} aria-label={t('content')} />
          <Button icon={SparklesIcon} loading={s.aiLoading === 'content'} onClick={s.optimizeContent}>{t('optimizeContent')}</Button>
          {s.contentResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><p className="text-sm font-medium text-ink">{t('optimizedContent')}</p><CopyButton size="xs" text={s.contentResult} label={t('copy')} /></div>
              <div dir="auto" className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-4 font-mono text-xs leading-relaxed text-body">{s.contentResult}</div>
            </div>
          )}
        </SeoCard>

        {/* Schema generator */}
        <SeoCard icon={CodeBracketIcon} title={t('aiSchemaGenerator')} subtitle={t('describePageCompleteValid')}>
          <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
            <Select value={s.schemaType} onChange={e => s.setSchemaType(e.target.value)} aria-label={t('schemaType')}
              options={['Organization', 'SoftwareApplication', 'FAQPage', 'Article', 'BreadcrumbList', 'Product', 'LocalBusiness', 'WebPage'].map(t => ({ value: t, label: t }))} />
            <Input value={s.schemaDesc} onChange={e => s.setSchemaDesc(e.target.value)} placeholder={t('describePageEG')} aria-label={t('pageDescription')} />
          </div>
          <Button icon={SparklesIcon} loading={s.aiLoading === 'schema'} onClick={s.generateSchema}>{t('generateSchema')}</Button>
          {s.schemaResult && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="violet">{s.schemaType}</Badge>
                <div className="flex gap-1.5">
                  <CopyButton size="xs" text={s.schemaResult} label={t('copy')} />
                  <Button size="xs" variant="secondary" icon={BeakerIcon} href="https://search.google.com/test/rich-results" external>{t('test')}</Button>
                  <Button size="xs" onClick={() => s.saveSchema(s.schemaType, s.schemaResult)}>{t('saveInject')}</Button>
                </div>
              </div>
              <Textarea rows={12} dir="ltr" className="font-mono text-xs" value={s.schemaResult} onChange={e => s.setSchemaResult(e.target.value)} aria-label="JSON-LD" />
            </div>
          )}
        </SeoCard>

        {/* Audit */}
        <SeoCard icon={WrenchScrewdriverIcon} title={t('aiSeoAuditAuto')} subtitle={t('pickPageIssuesFound')}>
          <div className="flex gap-2">
            <Select className="flex-1" value={s.auditPage} onChange={e => s.setAuditPage(e.target.value)} aria-label={t('page')}
              options={PUBLIC_PAGES.slice(0, 8).map(p => ({ value: p.path, label: `${pageLabel(p)} (${p.path})` }))} />
            <Button icon={SparklesIcon} loading={s.aiLoading === 'audit'} onClick={s.runAiAudit}>{t('runAudit')}</Button>
          </div>
          {s.auditResult && (
            <div className="space-y-3">
              <ListRow>
                <div className="flex items-center gap-3">
                  <ScoreRing value={s.auditResult.score} size={52} />
                  <div><p className="text-sm font-medium text-ink">{t('score')} <span dir="ltr">{s.auditPage}</span></p><p className="text-xs text-muted">{tn('suggestedFixes', s.auditResult.fixes?.length || 0, { n: s.auditResult.fixes?.length || 0 })}</p></div>
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
                <p className="text-sm font-semibold text-success">{t('suggestionsYouCanApply')}</p>
                {s.auditResult.suggested_title && (
                  <ListRow end={<Button size="xs" onClick={() => { s.setForm(f => ({ ...f, site_title: s.auditResult.suggested_title })); toast.success(t('titleApplied')) }}>{t('apply')}</Button>}>
                    <p className="text-2xs text-muted">{t('suggestedTitle')} ({s.auditResult.suggested_title.length})</p><p dir="auto" className="text-sm text-ink">{s.auditResult.suggested_title}</p>
                  </ListRow>
                )}
                {s.auditResult.suggested_meta && (
                  <ListRow end={<Button size="xs" onClick={() => { s.setForm(f => ({ ...f, site_description: s.auditResult.suggested_meta })); toast.success(t('metaApplied')) }}>{t('apply')}</Button>}>
                    <p className="text-2xs text-muted">{t('suggestedMeta')} ({s.auditResult.suggested_meta.length})</p><p dir="auto" className="text-sm text-ink">{s.auditResult.suggested_meta}</p>
                  </ListRow>
                )}
                {s.auditResult.suggested_h1 && (
                  <ListRow end={<CopyButton size="xs" text={s.auditResult.suggested_h1} label={t('copy')} />}>
                    <p className="text-2xs text-muted">{t('suggestedH1AddPage')}</p><p dir="auto" className="text-sm text-ink">{s.auditResult.suggested_h1}</p>
                  </ListRow>
                )}
                <Button fullWidth loading={s.saving} onClick={() => s.save()}>{t('saveAllAppliedChanges')}</Button>
              </div>
            </div>
          )}
        </SeoCard>
      </div>

      {/* Keyword research */}
      <SeoCard icon={KeyIcon} title={t('aiKeywordResearch')} subtitle={t('describeBusiness20Keywords')}>
        <Textarea rows={4} value={s.kwBusiness} onChange={e => s.setKwBusiness(e.target.value)} aria-label={t('businessDescription')}
          placeholder={t('exampleWhatsappAutomationSaas')} />
        <Button icon={SparklesIcon} loading={s.aiLoading === 'keywords'} onClick={s.researchKeywords}>{t('researchKeywords')}</Button>
        {s.kwResult.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">{tn('keywordsFound', s.kwResult.length, { n: s.kwResult.length })}</p>
              <div className="flex gap-1.5">
                <CopyButton size="xs" text={s.kwResult.map((k: any) => k.keyword).join(', ')} label={t('copyAll')} />
                <Button size="xs" loading={s.saving} onClick={() => s.applyAndSave({ focus_kw: s.kwResult.map((k: any) => k.keyword).join(', ').slice(0, 500) })}>
                  {t('saveAllFocusKeywords')}
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
                      <ListRow key={i} end={<Button size="xs" variant="ghost" icon={PlusIcon} disabled={s.trackingKws.some(t => t.kw === kw.keyword)} onClick={() => { s.trackKeyword(kw.keyword, kw.suggestion || '/'); toast.success(t('addedRankTracker')) }}>{t('track')}</Button>}>
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
