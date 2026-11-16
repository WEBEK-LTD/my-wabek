import React, { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, ArrowTopRightOnSquareIcon, BellAlertIcon, ChartBarIcon, CheckCircleIcon, ExclamationTriangleIcon, GlobeAltIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, Field, Input, Switch, Textarea } from '@/components/ui'
import { apiError, useAdminT } from '../i18n'
import { Notice, SecretField, Steps } from '../shared'
import messages from '@/locales/admin/settings/integrations'

type Obj = Record<string, unknown>
const SEO_DEFAULTS = { meta_title: '', meta_description: '', og_image: '', ga_id: '', fb_pixel: '', custom_head_code: '' }
const WEB_DEFAULTS = {
  google_site_verification: '', bing_site_verification: '', pinterest_verification: '', yandex_verification: '', baidu_verification: '', norton_verification: '',
  sitemap_url: '', robots_txt: 'User-agent: *\nAllow: /\nSitemap: https://waabek.com/sitemap.xml',
}
const PUSH_DEFAULTS = { vapid_public: '', vapid_private: '', enabled: false }

export function IntegrationsSection({ seo, webmaster, push, onSaved }: { seo: Obj; webmaster?: Obj; push?: Obj; onSaved: () => void }) {
  const { t, tn } = useAdminT(messages)
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
    catch (e) { toast.error(apiError(e, t('failedSave'))) }
    setSaving(null)
  }
  const sv = (k: string) => (seoForm[k] as string) || ''

  const sendPush = async () => {
    if (!pushSend.title || !pushSend.body) { toast.error(t('titleBodyRequired')); return }
    setPushSending(true)
    try {
      const r = await axios.post('/api/push/send', pushSend)
      setPushStats(r.data)
      toast.success(tn('sentToUsers', r.data.sent, { n: r.data.sent }))
      setPushSend({ title: '', body: '', url: '/dashboard' })
    } catch (e) { toast.error(apiError(e, t('failedSend'))) }
    setPushSending(false)
  }

  return (
    <div className="space-y-5">
      {/* Analytics & meta */}
      <Card className="space-y-4">
        <CardHeader icon={ChartBarIcon} title={t('trackingMetaTags')} subtitle={t('deeperToolsLiveSeo')}
          action={<Button size="sm" variant="ghost" href="/admin/seo" iconEnd={ArrowTopRightOnSquareIcon}>SEO</Button>} />
        <Field label={t('metaTitle')} hint={t('up60CharactersLeave')}>
          <Input value={sv('meta_title')} onChange={e => setSeoForm(f => ({ ...f, meta_title: e.target.value }))} maxLength={120} />
        </Field>
        <Field label={t('metaDescription')} hint={t('up160Characters')}>
          <Textarea rows={3} showCount maxLength={320} value={sv('meta_description')} onChange={e => setSeoForm(f => ({ ...f, meta_description: e.target.value }))} />
        </Field>
        <Field label={t('shareImageOg')} hint="1200×630"><Input dir="ltr" value={sv('og_image')} onChange={e => setSeoForm(f => ({ ...f, og_image: e.target.value }))} placeholder="https://cdn.example.com/og-image.png" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Google Analytics ID"><Input dir="ltr" className="font-mono" value={sv('ga_id')} onChange={e => setSeoForm(f => ({ ...f, ga_id: e.target.value }))} placeholder="G-XXXXXXXXXX" /></Field>
          <Field label="Facebook Pixel ID"><Input dir="ltr" className="font-mono" value={sv('fb_pixel')} onChange={e => setSeoForm(f => ({ ...f, fb_pixel: e.target.value }))} placeholder="123456789012345" /></Field>
        </div>
        <Field label={t('customHeadCode')} hint={t('injectedEveryPageUse')}>
          <Textarea rows={4} dir="ltr" className="font-mono text-xs" value={sv('custom_head_code')} onChange={e => setSeoForm(f => ({ ...f, custom_head_code: e.target.value }))} placeholder="<!-- tracking code -->" />
        </Field>
        <div className="flex justify-end"><Button loading={saving === 'seo'} onClick={() => put('seo', { seo: seoForm }, t('trackingSettingsSaved'))}>{t('save')}</Button></div>
      </Card>

      {/* Webmaster */}
      <Card className="space-y-4">
        <CardHeader icon={GlobeAltIcon} title={t('webmasterTools')} subtitle={t('verifySiteOwnershipSearch')} />
        {[
          { label: 'Google Search Console', key: 'google_site_verification', link: 'https://search.google.com/search-console', desc: t('searchConsoleAddProperty') },
          { label: 'Bing Webmaster Tools', key: 'bing_site_verification', link: 'https://www.bing.com/webmasters', desc: t('bingWebmasterAddSite') },
          { label: 'Pinterest', key: 'pinterest_verification', link: 'https://www.pinterest.com/settings/claim', desc: t('pasteOnlyContentValue') },
          { label: 'Yandex Webmaster', key: 'yandex_verification', link: 'https://webmaster.yandex.com', desc: t('russianSearchMarket') },
          { label: 'Baidu Webmaster', key: 'baidu_verification', link: 'https://zhanzhang.baidu.com', desc: t('chineseSearchMarket') },
        ].map(w => (
          <Field key={w.key} label={w.label} hint={w.desc}
            labelAction={<a href={w.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-link hover:text-link-hover">{t('getCode')}<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" /></a>}>
            <Input dir="ltr" className="font-mono" value={webForm[w.key] || ''} onChange={e => setWebForm(f => ({ ...f, [w.key]: e.target.value }))} />
          </Field>
        ))}
        <Field label={t('sitemapUrl')}><Input dir="ltr" value={webForm.sitemap_url} onChange={e => setWebForm(f => ({ ...f, sitemap_url: e.target.value }))} placeholder="https://waabek.com/sitemap.xml" /></Field>
        <Field label="robots.txt"><Textarea rows={4} dir="ltr" className="font-mono text-xs" value={webForm.robots_txt} onChange={e => setWebForm(f => ({ ...f, robots_txt: e.target.value }))} /></Field>
        <div className="flex flex-wrap gap-2">
          {[
            { label: t('submitSitemapGoogle'), href: 'https://search.google.com/search-console/sitemaps' },
            { label: t('submitSitemapBing'), href: 'https://www.bing.com/webmasters/sitemaps' },
            { label: 'PageSpeed', href: 'https://pagespeed.web.dev/' },
            { label: t('richResultsTest'), href: 'https://search.google.com/test/rich-results' },
          ].map(a => <Button key={a.href} size="xs" variant="secondary" href={a.href} external iconEnd={ArrowTopRightOnSquareIcon}>{a.label}</Button>)}
        </div>
        <div className="flex justify-end"><Button variant="secondary" loading={saving === 'web'} onClick={() => put('web', { webmaster: webForm }, t('webmasterSettingsSaved'))}>{t('save')}</Button></div>
      </Card>

      {/* Push */}
      <Card className="space-y-4">
        <CardHeader icon={BellAlertIcon} title={t('browserPushNotifications')} subtitle={t('chromeFirefoxEdgeDesktop')}
          action={<Badge tone={pushForm.vapid_public ? 'success' : 'warning'} dot>{pushForm.vapid_public ? t('configuredAlt') : t('notSet')}</Badge>} />
        <div className="flex items-center gap-3 rounded-xl border border-line-soft bg-surface-2 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="tabular text-sm font-semibold text-ink">{pushStats?.total != null ? tn('subscriberCount', pushStats.total, { n: pushStats.total }) : t('loading')}</p>
            <p className="text-xs text-muted">{t('usersNotificationsEnabled')}</p>
          </div>
          <Button size="icon-sm" variant="ghost" icon={ArrowPathIcon} aria-label={t('refreshCount')} onClick={loadCount} />
        </div>
        <p className="text-xs text-muted">
          {t('generateKeys')} <a className="text-link hover:text-link-hover" href="https://vapidkeys.com" target="_blank" rel="noopener noreferrer">vapidkeys.com</a> {t('run')} <code dir="ltr" className="rounded bg-surface-3 px-1 font-mono">npx web-push generate-vapid-keys</code>
        </p>
        <Field label={t('vapidPublicKey')}><Input dir="ltr" className="font-mono text-xs" value={pushForm.vapid_public} onChange={e => setPushForm(f => ({ ...f, vapid_public: e.target.value }))} placeholder="BEl62iUYgUivxIkv69yViEuiBIa-…" /></Field>
        <Field label={t('vapidPrivateKey')}>
          <SecretField stored={(push?.vapid_private as string) || ''} value={pushForm.vapid_private} onChange={v => setPushForm(f => ({ ...f, vapid_private: v }))} />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
          <Switch checked={!!pushForm.enabled} onChange={v => setPushForm(f => ({ ...f, enabled: v }))} label={t('enablePushUsers')} />
          <Button loading={saving === 'push'} onClick={() => put('push', { push: pushForm }, t('keysSaved'))}>{t('saveKeys')}</Button>
        </div>

        {pushForm.vapid_public && (
          <div className="space-y-3 rounded-xl border border-line p-4">
            <p className="text-sm font-semibold text-ink">{t('sendNotification')}</p>
            {pushStats?.sent != null && <Notice tone="success" icon={CheckCircleIcon}>{t('sentSubscribers', { sent: pushStats.sent, total: pushStats.total })}</Notice>}
            <Field label={t('title')} required><Input value={pushSend.title} onChange={e => setPushSend(f => ({ ...f, title: e.target.value }))} /></Field>
            <Field label={t('body')} required><Textarea rows={2} value={pushSend.body} onChange={e => setPushSend(f => ({ ...f, body: e.target.value }))} /></Field>
            <Field label={t('clickUrl')}><Input dir="ltr" value={pushSend.url} onChange={e => setPushSend(f => ({ ...f, url: e.target.value }))} placeholder="/dashboard" /></Field>
            <Button fullWidth icon={BellAlertIcon} loading={pushSending} disabled={!pushSend.title || !pushSend.body} onClick={sendPush}>{t('sendAllSubscribers')}</Button>
          </div>
        )}
        <Steps items={[
          t('setVapidKeysSave'),
          t('usersSeeEnableNotifications'),
          t('theyAllowNotificationsBrowser'),
          t('youSendNotificationsHere'),
        ]} />
      </Card>

      <Card variant="muted" className="flex flex-wrap items-center gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-bg text-violet"><SparklesIcon className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{t('aiProvider')}</p>
          <p className="text-xs text-muted">{t('apiKeyUsageLimits')}</p>
        </div>
        <Button size="sm" variant="secondary" href="/admin/ai-settings">{t('open')}</Button>
      </Card>
    </div>
  )
}
