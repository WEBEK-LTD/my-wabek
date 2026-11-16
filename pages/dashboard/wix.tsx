import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ShoppingBagIcon, BuildingStorefrontIcon, ChatBubbleLeftRightIcon, BookOpenIcon, PaperAirplaneIcon,
  ArrowTopRightOnSquareIcon, TruckIcon, ShoppingCartIcon, LightBulbIcon, LinkSlashIcon,
} from '@heroicons/react/24/outline'
import {
  Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, Input, PageHeader, Select, Skeleton,
  Switch, TabPanel, Tabs, Textarea, cn,
} from '@/components/ui'
import { ErrorState, HeroPanel, StepList, apiError, rich } from '@/components/settings/Shared'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/wix'

type MsgKey = keyof typeof messages.en
const evLabel = (key: string) => `ev_${key}` as MsgKey
const evDesc = (key: string) => `ev_${key}_desc` as MsgKey
const B = ({ children }: { children: string }) => <strong className="text-ink" dir="ltr">{children}</strong>
const VarCode = () => <code dir="ltr" className="font-mono">{'{{customer_name}}'}</code>

// Default message texts are the customer-facing messages; kept as before.
// Labels/descriptions: `ev_<key>` / `ev_<key>_desc` in locales/dashboard/wix.ts.
const EVENTS = [
  {
    key: 'order_placed',
    vars: ['customer_name', 'order_id', 'total'],
    default: '🛒 Order Confirmed!\n\nHi {{customer_name}}, your order #{{order_id}} has been placed.\n💰 Total: {{total}}\n\nThank you! 🙏',
  },
  {
    key: 'order_paid',
    vars: ['customer_name', 'order_id', 'total'],
    default: '✅ Payment Received!\n\nHi {{customer_name}}, payment for order #{{order_id}} confirmed.\n💰 {{total}}',
  },
  {
    key: 'order_shipped',
    vars: ['customer_name', 'order_id', 'tracking_number'],
    default: '🚚 Order Shipped!\n\nHi {{customer_name}}, order #{{order_id}} is on its way!\n📦 Track: {{tracking_number}}',
  },
  {
    key: 'order_cancelled',
    vars: ['customer_name', 'order_id'],
    default: '❌ Order Cancelled\n\nHi {{customer_name}}, order #{{order_id}} has been cancelled.\nContact us if you need help.',
  },
  {
    key: 'order_refunded',
    vars: ['customer_name', 'order_id'],
    default: '💰 Refund Processed\n\nHi {{customer_name}}, your refund for order #{{order_id}} has been processed.',
  },
  {
    key: 'abandoned_cart',
    vars: ['customer_name', 'checkout_url'],
    default: '🛒 You left something behind!\n\nHi {{customer_name}}, you have items waiting in your cart.\n\n💡 Complete your purchase now!\n\n🔗 {{checkout_url}}',
  },
  {
    key: 'cart_recovered',
    vars: ['customer_name', 'order_id'],
    default: '🎉 Welcome back!\n\nHi {{customer_name}}, your order #{{order_id}} has been completed. Thank you for coming back! 🙏',
  },
  {
    key: 'back_in_stock',
    vars: ['customer_name'],
    default: '📦 Good news, {{customer_name}}!\n\nA product you were waiting for is back in stock. Order now before it sells out! 🛒',
  },
]

const VARIABLES = [
  { var: '{{customer_name}}', desc: 'var_customer_name' as const },
  { var: '{{order_id}}', desc: 'var_order_id' as const },
  { var: '{{total}}', desc: 'var_total' as const },
  { var: '{{tracking_number}}', desc: 'var_tracking_number' as const },
  { var: '{{checkout_url}}', desc: 'var_checkout_url' as const },
]

const WIX_APP_URL = 'https://www.wix.com/app-market/48cfce94-1e3d-4d09-a34d-e5f41e5b0469'

export default function WixPage() {
  const { t, fmtDate } = useT(messages)
  const [tab, setTab] = useState<'stores' | 'templates' | 'guide'>('stores')
  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [tplSaving, setTplSaving] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testEvent, setTestEvent] = useState('order_placed')
  const [sending, setSending] = useState(false)
  const [toDisconnect, setToDisconnect] = useState<string | null>(null)
  const qc = useQueryClient()

  // Init defaults
  useEffect(() => {
    const defTpl: Record<string, string> = {}
    const defEna: Record<string, boolean> = {}
    EVENTS.forEach(e => { defTpl[e.key] = e.default; defEna[e.key] = true })
    setTemplates(defTpl)
    setEnabled(defEna)
  }, [])

  const { data: connectData, isLoading, isError, error, refetch } = useQuery('wix-connections',
    () => axios.get('/api/wix/connect').then(r => r.data)
  )
  const connections = connectData?.connections || []

  const disconnectMutation = useMutation(
    (instanceId: string) => axios.delete('/api/wix/connect', { data: { wix_instance_id: instanceId } }),
    {
      onSuccess: () => { qc.invalidateQueries('wix-connections'); setToDisconnect(null); toast.success(t('storeDisconnected')) },
      onError: (e) => void toast.error(apiError(e, t('disconnectError'))),
    }
  )

  const saveTemplates = async () => {
    setTplSaving(true)
    try {
      await axios.post('/api/settings/wix-templates', { templates, enabled })
      toast.success(t('messagesSaved'))
    } catch { toast.error(t('saveError')) }
    setTplSaving(false)
  }

  const sendTest = async () => {
    if (!testPhone) return toast.error(t('enterPhone'))
    setSending(true)
    try {
      const ev = EVENTS.find(e => e.key === testEvent)
      const instancesResp = await axios.get('/api/whatsapp/instances')
      const allInstances = instancesResp.data?.instances || []
      const inst = allInstances.find((i: any) => i.status === 'connected')
      if (!inst) return toast.error(t('noConnected'))

      const msg = (templates[testEvent] || ev?.default || '')
        .replace(/{{customer_name}}/g, 'Ahmed Mohamed')
        .replace(/{{order_id}}/g, 'TEST-001')
        .replace(/{{total}}/g, '$99.00')
        .replace(/{{tracking_number}}/g, 'https://track.example.com/123')
        .replace(/{{checkout_url}}/g, 'https://yourstore.com/checkout')

      await axios.post('/api/whatsapp/send', { instance_id: inst.id, to: testPhone, type: 'text', text: msg })
      toast.success(t('testSent'))
    } catch (e: any) {
      toast.error(apiError(e, t('sendError')))
    } finally {
      setSending(false)
    }
  }

  const enabledCount = EVENTS.filter(e => enabled[e.key] !== false).length

  return (
    <DashboardLayout title={t('pageTitle')}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title="Wix"
          description={t('description')}
          actions={<Button variant="secondary" icon={BookOpenIcon} href="/docs/integrations/wix">{t('guideBtn')}</Button>}
        />

        <Tabs idPrefix="wix" aria-label={t('tabsLabel')} value={tab} onChange={v => setTab(v as typeof tab)} tabs={[
          { id: 'stores', label: t('tab_stores'), icon: BuildingStorefrontIcon, count: connections.length || undefined },
          { id: 'templates', label: t('tab_templates'), icon: ChatBubbleLeftRightIcon, count: `${enabledCount}/${EVENTS.length}` },
          { id: 'guide', label: t('tab_guide'), icon: BookOpenIcon },
        ]} />

        {/* ── Stores ───────────────────────────────── */}
        <TabPanel idPrefix="wix" id="stores" active={tab}>
          <div className="space-y-5">
            <HeroPanel
              icon={ShoppingBagIcon}
              eyebrow="Wix App Market"
              title={t('heroTitle')}
              description={t('heroDesc')}
              actions={<Button variant="on-deep" iconEnd={ArrowTopRightOnSquareIcon} href={WIX_APP_URL} external>{t('installOnWix')}</Button>}
            />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
              <Card padding="none">
                <CardHeader icon={BuildingStorefrontIcon} title={t('connectedStores')} subtitle={connections.length ? t(connections.length === 1 ? 'storeCountOne' : 'storeCountMany', { n: connections.length }) : undefined} divider />
                {isLoading ? (
                  <div className="space-y-3 p-5">{[0, 1].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                ) : isError ? (
                  <ErrorState className="m-5" message={apiError(error)} onRetry={() => refetch()} />
                ) : connections.length === 0 ? (
                  <EmptyState size="sm" icon={BuildingStorefrontIcon} title={t('noStores')}
                    description={t('noStoresDesc')}
                    action={<Button size="sm" iconEnd={ArrowTopRightOnSquareIcon} href={WIX_APP_URL} external>{t('installOnWix')}</Button>} />
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {connections.map((conn: any) => (
                      <li key={conn.wix_instance_id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chip text-brand-ink">
                          <ShoppingBagIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink">{conn.wix_installations?.site_name || t('wixStore')}</p>
                          <p className="truncate font-mono text-xs text-muted"><span dir="ltr">{conn.wix_instance_id}</span></p>
                          {conn.connected_at && <p className="mt-0.5 text-xs text-muted">{t('connectedSince', { date: fmtDate(conn.connected_at) })}</p>}
                        </div>
                        <Button size="sm" variant="danger-soft" icon={LinkSlashIcon} onClick={() => setToDisconnect(conn.wix_instance_id)}>{t('disconnect')}</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <h2 className="text-[17px] font-semibold text-ink">{t('testTitle')}</h2>
                <p className="mt-1 text-sm text-muted">{t('testDesc')}</p>
                <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); sendTest() }}>
                  <Field label={t('testPhone')} required>
                    <Input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+201234567890" dir="ltr" />
                  </Field>
                  <Field label={t('testEvent')}>
                    <Select value={testEvent} onChange={e => setTestEvent(e.target.value)} options={EVENTS.map(e => ({ value: e.key, label: t(evLabel(e.key)) }))} />
                  </Field>
                  <Button type="submit" icon={PaperAirplaneIcon} loading={sending} fullWidth>{t('testSubmit')}</Button>
                </form>
              </Card>
            </div>
          </div>
        </TabPanel>

        {/* ── Templates ─────────────────────────────── */}
        <TabPanel idPrefix="wix" id="templates" active={tab}>
          <div className="space-y-4">
            <p className="rounded-card bg-chip/60 px-4 py-3 text-sm text-chip-ink">
              {rich(t('templatesHint'), { var: <VarCode /> })}
            </p>
            <div className="grid gap-4 xl:grid-cols-2">
              {EVENTS.map(ev => {
                const isOn = enabled[ev.key] !== false
                return (
                  <Card key={ev.key} padding="sm" className={cn('transition-colors', isOn ? 'border-brand-teal/30' : 'opacity-80')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-ink">{t(evLabel(ev.key))}</h3>
                          <Badge tone={isOn ? 'success' : 'neutral'} size="sm">{isOn ? t('on') : t('off')}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">{t(evDesc(ev.key))}</p>
                      </div>
                      <Switch checked={isOn} onChange={v => setEnabled(e => ({ ...e, [ev.key]: v }))} aria-label={t('enableEvent', { name: t(evLabel(ev.key)) })} />
                    </div>
                    {isOn && (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          rows={5}
                          dir="auto"
                          aria-label={t('eventText', { name: t(evLabel(ev.key)) })}
                          className="font-mono text-[13px] leading-relaxed"
                          value={templates[ev.key] || ev.default}
                          onChange={e => setTemplates(prev => ({ ...prev, [ev.key]: e.target.value }))}
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {ev.vars.map(v => (
                            <button
                              key={v}
                              type="button"
                              dir="ltr"
                              onClick={() => {
                                const cur = templates[ev.key] || ev.default
                                setTemplates(prev => ({ ...prev, [ev.key]: cur + `{{${v}}}` }))
                              }}
                              className="rounded-md border border-brand-teal/25 bg-chip px-2 py-0.5 font-mono text-xs text-chip-ink transition hover:border-brand-teal/60"
                              title={t('clickToAdd')}
                            >
                              {`{{${v}}}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
            <div className="sticky bottom-4 z-10 flex justify-end">
              <Button size="lg" loading={tplSaving} onClick={saveTemplates} className="shadow-hero">{t('saveAll')}</Button>
            </div>
          </div>
        </TabPanel>

        {/* ── Guide ─────────────────────────────────── */}
        <TabPanel idPrefix="wix" id="guide" active={tab}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <h2 className="mb-5 text-[17px] font-semibold text-ink">{t('guideTitle')}</h2>
              {/* Wix UI labels (Add to Site, Apps → …, Open Full Dashboard) stay as Wix shows them. */}
              <StepList steps={[
                { title: t('g1'), body: rich(t('g1Body'), { add: <B>Add to Site</B> }) },
                { title: t('g2'), body: rich(t('g2Body'), { menu: <B>Apps → WABEK WhatsApp</B> }) },
                { title: t('g3'), body: rich(t('g3Body'), { open: <B>Open Full Dashboard</B> }) },
                { title: t('g4'), body: t('g4Body') },
                { title: t('g5'), body: t('g5Body') },
                { title: t('g6'), body: t('g6Body') },
              ]} />
            </Card>
            <div className="space-y-4">
              <Card padding="sm">
                <p className="flex items-center gap-2 font-semibold text-ink"><TruckIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />{t('shipTitle')}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t('shipBody')}</p>
              </Card>
              <Card padding="sm">
                <p className="flex items-center gap-2 font-semibold text-ink"><ShoppingCartIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />{t('cartTitle')}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t('cartBody')}</p>
              </Card>
              <Card padding="sm">
                <p className="flex items-center gap-2 font-semibold text-ink"><LightBulbIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />{t('tipsTitle')}</p>
                <ul className="mt-1.5 list-disc space-y-1 ps-5 text-sm text-muted">
                  <li>{t('tip1')}</li>
                  <li>{rich(t('tip2'), { var: <VarCode /> })}</li>
                  <li>{t('tip3')}</li>
                  <li>{t('tip4')}</li>
                </ul>
              </Card>
              <Card padding="sm">
                <p className="font-semibold text-ink">{t('variables')}</p>
                <ul className="mt-2 space-y-2">
                  {VARIABLES.map(v => (
                    <li key={v.var} className="flex items-center gap-3 text-sm">
                      <code dir="ltr" className="shrink-0 rounded-md bg-chip px-2 py-0.5 font-mono text-xs text-chip-ink">{v.var}</code>
                      <span className="text-muted">{t(v.desc)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </TabPanel>
      </div>

      <ConfirmDialog
        destructive
        open={!!toDisconnect}
        onClose={() => setToDisconnect(null)}
        onConfirm={() => { if (toDisconnect) disconnectMutation.mutate(toDisconnect) }}
        loading={disconnectMutation.isLoading}
        title={t('disconnectTitle')}
        description={t('disconnectDesc')}
        confirmLabel={t('disconnectConfirm')}
      />
    </DashboardLayout>
  )
}
