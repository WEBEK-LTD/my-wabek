import React from 'react'
import {
  ArrowTopRightOnSquareIcon, BeakerIcon, ChartBarIcon, CodeBracketIcon, Cog6ToothIcon, DocumentTextIcon, MapIcon, PhotoIcon, TagIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/20/solid'
import { Badge, Button, Field, Input, Switch, Textarea, cn } from '@/components/ui'
import { useAdminT, useEnumLabel } from '../../i18n'
import { CopyButton, Notice } from '../../shared'
import { NETLIFY_HEADERS, NETLIFY_HEADERS_COPY, OG_TEMPLATES, PUBLIC_PAGES, SCHEMA_TEMPLATES } from '../data'
import type { SeoState } from '../useSeoAdmin'
import { CharCount, ListRow, PriorityBadge, SeoCard, SerpPreview, usePageLabel } from '../ui'
import messages from '@/locales/admin/seo/onpage'

const SaveBar = ({ s, label }: { s: SeoState; label: string }) => (
  <div className="flex justify-end"><Button loading={s.saving} onClick={() => s.save()}>{label}</Button></div>
)
const str = (s: SeoState, k: string) => String((s.form as Record<string, unknown>)[k] ?? '')

/* ── Meta tags ── */
export function MetaTab({ s }: { s: SeoState }) {
  const { t } = useAdminT(messages)
  const set = (k: string, v: string) => s.setForm(f => ({ ...f, [k]: v }))
  const fields = [
    { key: 'site_title', label: t('siteTitle'), ph: t('siteTitlePlaceholder'), desc: t('browserTabTitleAll'), max: 60 },
    { key: 'title_template', label: t('titleTemplate'), ph: '%page% | WABEK', desc: t('innerPagesUsePage'), max: 80, ltr: true },
    { key: 'site_description', label: t('metaDescription'), ph: t('describePlatform'), desc: t('googleSnippetText150'), max: 160, textarea: true },
    { key: 'focus_kw', label: t('focusKeywords'), ph: t('focusKwPlaceholder'), desc: t('primaryKeywordsCommaSeparated'), textarea: true },
    { key: 'canonical', label: t('canonicalDomain'), ph: 'https://waabek.com', desc: t('usedCanonicalLinkTags'), ltr: true },
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" icon={TagIcon} title={t('globalMetaTags')}>
        {fields.map(f => (
          <Field key={f.key} label={f.label} hint={f.desc} labelAction={f.max ? <CharCount n={str(s, f.key).length} max={f.max} /> : undefined}>
            {f.textarea
              ? <Textarea rows={3} value={str(s, f.key)} onChange={e => set(f.key, e.target.value)} placeholder={f.ph} />
              : <Input dir={f.ltr ? 'ltr' : undefined} value={str(s, f.key)} onChange={e => set(f.key, e.target.value)} placeholder={f.ph} />}
          </Field>
        ))}
        <SaveBar s={s} label={t('saveMetaSettings')} />
      </SeoCard>
      <div className="space-y-5 xl:col-span-2">
        <SeoCard title={t('googlePreview')}>
          <SerpPreview title={str(s, 'site_title') || t('siteTitlePlaceholder')} url="waabek.com" description={str(s, 'site_description')} />
        </SeoCard>
        <SeoCard icon={CodeBracketIcon} title={t('customHeadTags')} subtitle={t('metaTagsVerificationCodes')}>
          <Textarea rows={6} dir="ltr" className="font-mono text-xs" value={str(s, 'custom_head')} onChange={e => set('custom_head', e.target.value)}
            placeholder={'<meta name="custom" content="value" />\n<link rel="preconnect" href="https://fonts.googleapis.com" />'} />
          <SaveBar s={s} label={t('save')} />
        </SeoCard>
      </div>
    </div>
  )
}

/* ── Open Graph ── */
export function OgTab({ s }: { s: SeoState }) {
  const { t } = useAdminT(messages)
  const pageLabel = usePageLabel()
  const ogLabel = (key: string) => pageLabel({ path: key === 'homepage' ? '/' : `/${key}`, label: key })
  const og = str(s, 'og_image')
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SeoCard icon={PhotoIcon} title={t('openGraphSocialCards')} subtitle={t('howPagesLookWhen')}>
        <Field label={t('globalOgImageUrl')} hint={t('defaultImageAllPages')}>
          <Input dir="ltr" value={og} onChange={e => s.setForm(f => ({ ...f, og_image: e.target.value }))} placeholder="https://waabek.com/og-image.jpg" />
        </Field>
        <Field label={t('xTwitterHandle')}>
          <Input dir="ltr" value={str(s, 'twitter_handle')} onChange={e => s.setForm(f => ({ ...f, twitter_handle: e.target.value }))} placeholder="@waabek" />
        </Field>
        {og && (
          <div>
            <p className="mb-2 text-xs text-muted">{t('whatsappFacebookPreview')}</p>
            <div className="max-w-sm overflow-hidden rounded-xl border border-line bg-white" dir="ltr">
              <div className="flex h-40 items-center justify-center bg-[#f0f2f5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={og} alt="" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </div>
              <div className="border-t border-[#e4e6eb] p-3 text-start">
                <p className="text-2xs uppercase text-[#65676b]">waabek.com</p>
                <p className="mt-0.5 text-sm font-semibold text-[#050505]">{str(s, 'site_title')}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-[#65676b]">{str(s, 'site_description')}</p>
              </div>
            </div>
          </div>
        )}
        <SaveBar s={s} label={t('saveOgSettings')} />
      </SeoCard>
      <SeoCard title={t('perPageOgTemplates')}>
        <div className="space-y-2.5">
          {Object.entries(OG_TEMPLATES).map(([key, tpl]) => (
            <ListRow key={key} end={<CopyButton text={JSON.stringify(tpl, null, 2)} label={t('copyAlt', { key: ogLabel(key) })} />}>
              <p className="text-sm font-medium text-ink">{ogLabel(key)}</p>
              <p dir="ltr" lang="en" className="text-start text-xs italic text-body">“{tpl.title}”</p>
              <p dir="ltr" lang="en" className="line-clamp-2 text-start text-2xs text-muted">{tpl.desc}</p>
            </ListRow>
          ))}
        </div>
      </SeoCard>
    </div>
  )
}

/* ── Structured data ── */
export function SchemaTab({ s }: { s: SeoState }) {
  const { t } = useAdminT(messages)
  const saved = (k: string) => !!(s.form as Record<string, unknown>)['schema_' + k.toLowerCase()]
  const where = [
    { page: t('homepage'), schemas: ['Organization', 'WebSite', 'SoftwareApplication'], p: 'HIGH' },
    { page: t('pricingPricing'), schemas: ['PriceSpecification', 'Product'], p: 'HIGH' },
    { page: t('blogPosts'), schemas: ['BlogPosting', 'Article', 'BreadcrumbList'], p: 'MEDIUM' },
    { page: t('supportSupport'), schemas: ['FAQPage'], p: 'MEDIUM' },
    { page: t('aboutAbout'), schemas: ['AboutPage', 'Organization'], p: 'LOW' },
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" icon={CodeBracketIcon} title={t('jsonLdStructuredData')} subtitle={t('richSnippetsHelpGoogle')}>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('schemaType')}>
          {Object.keys(SCHEMA_TEMPLATES).map(k => (
            <button key={k} type="button" role="radio" aria-checked={s.selectedSchema === k} onClick={() => { s.setSelectedSchema(k); s.setSchemaCode(SCHEMA_TEMPLATES[k]) }}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                s.selectedSchema === k ? 'border-brand-teal bg-chip text-chip-ink' : 'border-line text-muted hover:text-ink')}>
              {saved(k) && <CheckCircleIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" />}{k}
            </button>
          ))}
        </div>
        <Textarea rows={16} dir="ltr" className="font-mono text-xs" value={s.schemaCode} onChange={e => s.setSchemaCode(e.target.value)} aria-label="JSON-LD" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => s.saveSchema(s.selectedSchema, s.schemaCode)}>{t('saveInjectSite')}</Button>
          <CopyButton size="sm" text={s.schemaCode} label={t('copyJsonLd')} />
          <Button variant="secondary" size="sm" icon={BeakerIcon} href="https://search.google.com/test/rich-results" external>{t('testGoogle')}</Button>
        </div>
        <p className="text-xs text-muted">{t('afterSavingSchemaInjected')}</p>
      </SeoCard>
      <SeoCard className="xl:col-span-2" title={t('whereAddStructuredData')}>
        <div className="space-y-2">
          {where.map(r => (
            <ListRow key={r.page} end={<PriorityBadge p={r.p} />}>
              <p className="text-sm text-ink">{r.page}</p>
              <div className="mt-1 flex flex-wrap gap-1">{r.schemas.map(x => <Badge key={x} size="sm" tone="neutral">{x}</Badge>)}</div>
            </ListRow>
          ))}
        </div>
      </SeoCard>
    </div>
  )
}

/* ── Sitemap & robots ── */
export function SitemapTab({ s }: { s: SeoState }) {
  const { t } = useAdminT(messages)
  const label = useEnumLabel()
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SeoCard icon={MapIcon} title={t('xmlSitemap')} subtitle={t('autoGeneratedSitemapXml', { PUBLIC_PAGESCount: PUBLIC_PAGES.length })}
        action={<div className="flex gap-1.5"><Button size="xs" variant="secondary" href="/sitemap.xml" external iconEnd={ArrowTopRightOnSquareIcon}>{t('view')}</Button><CopyButton size="xs" text="https://waabek.com/sitemap.xml" label={t('copyUrl')} /></div>}>
        <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pe-1">
          {PUBLIC_PAGES.map(p => (
            <li key={p.path} dir="ltr" className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-xs">
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-mono text-ink">{p.path}</span>
              <span className="text-muted">{label('changefreq', p.changefreq)}</span>
              <span className="tabular text-brand-ink">{p.priority}</span>
            </li>
          ))}
        </ul>
        <Notice tone="success" title={t('submitGoogleSearchConsole')}>
          <ol className="mt-1 list-decimal space-y-0.5 ps-4 text-xs">
            <li>{t('openAlt')} <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="underline">search.google.com/search-console</a></li>
            <li>{t('addPropertyUrlPrefix')}</li>
            <li>{t('sitemapsAddSitemapSitemap')}</li>
          </ol>
        </Notice>
      </SeoCard>
      <SeoCard icon={DocumentTextIcon} title="robots.txt" action={<Button size="xs" variant="secondary" href="/robots.txt" external iconEnd={ArrowTopRightOnSquareIcon}>{t('viewLive')}</Button>}>
        <Textarea rows={12} dir="ltr" className="font-mono text-xs" value={str(s, 'robots_txt')} onChange={e => s.setForm(f => ({ ...f, robots_txt: e.target.value }))} aria-label="robots.txt" />
        <SaveBar s={s} label={t('saveRobotsTxt')} />
      </SeoCard>
    </div>
  )
}

/* ── Technical ── */
export function TechnicalTab({ s }: { s: SeoState }) {
  const { t } = useAdminT(messages)
  const f = s.form as Record<string, unknown>
  const checklist = [
    { check: t('enableNetlifyAssetCompression'), done: true },
    { check: t('useNextJsImage'), done: true },
    { check: t('implementLazyLoadingBelow'), done: false },
    { check: t('minimizeUnusedJavascriptBundles'), done: false },
    { check: t('setCacheHeadersStatic'), done: true },
    { check: t('useCdnAllStatic'), done: true },
    { check: t('preconnectExternalOriginsGoogle'), done: false },
    { check: t('reduceCumulativeLayoutShift'), done: false },
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <SeoCard icon={Cog6ToothIcon} title={t('technicalSettings')}>
          <div className="space-y-2">
            {[
              { key: 'index_site', label: t('indexSite'), desc: t('allowGoogleIndexPublic') },
              { key: 'redirect_www', label: t('redirectWwwNonWww'), desc: 'www.waabek.com → waabek.com' },
              { key: 'force_https', label: t('forceHttps'), desc: t('redirectAllHttpTraffic') },
            ].map(t => (
              <div key={t.key} className="rounded-xl bg-surface-2 px-3.5 py-3">
                <Switch checked={!!f[t.key]} onChange={v => s.setForm(p => ({ ...p, [t.key]: v }))} label={t.label} description={t.desc} />
              </div>
            ))}
          </div>
          <SaveBar s={s} label={t('saveTechnicalSettings')} />
        </SeoCard>
        <SeoCard icon={CodeBracketIcon} title={t('netlifySeoHeaders')} subtitle={t('addNetlifyToml')} action={<CopyButton size="xs" text={NETLIFY_HEADERS_COPY} label={t('copyConfig')} />}>
          <pre dir="ltr" className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-start font-mono text-xs text-body">{NETLIFY_HEADERS}</pre>
        </SeoCard>
      </div>
      <SeoCard title={t('coreWebVitalsChecklist')} subtitle={t('staticReferenceChecklist')}>
        <ul className="space-y-2">
          {checklist.map((c, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
              {c.done ? <CheckCircleIcon className="h-5 w-5 shrink-0 text-success" aria-hidden="true" /> : <span className="h-5 w-5 shrink-0 rounded-full border-2 border-line-strong" aria-hidden="true" />}
              <p className={cn('text-sm', c.done ? 'text-muted line-through' : 'text-ink')}>{c.check}</p>
            </li>
          ))}
        </ul>
      </SeoCard>
    </div>
  )
}

/* ── Analytics ── */
export function AnalyticsTab({ s }: { s: SeoState }) {
  const { t } = useAdminT(messages)
  const fields = [
    { label: t('ga4MeasurementId'), key: 'ga_id', ph: 'G-XXXXXXXXXX', desc: t('trackVisitorsSessionsConversions'), link: 'https://analytics.google.com', linkLabel: t('createGa4Property') },
    { label: t('googleSearchConsoleVerification'), key: 'gsc_verify', ph: 'content="xxxxxxxxxxxx"', desc: t('verifyOwnershipSearchConsole'), link: 'https://search.google.com/search-console', linkLabel: t('openSearchConsole') },
    { label: t('facebookPixelId'), key: 'fb_pixel', ph: '123456789012345', desc: t('trackFacebookAdConversions'), link: 'https://business.facebook.com/events_manager', linkLabel: t('createPixel') },
    { label: t('hotjarSiteId'), key: 'hotjar_id', ph: '1234567', desc: t('heatmapsSessionRecordings'), link: 'https://hotjar.com', linkLabel: t('getHotjarId') },
  ]
  const recs = [
    { t: t('setUpGa4Goals'), p: 'HIGH' },
    { t: t('trackGetStartedFree'), p: 'HIGH' },
    { t: t('ga4FunnelVisitSignup'), p: 'HIGH' },
    { t: t('linkGa4SearchConsole'), p: 'MEDIUM' },
    { t: t('installHotjarSeeDrop'), p: 'MEDIUM' },
    { t: t('setUpFbPixel'), p: 'LOW' },
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" icon={ChartBarIcon} title={t('analyticsTracking')}>
        {fields.map(f => (
          <Field key={f.key} label={f.label} hint={f.desc}
            labelAction={<a href={f.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-link hover:text-link-hover">{f.linkLabel}<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" /></a>}>
            <Input dir="ltr" className="font-mono" value={str(s, f.key)} onChange={e => s.setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
              endAdornment={str(s, f.key) ? <CheckCircleIcon className="h-4 w-4 text-success" aria-label={t('configured')} /> : undefined} />
          </Field>
        ))}
        <SaveBar s={s} label={t('saveAnalytics')} />
      </SeoCard>
      <SeoCard className="xl:col-span-2" title={t('recommendedAnalyticsSetup')}>
        <ol className="space-y-2">
          {recs.map((r, i) => (
            <ListRow key={i} end={<PriorityBadge p={r.p} />}>
              <div className="flex items-center gap-2.5"><span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chip text-xs font-semibold text-chip-ink">{i + 1}</span><p className="text-sm text-ink">{r.t}</p></div>
            </ListRow>
          ))}
        </ol>
      </SeoCard>
    </div>
  )
}
