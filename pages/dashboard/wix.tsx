import React, { useMemo, useRef, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ShoppingBagIcon, BuildingStorefrontIcon, ChatBubbleLeftRightIcon, BookOpenIcon, PaperAirplaneIcon,
  ArrowTopRightOnSquareIcon, TruckIcon, ShoppingCartIcon, LightBulbIcon, LinkSlashIcon, ArrowUturnLeftIcon,
  CreditCardIcon, CalendarDaysIcon, TicketIcon, CakeIcon, SparklesIcon, BellAlertIcon,
} from '@heroicons/react/24/outline'
import {
  Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, Input, PageHeader, Select, Skeleton,
  Switch, TabPanel, Tabs, Textarea, cn,
} from '@/components/ui'
import { CardsSkeleton, ErrorState, HeroPanel, StepList, apiError, rich } from '@/components/settings/Shared'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/wix'

type MsgKey = keyof typeof messages.en
const B = ({ children }: { children: string }) => <strong className="text-ink" dir="ltr">{children}</strong>
const VarCode = () => <code dir="ltr" className="font-mono">{'{{customer_name}}'}</code>

/** One notification from GET /api/settings/wix-templates (catalogue in lib/wix-events.ts). */
interface WixEvent {
  key: string
  group: string
  audience: 'customer' | 'merchant'
  placeholders: string[]
  label: Record<string, string>
  description: Record<string, string>
  defaults: Record<string, string>
  /** Default text the webhook sends for this account. */
  default: string
  /** Saved custom text; null = default. */
  text: string | null
  enabled: boolean
}
interface TemplatesResponse {
  events: WixEvent[]
  groups: Array<{ key: string; label: Record<string, string> }>
  placeholders: Array<{ key: string; description: Record<string, string> }>
  language: 'ar' | 'en'
}

/* UI groups (finer than the catalogue's): merchant-audience events go to
   "alerts for you"; the rest by key, then by catalogue group. */
const UI_GROUPS = ['orders', 'payments', 'shipping', 'carts', 'bookings', 'events', 'restaurants', 'site_plans', 'merchant_alerts'] as const
type UiGroup = typeof UI_GROUPS[number]
const GROUP_BY_KEY: Record<string, UiGroup> = {
  order_placed: 'orders', order_cancelled: 'orders',
  order_paid: 'payments', order_refunded: 'payments',
  order_shipped: 'shipping',
  abandoned_cart: 'carts', cart_recovered: 'carts', back_in_stock: 'carts',
}
const GROUP_BY_CATALOGUE: Record<string, UiGroup> = {
  ecommerce: 'orders', bookings: 'bookings', events: 'events', restaurants: 'restaurants', pricing_plans: 'site_plans',
}
const GROUP_ICON: Record<UiGroup, React.ElementType> = {
  orders: ShoppingBagIcon, payments: CreditCardIcon, shipping: TruckIcon, carts: ShoppingCartIcon,
  bookings: CalendarDaysIcon, events: TicketIcon, restaurants: CakeIcon, site_plans: SparklesIcon, merchant_alerts: BellAlertIcon,
}
function uiGroupOf(ev: WixEvent): UiGroup {
  if (ev.audience === 'merchant') return 'merchant_alerts'
  return GROUP_BY_KEY[ev.key] || GROUP_BY_CATALOGUE[ev.group] || 'orders'
}

const WIX_APP_URL = 'https://www.wix.com/app-market/48cfce94-1e3d-4d09-a34d-e5f41e5b0469'

export default function WixPage() {
  const { t, lang, fmtDate, fmtTime } = useT(messages)
  const [tab, setTab] = useState<'stores' | 'templates' | 'guide'>('stores')
  /** Texts edited since the last save (key → textarea value). */
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [tplSaving, setTplSaving] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testEvent, setTestEvent] = useState('order_placed')
  const [sending, setSending] = useState(false)
  const [toDisconnect, setToDisconnect] = useState<string | null>(null)
  const areas = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const qc = useQueryClient()

  const has = (k: string): k is MsgKey => k in messages.en
  /** Dictionary first (keyed by event key), the API's label as fallback. */
  const pickApi = (m?: Record<string, string>) => (m ? m[lang] || m.en || m.ar || '' : '')
  const evLabel = (ev: WixEvent) => (has(`ev_${ev.key}`) ? t(`ev_${ev.key}` as MsgKey) : pickApi(ev.label) || ev.key)
  const evDesc = (ev: WixEvent) => (has(`ev_${ev.key}_desc`) ? t(`ev_${ev.key}_desc` as MsgKey) : pickApi(ev.description))
  const varDesc = (key: string, api?: Record<string, string>) => (has(`var_${key}`) ? t(`var_${key}` as MsgKey) : pickApi(api))

  const { data: connectData, isLoading, isError, error, refetch } = useQuery('wix-connections',
    () => axios.get('/api/wix/connect').then(r => r.data)
  )
  const connections = connectData?.connections || []

  const tpl = useQuery<TemplatesResponse>('wix-templates', () => axios.get('/api/settings/wix-templates').then(r => r.data), { staleTime: 60_000 })
  const events = useMemo(() => tpl.data?.events || [], [tpl.data])
  const byKey = useMemo(() => new Map(events.map(e => [e.key, e])), [events])
  const grouped = useMemo(() => UI_GROUPS
    .map(g => ({ group: g, events: events.filter(e => uiGroupOf(e) === g) }))
    .filter(g => g.events.length), [events])

  const disconnectMutation = useMutation(
    (instanceId: string) => axios.delete('/api/wix/connect', { data: { wix_instance_id: instanceId } }),
    {
      onSuccess: () => { qc.invalidateQueries('wix-connections'); setToDisconnect(null); toast.success(t('storeDisconnected')) },
      onError: (e) => void toast.error(apiError(e, t('disconnectError'))),
    }
  )

  /** What the editor shows: unsaved edit → saved custom text → default. */
  const shownText = (ev: WixEvent) => edits[ev.key] ?? ev.text ?? ev.default
  /** Edited texts that differ from what is stored ('' = back to the default). */
  const pending = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(edits)) {
      const ev = byKey.get(key)
      if (!ev) continue
      const next = !value.trim() || value === ev.default ? '' : value
      if (next !== (ev.text ?? '')) out[key] = next
    }
    return out
  }, [edits, byKey])
  const dirty = Object.keys(pending).length > 0

  const saveTemplates = async () => {
    if (!dirty) return void toast(t('noChanges'))
    setTplSaving(true)
    try {
      // POST merges: only the edited events are sent; '' resets one to its default.
      await axios.post('/api/settings/wix-templates', { templates: pending })
      await qc.invalidateQueries('wix-templates')
      setEdits({})
      toast.success(t('messagesSaved'))
    } catch (e) { toast.error(apiError(e, t('saveError'))) }
    setTplSaving(false)
  }

  const toggleMutation = useMutation(
    ({ key, on }: { key: string; on: boolean }) => axios.post('/api/settings/wix-templates', { templates: {}, enabled: { [key]: on } }),
    {
      onMutate: ({ key, on }) => {
        qc.setQueryData<TemplatesResponse | undefined>('wix-templates', d => d && ({ ...d, events: d.events.map(e => (e.key === key ? { ...e, enabled: on } : e)) }))
      },
      onSuccess: (_r, { key, on }) => {
        const ev = byKey.get(key)
        toast.success(t(on ? 'notifOn' : 'notifOff', { name: ev ? evLabel(ev) : key }))
      },
      onError: (e, { key, on }) => {
        qc.setQueryData<TemplatesResponse | undefined>('wix-templates', d => d && ({ ...d, events: d.events.map(x => (x.key === key ? { ...x, enabled: !on } : x)) }))
        toast.error(apiError(e, t('saveError')))
      },
    }
  )

  const insertVar = (ev: WixEvent, name: string) => {
    const token = `{{${name}}}`
    const cur = shownText(ev)
    const el = areas.current[ev.key]
    const start = el && document.activeElement === el ? el.selectionStart : (el?.selectionStart ?? cur.length)
    const end = el && document.activeElement === el ? el.selectionEnd : start
    const next = cur.slice(0, start) + token + cur.slice(end)
    setEdits(prev => ({ ...prev, [ev.key]: next }))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const sendTest = async () => {
    if (!testPhone) return toast.error(t('enterPhone'))
    setSending(true)
    try {
      const ev = byKey.get(testEvent)
      const instancesResp = await axios.get('/api/whatsapp/instances')
      const allInstances = instancesResp.data?.instances || []
      const inst = allInstances.find((i: any) => i.status === 'connected')
      if (!inst) return toast.error(t('noConnected'))

      const now = new Date(Date.now() + 86400000)
      const samples: Record<string, string> = {
        customer_name: t('sample_customer_name'),
        order_id: 'TEST-001',
        total: '$99.00',
        amount: '$99.00',
        tracking_number: 'https://track.example.com/123',
        checkout_url: 'https://yourstore.com/checkout',
        service_name: t('sample_service_name'),
        event_name: t('sample_event_name'),
        plan_name: t('sample_plan_name'),
        date: fmtDate(now),
        time: fmtTime(now),
      }
      const msg = (ev ? shownText(ev) : '').replace(/{{\s*([a-z_]+)\s*}}/g, (m, k) => samples[k] ?? m)

      await axios.post('/api/whatsapp/send', { instance_id: inst.id, to: testPhone, type: 'text', text: msg })
      toast.success(t('testSent'))
    } catch (e: any) {
      toast.error(apiError(e, t('sendError')))
    } finally {
      setSending(false)
    }
  }

  const enabledCount = events.filter(e => e.enabled).length
  const placeholders = tpl.data?.placeholders || []

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
          { id: 'templates', label: t('tab_templates'), icon: ChatBubbleLeftRightIcon, count: events.length ? `${enabledCount}/${events.length}` : undefined },
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
                    <Select value={testEvent} onChange={e => setTestEvent(e.target.value)} disabled={!events.length}>
                      {grouped.map(g => (
                        <optgroup key={g.group} label={t(`group_${g.group}` as MsgKey)}>
                          {g.events.map(ev => <option key={ev.key} value={ev.key}>{evLabel(ev)}</option>)}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                  <Button type="submit" icon={PaperAirplaneIcon} loading={sending} disabled={!events.length} fullWidth>{t('testSubmit')}</Button>
                </form>
              </Card>
            </div>
          </div>
        </TabPanel>

        {/* ── Templates ─────────────────────────────── */}
        <TabPanel idPrefix="wix" id="templates" active={tab}>
          <div className="space-y-6">
            <div className="rounded-card bg-chip/60 px-4 py-3 text-sm text-chip-ink">
              <p>{rich(t('templatesHint'), { var: <VarCode /> })}</p>
              {tpl.data && <p className="mt-1 opacity-90">{t('defaultsLanguage', { language: t(tpl.data.language === 'en' ? 'lang_en' : 'lang_ar') })} {t('emptyResets')}</p>}
            </div>

            {tpl.isLoading ? <CardsSkeleton count={4} className="h-56" /> : tpl.isError ? (
              <ErrorState title={t('loadTemplatesError')} message={apiError(tpl.error)} onRetry={() => tpl.refetch()} />
            ) : grouped.map(({ group, events: list }) => {
              const Icon = GROUP_ICON[group]
              const on = list.filter(e => e.enabled).length
              return (
                <section key={group} aria-labelledby={`wix-group-${group}`} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-chip text-brand-ink"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                    <h2 id={`wix-group-${group}`} className="text-[17px] font-semibold text-ink">{t(`group_${group}` as MsgKey)}</h2>
                    <Badge size="sm" tone="neutral" className="tabular">{t('groupCount', { on, total: list.length })}</Badge>
                    {group === 'merchant_alerts' && <p className="basis-full text-xs text-muted">{t('group_merchant_alerts_desc')}</p>}
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {list.map(ev => {
                      const isOn = ev.enabled
                      const isEdited = ev.key in pending
                      const value = shownText(ev)
                      const custom = isEdited ? !!pending[ev.key] : ev.text !== null
                      return (
                        <Card key={ev.key} padding="sm" className={cn('transition-colors', isOn ? 'border-brand-teal/30' : 'opacity-80')}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="font-semibold text-ink">{evLabel(ev)}</h3>
                                <Badge tone={isOn ? 'success' : 'neutral'} size="sm">{isOn ? t('on') : t('off')}</Badge>
                                {ev.audience === 'merchant' && <Badge tone="violet" size="sm" icon={BellAlertIcon}>{t('sentToYou')}</Badge>}
                                {isEdited
                                  ? <Badge tone="warning" size="sm">{t('edited')}</Badge>
                                  : custom && <Badge tone="brand" size="sm">{t('customised')}</Badge>}
                              </div>
                              <p className="mt-0.5 text-xs text-muted">{evDesc(ev)}</p>
                            </div>
                            <Switch checked={isOn} disabled={toggleMutation.isLoading && toggleMutation.variables?.key === ev.key}
                              onChange={v => toggleMutation.mutate({ key: ev.key, on: v })} aria-label={t('enableEvent', { name: evLabel(ev) })} />
                          </div>
                          {isOn && (
                            <div className="mt-3 space-y-2">
                              <Textarea
                                ref={el => { areas.current[ev.key] = el }}
                                rows={5}
                                dir="auto"
                                aria-label={t('eventText', { name: evLabel(ev) })}
                                placeholder={ev.default}
                                className="font-mono text-[13px] leading-relaxed"
                                value={value}
                                onChange={e => setEdits(prev => ({ ...prev, [ev.key]: e.target.value }))}
                              />
                              <div className="flex flex-wrap items-center gap-1.5">
                                {ev.placeholders.map(v => (
                                  <button
                                    key={v}
                                    type="button"
                                    dir="ltr"
                                    onClick={() => insertVar(ev, v)}
                                    className="rounded-md border border-brand-teal/25 bg-chip px-2 py-0.5 font-mono text-xs text-chip-ink transition hover:border-brand-teal/60"
                                    title={varDesc(v, placeholders.find(p => p.key === v)?.description) || t('insertVar', { var: v })}
                                    aria-label={t('insertVar', { var: `{{${v}}}` })}
                                  >
                                    {`{{${v}}}`}
                                  </button>
                                ))}
                                {(custom || isEdited) && value !== ev.default && (
                                  <Button size="xs" variant="ghost" icon={ArrowUturnLeftIcon} className="ms-auto"
                                    onClick={() => setEdits(prev => ({ ...prev, [ev.key]: ev.default }))}>
                                    {t('resetDefault')}
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                </section>
              )
            })}

            {!!events.length && (
              <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3">
                {dirty && (
                  <span className="rounded-full border border-warning/25 bg-warning-bg px-3 py-1.5 text-xs font-medium text-warning shadow-card">{t('unsavedChanges')}</span>
                )}
                {dirty && <Button variant="secondary" onClick={() => setEdits({})}>{t('discardChanges')}</Button>}
                <Button size="lg" loading={tplSaving} disabled={!dirty} onClick={saveTemplates} className="shadow-hero">{t('saveChanges')}</Button>
              </div>
            )}
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
                {tpl.isLoading ? <Skeleton lines={4} className="mt-2" /> : (
                  <ul className="mt-2 space-y-2">
                    {placeholders.map(p => (
                      <li key={p.key} className="flex items-center gap-3 text-sm">
                        <code dir="ltr" className="shrink-0 rounded-md bg-chip px-2 py-0.5 font-mono text-xs text-chip-ink">{`{{${p.key}}}`}</code>
                        <span className="text-muted">{varDesc(p.key, p.description)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </TabPanel>
      </div>

      <ConfirmDialog cancelLabel={t('cancel')}
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
