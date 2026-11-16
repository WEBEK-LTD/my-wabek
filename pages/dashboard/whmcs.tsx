import { useState, type ReactNode } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowDownTrayIcon, BuildingOfficeIcon, KeyIcon, PaperAirplaneIcon, BookOpenIcon, ShieldCheckIcon,
  CheckIcon, Cog6ToothIcon, BellAlertIcon, ClockIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, TabPanel, Tabs } from '@/components/ui'
import { HeroPanel, Notice, StepList, apiError, rich } from '@/components/settings/Shared'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/whmcs'

const DOWNLOAD_URL = '/downloads/wabek-whmcs-addon.zip'

// Events shipped by the WABEK WHMCS addon v4 (modules/addons/wabek/lib/Events.php).
// Titles are keys of locales/dashboard/whmcs.ts; item labels are `ev_<key>`.
const EVENT_GROUPS: { title: keyof typeof messages.en; items: { key: string; on: boolean }[] }[] = [
  { title: 'grp_billing', items: [
    { key: 'invoice_created', on: true },
    { key: 'invoice_reminder', on: false },
    { key: 'invoice_due_soon', on: true },
    { key: 'invoice_due_today', on: true },
    { key: 'invoice_overdue', on: true },
    { key: 'invoice_paid', on: true },
    { key: 'invoice_cancelled', on: false },
  ] },
  { title: 'grp_orders', items: [
    { key: 'order_accepted', on: true },
    { key: 'service_activated', on: true },
    { key: 'service_suspended', on: true },
    { key: 'service_unsuspended', on: true },
    { key: 'service_terminated', on: true },
    { key: 'domain_renewal', on: true },
  ] },
  { title: 'grp_support', items: [
    { key: 'client_welcome', on: true },
    { key: 'ticket_opened', on: true },
    { key: 'ticket_reply', on: true },
    { key: 'ticket_status', on: false },
    { key: 'password_changed', on: false },
  ] },
  { title: 'grp_admin', items: [
    { key: 'admin_new_order', on: true },
    { key: 'admin_new_ticket', on: true },
    { key: 'admin_payment', on: true },
  ] },
]
const EVENT_COUNT = EVENT_GROUPS.reduce((n, g) => n + g.items.length, 0)

const MERGE_FIELDS = ['client_name', 'first_name', 'company', 'invoice_id', 'invoice_total', 'due_date', 'invoice_url', 'service_name', 'domain', 'ticket_id', 'ticket_subject', 'ticket_url', 'order_number', 'system_name']

// Event keys accepted by /api/whmcs/test (labels are dictionary keys).
const TEST_EVENTS: { value: string; label: keyof typeof messages.en }[] = [
  { value: 'invoice_created', label: 'test_invoice_created' },
  { value: 'invoice_paid', label: 'test_invoice_paid' },
  { value: 'invoice_overdue', label: 'test_invoice_overdue' },
  { value: 'payment_reminder', label: 'test_payment_reminder' },
  { value: 'ticket_open', label: 'test_ticket_open' },
  { value: 'ticket_reply', label: 'test_ticket_reply' },
  { value: 'service_active', label: 'test_service_active' },
  { value: 'service_suspended', label: 'test_service_suspended' },
]

const B = ({ children }: { children: ReactNode }) => <strong className="text-ink" dir="ltr">{children}</strong>
const C = ({ children }: { children: ReactNode }) => <code dir="ltr" className="font-mono text-ink">{children}</code>

export default function WHMCSPage() {
  const { t } = useT(messages)
  const [tab, setTab] = useState('setup')
  const [testPhone, setTestPhone] = useState('')
  const [testEvent, setTestEvent] = useState('invoice_created')
  const [testing, setTesting] = useState(false)

  const sendTest = async () => {
    if (!testPhone) { toast.error(t('enterPhone')); return }
    setTesting(true)
    try {
      await axios.post('/api/whmcs/test', { phone: testPhone, event: testEvent })
      toast.success(t('testSent'))
    } catch (e) {
      toast.error(apiError(e, t('testError')))
    } finally { setTesting(false) }
  }

  return (
    <DashboardLayout title={t('pageTitle')}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title="WHMCS"
          description={t('description')}
          actions={<Button variant="secondary" icon={BookOpenIcon} href="/docs/integrations/whmcs">{t('guide')}</Button>}
        />

        <HeroPanel
          icon={BuildingOfficeIcon}
          eyebrow={t('heroEyebrow')}
          title={t('heroTitle')}
          description={t('heroDesc', { n: EVENT_COUNT })}
          actions={
            <>
              <Button variant="on-deep" icon={ArrowDownTrayIcon} href={DOWNLOAD_URL} external download>{t('download')}</Button>
              <Button variant="on-deep-ghost" icon={KeyIcon} href="/dashboard/api-keys">{t('apiKeys')}</Button>
            </>
          }
        >
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-deep-muted">
            <li className="flex items-center gap-1.5"><ShieldCheckIcon className="h-4 w-4 text-brand-green" aria-hidden="true" />{t('heroPoint1')}</li>
            <li className="flex items-center gap-1.5"><ClockIcon className="h-4 w-4 text-brand-green" aria-hidden="true" />{t('heroPoint2')}</li>
            <li className="flex items-center gap-1.5"><BellAlertIcon className="h-4 w-4 text-brand-green" aria-hidden="true" />{t('heroPoint3')}</li>
          </ul>
        </HeroPanel>

        <Tabs idPrefix="whmcs" aria-label={t('tabsLabel')} value={tab} onChange={setTab} tabs={[
          { id: 'setup', label: t('tab_setup'), icon: Cog6ToothIcon },
          { id: 'events', label: t('tab_events'), icon: BellAlertIcon, count: EVENT_COUNT },
          { id: 'test', label: t('tab_test'), icon: PaperAirplaneIcon },
        ]} />

        <TabPanel idPrefix="whmcs" id="setup" active={tab}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <h2 className="mb-5 text-[17px] font-semibold text-ink">{t('stepsTitle')}</h2>
              <StepList steps={[
                {
                  title: t('step1'),
                  body: rich(t('step1Body'), { zip: <C>wabek-whmcs-addon.zip</C>, modules: <C>modules</C>, path: <C>modules/addons/wabek/wabek.php</C> }),
                },
                {
                  // WHMCS admin menu names stay as WHMCS shows them (LTR).
                  title: t('step2'),
                  body: rich(t('step2Body'), { menu: <B>System Settings → Addon Modules</B>, addon: <B>WABEK WhatsApp</B>, configure: <B>Configure</B> }),
                },
                {
                  title: t('step3'),
                  body: rich(t('step3Body'), {
                    name: <C>WHMCS Production</C>,
                    link: <a className="text-link hover:text-link-hover" href="/dashboard/api-keys">{t('apiKeys')}</a>,
                    menu: <B>Addons → WABEK WhatsApp</B>,
                    settings: <strong className="text-ink">{t('step3Settings')}</strong>,
                  }),
                },
                {
                  title: t('step4'),
                  body: rich(t('step4Body'), { test: <strong className="text-ink">{t('step4Test')}</strong> }),
                },
                {
                  title: t('step5'),
                  body: t('step5Body'),
                },
              ]} />
            </Card>

            <div className="space-y-4">
              <Card variant="muted">
                <h3 className="mb-3 font-semibold text-ink">{t('requirements')}</h3>
                <ul className="space-y-2 text-sm text-body">
                  {['WHMCS 8.x', t('req2'), t('req3'), t('req4'), t('req5')].map(r => (
                    <li key={r} className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />{r}</li>
                  ))}
                </ul>
              </Card>
              <Notice tone="warning" title={t('oldTitle')}>
                {rich(t('oldBody'), { file: <code dir="ltr" className="break-all font-mono">includes/hooks/wabek_notifications.php</code> })}
              </Notice>
              <Notice tone="info" title={t('windowTitle')}>
                {t('windowBody')} <a className="font-medium underline" href="/docs/getting-started/messaging-window">{t('learnMore')}</a>
              </Notice>
            </div>
          </div>
        </TabPanel>

        <TabPanel idPrefix="whmcs" id="events" active={tab}>
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {EVENT_GROUPS.map(g => (
                <Card key={g.title} padding="none">
                  <CardHeader title={t(g.title)} subtitle={t('eventsCount', { n: g.items.length })} divider />
                  <ul className="divide-y divide-line-soft">
                    {g.items.map(e => (
                      <li key={e.key} className="flex items-center gap-3 px-5 py-3">
                        <span className={e.on ? 'h-2 w-2 shrink-0 rounded-full bg-success' : 'h-2 w-2 shrink-0 rounded-full bg-line-strong'} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink">{t(`ev_${e.key}` as keyof typeof messages.en)}</span>
                          <span className="block truncate text-xs text-muted"><code dir="ltr" className="font-mono">{e.key}</code></span>
                        </span>
                        <Badge tone={e.on ? 'success' : 'neutral'} size="sm">{e.on ? t('onByDefault') : t('optional')}</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
            <Card>
              <h3 className="font-semibold text-ink">{t('mergeFields')}</h3>
              <p className="mt-1 text-sm text-muted">{t('mergeFieldsDesc')}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {MERGE_FIELDS.map(f => <code key={f} dir="ltr" className="rounded-md bg-chip px-2 py-0.5 font-mono text-xs text-chip-ink">{`{${f}}`}</code>)}
              </div>
            </Card>
          </div>
        </TabPanel>

        <TabPanel idPrefix="whmcs" id="test" active={tab}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,480px)_1fr]">
            <Card>
              <h2 className="text-[17px] font-semibold text-ink">{t('testTitle')}</h2>
              <p className="mt-1 text-sm text-muted">{t('testDesc')}</p>
              <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); sendTest() }}>
                <Field label={t('testPhone')} required>
                  <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+201234567890" dir="ltr" inputMode="tel" />
                </Field>
                <Field label={t('testEvent')}>
                  <Select value={testEvent} onChange={e => setTestEvent(e.target.value)} options={TEST_EVENTS.map(o => ({ value: o.value, label: t(o.label) }))} />
                </Field>
                <Button type="submit" icon={PaperAirplaneIcon} loading={testing} fullWidth>{t('testSubmit')}</Button>
              </form>
            </Card>
            <Notice tone="info" title={t('insideTitle')}>
              {t('insideBody')}
            </Notice>
          </div>
        </TabPanel>
      </div>
    </DashboardLayout>
  )
}
