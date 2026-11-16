import React from 'react'
import {
  ArrowTopRightOnSquareIcon, BeakerIcon, ChartBarIcon, CodeBracketIcon, Cog6ToothIcon, DocumentTextIcon, MapIcon, PhotoIcon, TagIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/20/solid'
import { Badge, Button, Field, Input, Switch, Textarea, cn } from '@/components/ui'
import { useAdminT } from '../../i18n'
import { CopyButton, Notice } from '../../shared'
import { NETLIFY_HEADERS, NETLIFY_HEADERS_COPY, OG_TEMPLATES, PUBLIC_PAGES, SCHEMA_TEMPLATES } from '../data'
import type { SeoState } from '../useSeoAdmin'
import { CharCount, ListRow, PriorityBadge, SeoCard, SerpPreview } from '../ui'

const SaveBar = ({ s, label }: { s: SeoState; label: string }) => (
  <div className="flex justify-end"><Button loading={s.saving} onClick={() => s.save()}>{label}</Button></div>
)
const str = (s: SeoState, k: string) => String((s.form as Record<string, unknown>)[k] ?? '')

/* ── Meta tags ── */
export function MetaTab({ s }: { s: SeoState }) {
  const { tr } = useAdminT()
  const set = (k: string, v: string) => s.setForm(f => ({ ...f, [k]: v }))
  const fields = [
    { key: 'site_title', label: tr('عنوان الموقع', 'Site title'), ph: 'WABEK — WhatsApp Business Platform', desc: tr('عنوان التبويب في كل الصفحات (50–60 حرفًا مثالي)', 'Browser tab title on all pages (50–60 chars ideal)'), max: 60 },
    { key: 'title_template', label: tr('قالب العنوان', 'Title template'), ph: '%page% | WABEK', desc: tr('للصفحات الداخلية. استخدم %page% لاسم الصفحة و%site% لاسم الموقع.', 'For inner pages. Use %page% for the page name and %site% for the site name.'), max: 80, ltr: true },
    { key: 'site_description', label: tr('وصف Meta', 'Meta description'), ph: tr('صف منصتك…', 'Describe your platform…'), desc: tr('نص المقتطف في Google (150–160 حرفًا مثالي)', 'Google snippet text (150–160 chars ideal)'), max: 160, textarea: true },
    { key: 'focus_kw', label: tr('الكلمات المفتاحية', 'Focus keywords'), ph: 'WhatsApp automation, …', desc: tr('الكلمات الأساسية مفصولة بفواصل', 'Primary keywords, comma separated'), textarea: true },
    { key: 'canonical', label: tr('النطاق الأساسي', 'Canonical domain'), ph: 'https://waabek.com', desc: tr('يُستخدم في وسوم canonical لمنع المحتوى المكرر', 'Used in canonical link tags to prevent duplicate content'), ltr: true },
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" icon={TagIcon} title={tr('وسوم Meta العامة', 'Global meta tags')}>
        {fields.map(f => (
          <Field key={f.key} label={f.label} hint={f.desc} labelAction={f.max ? <CharCount n={str(s, f.key).length} max={f.max} /> : undefined}>
            {f.textarea
              ? <Textarea rows={3} value={str(s, f.key)} onChange={e => set(f.key, e.target.value)} placeholder={f.ph} />
              : <Input dir={f.ltr ? 'ltr' : undefined} value={str(s, f.key)} onChange={e => set(f.key, e.target.value)} placeholder={f.ph} />}
          </Field>
        ))}
        <SaveBar s={s} label={tr('حفظ وسوم Meta', 'Save meta settings')} />
      </SeoCard>
      <div className="space-y-5 xl:col-span-2">
        <SeoCard title={tr('معاينة Google', 'Google preview')}>
          <SerpPreview title={str(s, 'site_title') || 'WABEK — WhatsApp Business Platform'} url="waabek.com" description={str(s, 'site_description')} />
        </SeoCard>
        <SeoCard icon={CodeBracketIcon} title={tr('وسوم مخصّصة في <head>', 'Custom head tags')} subtitle={tr('وسوم أو رموز تحقق أو سكربتات', 'Meta tags, verification codes or scripts')}>
          <Textarea rows={6} dir="ltr" className="font-mono text-xs" value={str(s, 'custom_head')} onChange={e => set('custom_head', e.target.value)}
            placeholder={'<meta name="custom" content="value" />\n<link rel="preconnect" href="https://fonts.googleapis.com" />'} />
          <SaveBar s={s} label={tr('حفظ', 'Save')} />
        </SeoCard>
      </div>
    </div>
  )
}

/* ── Open Graph ── */
export function OgTab({ s }: { s: SeoState }) {
  const { tr } = useAdminT()
  const og = str(s, 'og_image')
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SeoCard icon={PhotoIcon} title={tr('Open Graph وبطاقات المشاركة', 'Open Graph & social cards')} subtitle={tr('شكل صفحاتك عند مشاركتها على واتساب وفيسبوك وX ولينكدإن.', 'How pages look when shared on WhatsApp, Facebook, X and LinkedIn.')}>
        <Field label={tr('صورة OG العامة', 'Global OG image URL')} hint={tr('الصورة الافتراضية لكل الصفحات، 1200×630', 'Default image for all pages, 1200×630')}>
          <Input dir="ltr" value={og} onChange={e => s.setForm(f => ({ ...f, og_image: e.target.value }))} placeholder="https://waabek.com/og-image.jpg" />
        </Field>
        <Field label={tr('حساب X (تويتر)', 'X (Twitter) handle')}>
          <Input dir="ltr" value={str(s, 'twitter_handle')} onChange={e => s.setForm(f => ({ ...f, twitter_handle: e.target.value }))} placeholder="@waabek" />
        </Field>
        {og && (
          <div>
            <p className="mb-2 text-xs text-muted">{tr('معاينة واتساب / فيسبوك:', 'WhatsApp / Facebook preview:')}</p>
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
        <SaveBar s={s} label={tr('حفظ إعدادات OG', 'Save OG settings')} />
      </SeoCard>
      <SeoCard title={tr('قوالب OG لكل صفحة', 'Per-page OG templates')}>
        <div className="space-y-2.5">
          {Object.entries(OG_TEMPLATES).map(([key, t]) => (
            <ListRow key={key} end={<CopyButton text={JSON.stringify(t, null, 2)} label={tr(`نسخ ${key}`, `Copy ${key}`)} />}>
              <p className="text-sm font-medium capitalize text-ink">{key}</p>
              <p dir="ltr" className="text-start text-xs italic text-body">“{t.title}”</p>
              <p dir="ltr" className="line-clamp-2 text-start text-2xs text-muted">{t.desc}</p>
            </ListRow>
          ))}
        </div>
      </SeoCard>
    </div>
  )
}

/* ── Structured data ── */
export function SchemaTab({ s }: { s: SeoState }) {
  const { tr } = useAdminT()
  const saved = (k: string) => !!(s.form as Record<string, unknown>)['schema_' + k.toLowerCase()]
  const where = [
    { page: tr('الرئيسية (/)', 'Homepage (/)'), schemas: ['Organization', 'WebSite', 'SoftwareApplication'], p: 'HIGH' },
    { page: tr('الأسعار (/pricing)', 'Pricing (/pricing)'), schemas: ['PriceSpecification', 'Product'], p: 'HIGH' },
    { page: tr('مقالات المدونة', 'Blog posts'), schemas: ['BlogPosting', 'Article', 'BreadcrumbList'], p: 'MEDIUM' },
    { page: tr('الدعم (/support)', 'Support (/support)'), schemas: ['FAQPage'], p: 'MEDIUM' },
    { page: tr('من نحن (/about)', 'About (/about)'), schemas: ['AboutPage', 'Organization'], p: 'LOW' },
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" icon={CodeBracketIcon} title={tr('بيانات JSON-LD المنظمة', 'JSON-LD structured data')} subtitle={tr('المقتطفات المنسّقة تساعد Google على فهم المحتوى وإظهار نتائج محسّنة.', 'Rich snippets help Google understand content and show enhanced results.')}>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr('نوع المخطط', 'Schema type')}>
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
          <Button onClick={() => s.saveSchema(s.selectedSchema, s.schemaCode)}>{tr('حفظ وحقن في الموقع', 'Save & inject to site')}</Button>
          <CopyButton size="sm" text={s.schemaCode} label={tr('نسخ JSON-LD', 'Copy JSON-LD')} />
          <Button variant="secondary" size="sm" icon={BeakerIcon} href="https://search.google.com/test/rich-results" external>{tr('اختبار مع Google', 'Test with Google')}</Button>
        </div>
        <p className="text-xs text-muted">{tr('بعد الحفظ يُحقن المخطط عبر مكوّن <Head> في _app.tsx.', 'After saving, the schema is injected via the <Head> component in _app.tsx.')}</p>
      </SeoCard>
      <SeoCard className="xl:col-span-2" title={tr('أين تضيف البيانات المنظمة', 'Where to add structured data')}>
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
  const { tr } = useAdminT()
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <SeoCard icon={MapIcon} title={tr('خريطة الموقع XML', 'XML sitemap')} subtitle={tr(`تُولَّد تلقائيًا في /sitemap.xml — ${PUBLIC_PAGES.length} رابطًا`, `Auto-generated at /sitemap.xml — ${PUBLIC_PAGES.length} URLs`)}
        action={<div className="flex gap-1.5"><Button size="xs" variant="secondary" href="/sitemap.xml" external iconEnd={ArrowTopRightOnSquareIcon}>{tr('عرض', 'View')}</Button><CopyButton size="xs" text="https://waabek.com/sitemap.xml" label={tr('نسخ الرابط', 'Copy URL')} /></div>}>
        <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pe-1">
          {PUBLIC_PAGES.map(p => (
            <li key={p.path} dir="ltr" className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-xs">
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-mono text-ink">{p.path}</span>
              <span className="text-muted">{p.changefreq}</span>
              <span className="tabular text-brand-ink">{p.priority}</span>
            </li>
          ))}
        </ul>
        <Notice tone="success" title={tr('الإرسال إلى Google Search Console', 'Submit to Google Search Console')}>
          <ol className="mt-1 list-decimal space-y-0.5 ps-4 text-xs">
            <li>{tr('افتح', 'Open')} <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="underline">search.google.com/search-console</a></li>
            <li>{tr('أضف موقعًا ← بادئة URL ← https://waabek.com', 'Add property → URL prefix → https://waabek.com')}</li>
            <li>{tr('خرائط الموقع ← أضف sitemap.xml ← إرسال', 'Sitemaps → Add sitemap → sitemap.xml → Submit')}</li>
          </ol>
        </Notice>
      </SeoCard>
      <SeoCard icon={DocumentTextIcon} title="robots.txt" action={<Button size="xs" variant="secondary" href="/robots.txt" external iconEnd={ArrowTopRightOnSquareIcon}>{tr('عرض المنشور', 'View live')}</Button>}>
        <Textarea rows={12} dir="ltr" className="font-mono text-xs" value={str(s, 'robots_txt')} onChange={e => s.setForm(f => ({ ...f, robots_txt: e.target.value }))} aria-label="robots.txt" />
        <SaveBar s={s} label={tr('حفظ robots.txt', 'Save robots.txt')} />
      </SeoCard>
    </div>
  )
}

/* ── Technical ── */
export function TechnicalTab({ s }: { s: SeoState }) {
  const { tr } = useAdminT()
  const f = s.form as Record<string, unknown>
  const checklist = [
    { check: tr('ضغط أصول Netlify (Brotli/Gzip)', 'Enable Netlify asset compression (Brotli/Gzip)'), done: true },
    { check: tr('استخدام مكوّن Next.js Image لتحويل WebP', 'Use Next.js Image component for automatic WebP conversion'), done: true },
    { check: tr('تحميل كسول للصور أسفل الصفحة', 'Implement lazy loading for below-the-fold images'), done: false },
    { check: tr('تقليل حزم JavaScript غير المستخدمة', 'Minimize unused JavaScript bundles'), done: false },
    { check: tr('ترويسات تخزين مؤقت للأصول الثابتة (سنة)', 'Set cache headers for static assets (1 year)'), done: true },
    { check: tr('استخدام CDN لكل الأصول الثابتة', 'Use CDN for all static assets'), done: true },
    { check: tr('preconnect للمصادر الخارجية', 'Preconnect to external origins (Google Fonts, APIs)'), done: false },
    { check: tr('تقليل CLS بتحديد أبعاد الصور', 'Reduce Cumulative Layout Shift (CLS) with image dimensions'), done: false },
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <SeoCard icon={Cog6ToothIcon} title={tr('الإعدادات التقنية', 'Technical settings')}>
          <div className="space-y-2">
            {[
              { key: 'index_site', label: tr('السماح بالفهرسة', 'Index site'), desc: tr('السماح لـ Google بفهرسة الصفحات العامة (الإيقاف = noindex للكل)', 'Allow Google to index public pages (off = noindex all)') },
              { key: 'redirect_www', label: tr('تحويل www إلى بدون www', 'Redirect www to non-www'), desc: 'www.waabek.com → waabek.com' },
              { key: 'force_https', label: tr('فرض HTTPS', 'Force HTTPS'), desc: tr('تحويل كل حركة HTTP إلى HTTPS', 'Redirect all HTTP traffic to HTTPS') },
            ].map(t => (
              <div key={t.key} className="rounded-xl bg-surface-2 px-3.5 py-3">
                <Switch checked={!!f[t.key]} onChange={v => s.setForm(p => ({ ...p, [t.key]: v }))} label={t.label} description={t.desc} />
              </div>
            ))}
          </div>
          <SaveBar s={s} label={tr('حفظ الإعدادات التقنية', 'Save technical settings')} />
        </SeoCard>
        <SeoCard icon={CodeBracketIcon} title={tr('ترويسات Netlify لـ SEO', 'Netlify SEO headers')} subtitle={tr('أضفها إلى netlify.toml', 'Add to netlify.toml')} action={<CopyButton size="xs" text={NETLIFY_HEADERS_COPY} label={tr('نسخ', 'Copy config')} />}>
          <pre dir="ltr" className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-start font-mono text-xs text-body">{NETLIFY_HEADERS}</pre>
        </SeoCard>
      </div>
      <SeoCard title={tr('قائمة مؤشرات الأداء', 'Core Web Vitals checklist')} subtitle={tr('قائمة مرجعية ثابتة', 'Static reference checklist')}>
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
  const { tr } = useAdminT()
  const fields = [
    { label: 'Google Analytics 4 Measurement ID', key: 'ga_id', ph: 'G-XXXXXXXXXX', desc: tr('تتبّع الزوار والجلسات والتحويلات', 'Track visitors, sessions and conversions'), link: 'https://analytics.google.com', linkLabel: tr('إنشاء خاصية GA4', 'Create GA4 property') },
    { label: tr('رمز تحقق Google Search Console', 'Google Search Console verification'), key: 'gsc_verify', ph: 'content="xxxxxxxxxxxx"', desc: tr('أثبت الملكية للوصول إلى Search Console', 'Verify ownership for Search Console access'), link: 'https://search.google.com/search-console', linkLabel: tr('فتح Search Console', 'Open Search Console') },
    { label: 'Facebook Pixel ID', key: 'fb_pixel', ph: '123456789012345', desc: tr('تتبّع تحويلات إعلانات فيسبوك وإعادة الاستهداف', 'Track Facebook ad conversions and remarketing'), link: 'https://business.facebook.com/events_manager', linkLabel: tr('إنشاء Pixel', 'Create Pixel') },
    { label: 'Hotjar Site ID', key: 'hotjar_id', ph: '1234567', desc: tr('خرائط حرارية وتسجيلات للجلسات', 'Heatmaps and session recordings'), link: 'https://hotjar.com', linkLabel: tr('احصل على المعرّف', 'Get Hotjar ID') },
  ]
  const recs = [
    { t: tr('أهداف GA4 لتسجيلات التجربة المجانية', 'Set up GA4 goals for free trial signups'), p: 'HIGH' },
    { t: tr('تتبّع نقرات «ابدأ مجانًا» كتحويلات', 'Track “Get Started Free” clicks as conversions'), p: 'HIGH' },
    { t: tr('مسار GA4: زيارة ← تسجيل ← أول رسالة', 'GA4 funnel: Visit → Signup → First message sent'), p: 'HIGH' },
    { t: tr('ربط GA4 مع Search Console لبيانات الكلمات', 'Link GA4 with Search Console for keyword data'), p: 'MEDIUM' },
    { t: tr('Hotjar لمعرفة نقاط الخروج في صفحة الأسعار', 'Install Hotjar to see drop-off on the pricing page'), p: 'MEDIUM' },
    { t: tr('Pixel فيسبوك لحملات إعادة الاستهداف', 'Set up FB Pixel for retargeting campaigns'), p: 'LOW' },
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" icon={ChartBarIcon} title={tr('التحليلات والتتبّع', 'Analytics & tracking')}>
        {fields.map(f => (
          <Field key={f.key} label={f.label} hint={f.desc}
            labelAction={<a href={f.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-link hover:text-link-hover">{f.linkLabel}<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" /></a>}>
            <Input dir="ltr" className="font-mono" value={str(s, f.key)} onChange={e => s.setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
              endAdornment={str(s, f.key) ? <CheckCircleIcon className="h-4 w-4 text-success" aria-label={tr('مضبوط', 'Configured')} /> : undefined} />
          </Field>
        ))}
        <SaveBar s={s} label={tr('حفظ التحليلات', 'Save analytics')} />
      </SeoCard>
      <SeoCard className="xl:col-span-2" title={tr('إعداد مقترح للتحليلات', 'Recommended analytics setup')}>
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
