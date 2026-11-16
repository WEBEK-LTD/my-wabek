import React, { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, ArrowTopRightOnSquareIcon, BellAlertIcon, ChartBarIcon, CheckCircleIcon, ExclamationTriangleIcon, GlobeAltIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, Field, Input, Switch, Textarea } from '@/components/ui'
import { apiError, useAdminT } from '../i18n'
import { Notice, SecretField, Steps } from '../shared'

type Obj = Record<string, unknown>
const SEO_DEFAULTS = { meta_title: '', meta_description: '', og_image: '', ga_id: '', fb_pixel: '', custom_head_code: '' }
const WEB_DEFAULTS = {
  google_site_verification: '', bing_site_verification: '', pinterest_verification: '', yandex_verification: '', baidu_verification: '', norton_verification: '',
  sitemap_url: '', robots_txt: 'User-agent: *\nAllow: /\nSitemap: https://waabek.com/sitemap.xml',
}
const PUSH_DEFAULTS = { vapid_public: '', vapid_private: '', enabled: false }

export function IntegrationsSection({ seo, webmaster, push, onSaved }: { seo: Obj; webmaster?: Obj; push?: Obj; onSaved: () => void }) {
  const { tr } = useAdminT()
  const [seoForm, setSeoForm] = useState<Obj>({ ...SEO_DEFAULTS })
  const [webForm, setWebForm] = useState<Record<string, string>>({ ...WEB_DEFAULTS })
  const [pushForm, setPushForm] = useState<{ vapid_public: string; vapid_private: string; enabled: boolean }>({ ...PUSH_DEFAULTS })
  const [saving, setSaving] = useState<string | null>(null)
  const [pushStats, setPushStats] = useState<{ sent?: number; total?: number } | null>(null)
  const [pushSend, setPushSend] = useState({ title: '', body: '', url: '/dashboard' })
  const [pushSending, setPushSending] = useState(false)

  useEffect(() => { setSeoForm({ ...SEO_DEFAULTS, ...seo }) }, [seo])
  useEffect(() => { if (webmaster) setWebForm(f => ({ ...f, ...(webmaster as Record<string, string>) })) }, [webmaster])
  useEffect(() => { if (push) setPushForm({ ...PUSH_DEFAULTS, ...(push as typeof PUSH_DEFAULTS) }) }, [push])
  const loadCount = () => axios.get('/api/push/count').then(r => setPushStats(s => ({ ...s, total: r.data.count }))).catch(() => {})
  useEffect(() => { loadCount() }, [])

  const put = async (key: string, body: Obj, ok: string) => {
    setSaving(key)
    try { await axios.put('/api/admin/seo', body); toast.success(ok); onSaved() }
    catch (e) { toast.error(apiError(e, tr('تعذّر الحفظ', 'Failed to save'))) }
    setSaving(null)
  }
  const sv = (k: string) => (seoForm[k] as string) || ''

  const sendPush = async () => {
    if (!pushSend.title || !pushSend.body) { toast.error(tr('العنوان والنص مطلوبان', 'Title and body are required')); return }
    setPushSending(true)
    try {
      const r = await axios.post('/api/push/send', pushSend)
      setPushStats(r.data)
      toast.success(tr(`أُرسل إلى ${r.data.sent} مستخدم`, `Sent to ${r.data.sent} users`))
      setPushSend({ title: '', body: '', url: '/dashboard' })
    } catch (e) { toast.error(apiError(e, tr('تعذّر الإرسال', 'Failed to send'))) }
    setPushSending(false)
  }

  return (
    <div className="space-y-5">
      {/* Analytics & meta */}
      <Card className="space-y-4">
        <CardHeader icon={ChartBarIcon} title={tr('التتبّع والوسوم العامة', 'Tracking & meta tags')} subtitle={tr('أدوات أعمق في صفحة SEO.', 'Deeper tools live on the SEO page.')}
          action={<Button size="sm" variant="ghost" href="/admin/seo" iconEnd={ArrowTopRightOnSquareIcon}>SEO</Button>} />
        <Field label={tr('عنوان Meta', 'Meta title')} hint={tr('حتى 60 حرفًا. اتركه فارغًا للقيمة الافتراضية.', 'Up to 60 characters. Leave empty for the default.')}>
          <Input value={sv('meta_title')} onChange={e => setSeoForm(f => ({ ...f, meta_title: e.target.value }))} maxLength={120} />
        </Field>
        <Field label={tr('وصف Meta', 'Meta description')} hint={tr('حتى 160 حرفًا', 'Up to 160 characters')}>
          <Textarea rows={3} showCount maxLength={320} value={sv('meta_description')} onChange={e => setSeoForm(f => ({ ...f, meta_description: e.target.value }))} />
        </Field>
        <Field label={tr('صورة المشاركة (OG)', 'Share image (OG)')} hint="1200×630"><Input dir="ltr" value={sv('og_image')} onChange={e => setSeoForm(f => ({ ...f, og_image: e.target.value }))} placeholder="https://cdn.example.com/og-image.png" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Google Analytics ID"><Input dir="ltr" className="font-mono" value={sv('ga_id')} onChange={e => setSeoForm(f => ({ ...f, ga_id: e.target.value }))} placeholder="G-XXXXXXXXXX" /></Field>
          <Field label="Facebook Pixel ID"><Input dir="ltr" className="font-mono" value={sv('fb_pixel')} onChange={e => setSeoForm(f => ({ ...f, fb_pixel: e.target.value }))} placeholder="123456789012345" /></Field>
        </div>
        <Field label={tr('كود مخصّص داخل <head>', 'Custom <head> code')} hint={tr('يُحقن في كل الصفحات. استخدمه بحذر.', 'Injected on every page. Use with care.')}>
          <Textarea rows={4} dir="ltr" className="font-mono text-xs" value={sv('custom_head_code')} onChange={e => setSeoForm(f => ({ ...f, custom_head_code: e.target.value }))} placeholder="<!-- tracking code -->" />
        </Field>
        <div className="flex justify-end"><Button loading={saving === 'seo'} onClick={() => put('seo', { seo: seoForm }, tr('حُفظت إعدادات التتبّع', 'Tracking settings saved'))}>{tr('حفظ', 'Save')}</Button></div>
      </Card>

      {/* Webmaster */}
      <Card className="space-y-4">
        <CardHeader icon={GlobeAltIcon} title={tr('أدوات مشرفي المواقع', 'Webmaster tools')} subtitle={tr('أكّد ملكية الموقع لدى محركات البحث.', 'Verify site ownership with search engines.')} />
        <Notice tone="warning" icon={ExclamationTriangleIcon}>
          {tr('واجهة /api/admin/seo لا تحفظ هذه الحقول حاليًا (لا تقبل مفتاح webmaster)، لذا لن تُطبَّق بعد الحفظ.', 'The /api/admin/seo endpoint doesn’t persist these fields yet (no webmaster key), so they won’t apply after saving.')}
        </Notice>
        {[
          { label: 'Google Search Console', key: 'google_site_verification', link: 'https://search.google.com/search-console', desc: tr('Search Console ← إضافة موقع ← طريقة وسم HTML', 'Search Console → Add property → HTML tag') },
          { label: 'Bing Webmaster Tools', key: 'bing_site_verification', link: 'https://www.bing.com/webmasters', desc: tr('Bing Webmaster ← إضافة موقع ← وسم XML', 'Bing Webmaster → Add site → XML meta tag') },
          { label: 'Pinterest', key: 'pinterest_verification', link: 'https://www.pinterest.com/settings/claim', desc: tr('الصق قيمة content فقط من وسم p:domain_verify', 'Paste only the content value of p:domain_verify') },
          { label: 'Yandex Webmaster', key: 'yandex_verification', link: 'https://webmaster.yandex.com', desc: tr('لسوق البحث الروسي', 'For the Russian search market') },
          { label: 'Baidu Webmaster', key: 'baidu_verification', link: 'https://zhanzhang.baidu.com', desc: tr('لسوق البحث الصيني', 'For the Chinese search market') },
        ].map(w => (
          <Field key={w.key} label={w.label} hint={w.desc}
            labelAction={<a href={w.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-link hover:text-link-hover">{tr('احصل على الرمز', 'Get code')}<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" /></a>}>
            <Input dir="ltr" className="font-mono" value={webForm[w.key] || ''} onChange={e => setWebForm(f => ({ ...f, [w.key]: e.target.value }))} />
          </Field>
        ))}
        <Field label={tr('رابط خريطة الموقع', 'Sitemap URL')}><Input dir="ltr" value={webForm.sitemap_url} onChange={e => setWebForm(f => ({ ...f, sitemap_url: e.target.value }))} placeholder="https://waabek.com/sitemap.xml" /></Field>
        <Field label="robots.txt"><Textarea rows={4} dir="ltr" className="font-mono text-xs" value={webForm.robots_txt} onChange={e => setWebForm(f => ({ ...f, robots_txt: e.target.value }))} /></Field>
        <div className="flex flex-wrap gap-2">
          {[
            { label: tr('إرسال الخريطة إلى Google', 'Submit sitemap to Google'), href: 'https://search.google.com/search-console/sitemaps' },
            { label: tr('إرسال الخريطة إلى Bing', 'Submit sitemap to Bing'), href: 'https://www.bing.com/webmasters/sitemaps' },
            { label: 'PageSpeed', href: 'https://pagespeed.web.dev/' },
            { label: tr('اختبار البيانات المنظمة', 'Rich results test'), href: 'https://search.google.com/test/rich-results' },
          ].map(a => <Button key={a.href} size="xs" variant="secondary" href={a.href} external iconEnd={ArrowTopRightOnSquareIcon}>{a.label}</Button>)}
        </div>
        <div className="flex justify-end"><Button variant="secondary" loading={saving === 'web'} onClick={() => put('web', { webmaster: webForm }, tr('أُرسلت الإعدادات', 'Settings sent'))}>{tr('حفظ', 'Save')}</Button></div>
      </Card>

      {/* Push */}
      <Card className="space-y-4">
        <CardHeader icon={BellAlertIcon} title={tr('إشعارات المتصفح', 'Browser push notifications')} subtitle={tr('Chrome وFirefox وEdge على الحاسوب والجوال.', 'Chrome, Firefox and Edge on desktop and mobile.')}
          action={<Badge tone={pushForm.vapid_public ? 'success' : 'warning'} dot>{pushForm.vapid_public ? tr('مضبوطة', 'Configured') : tr('غير مضبوطة', 'Not set')}</Badge>} />
        <div className="flex items-center gap-3 rounded-xl border border-line-soft bg-surface-2 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="tabular text-sm font-semibold text-ink">{pushStats?.total != null ? tr(`${pushStats.total} مشترك`, `${pushStats.total} subscribers`) : tr('جارٍ التحميل…', 'Loading…')}</p>
            <p className="text-xs text-muted">{tr('مستخدمون فعّلوا الإشعارات', 'Users with notifications enabled')}</p>
          </div>
          <Button size="icon-sm" variant="ghost" icon={ArrowPathIcon} aria-label={tr('تحديث العدد', 'Refresh count')} onClick={loadCount} />
        </div>
        <p className="text-xs text-muted">
          {tr('أنشئ المفاتيح من', 'Generate keys at')} <a className="text-link hover:text-link-hover" href="https://vapidkeys.com" target="_blank" rel="noopener noreferrer">vapidkeys.com</a> {tr('أو نفّذ', 'or run')} <code dir="ltr" className="rounded bg-surface-3 px-1 font-mono">npx web-push generate-vapid-keys</code>
        </p>
        <Field label={tr('المفتاح العام VAPID', 'VAPID public key')}><Input dir="ltr" className="font-mono text-xs" value={pushForm.vapid_public} onChange={e => setPushForm(f => ({ ...f, vapid_public: e.target.value }))} placeholder="BEl62iUYgUivxIkv69yViEuiBIa-…" /></Field>
        <Field label={tr('المفتاح الخاص VAPID', 'VAPID private key')}>
          <SecretField stored={(push?.vapid_private as string) || ''} value={pushForm.vapid_private} onChange={v => setPushForm(f => ({ ...f, vapid_private: v }))} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
          <Switch checked={!!pushForm.enabled} onChange={v => setPushForm(f => ({ ...f, enabled: v }))} label={tr('تفعيل الإشعارات للمستخدمين', 'Enable push for users')} />
          <Button loading={saving === 'push'} onClick={() => put('push', { push: pushForm }, tr('حُفظت المفاتيح', 'Keys saved'))}>{tr('حفظ المفاتيح', 'Save keys')}</Button>
        </div>

        {pushForm.vapid_public && (
          <div className="space-y-3 rounded-xl border border-line p-4">
            <p className="text-sm font-semibold text-ink">{tr('إرسال إشعار', 'Send a notification')}</p>
            {pushStats?.sent != null && <Notice tone="success" icon={CheckCircleIcon}>{tr(`أُرسل إلى ${pushStats.sent} من ${pushStats.total}`, `Sent to ${pushStats.sent} / ${pushStats.total} subscribers`)}</Notice>}
            <Field label={tr('العنوان', 'Title')} required><Input value={pushSend.title} onChange={e => setPushSend(f => ({ ...f, title: e.target.value }))} /></Field>
            <Field label={tr('النص', 'Body')} required><Textarea rows={2} value={pushSend.body} onChange={e => setPushSend(f => ({ ...f, body: e.target.value }))} /></Field>
            <Field label={tr('رابط عند النقر', 'Click URL')}><Input dir="ltr" value={pushSend.url} onChange={e => setPushSend(f => ({ ...f, url: e.target.value }))} placeholder="/dashboard" /></Field>
            <Button fullWidth icon={BellAlertIcon} loading={pushSending} disabled={!pushSend.title || !pushSend.body} onClick={sendPush}>{tr('إرسال لجميع المشتركين', 'Send to all subscribers')}</Button>
          </div>
        )}
        <Steps items={[
          tr('اضبط مفاتيح VAPID واحفظها', 'Set your VAPID keys and save'),
          tr('يظهر زر «تفعيل الإشعارات» في لوحة المستخدم', 'Users see an “Enable notifications” button in their dashboard'),
          tr('يسمح المستخدم بالإشعارات في المتصفح', 'They allow notifications in the browser'),
          tr('ترسل الإشعارات من هنا فتظهر على الحاسوب والجوال', 'You send notifications from here — they appear on desktop and mobile'),
        ]} />
      </Card>

      <Card variant="muted" className="flex flex-wrap items-center gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-bg text-violet"><SparklesIcon className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{tr('مزوّد الذكاء الاصطناعي', 'AI provider')}</p>
          <p className="text-xs text-muted">{tr('مفتاح API وحدود الاستخدام في صفحة الذكاء الاصطناعي.', 'API key and usage limits live on the AI settings page.')}</p>
        </div>
        <Button size="sm" variant="secondary" href="/admin/ai-settings">{tr('فتح', 'Open')}</Button>
      </Card>
    </div>
  )
}
