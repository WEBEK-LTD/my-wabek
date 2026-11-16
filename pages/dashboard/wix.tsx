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
import { ErrorState, HeroPanel, StepList, apiError } from '@/components/settings/Shared'
import { fmtDate } from '@/components/settings/format'

// Default message texts are the customer-facing messages; kept as before.
const EVENTS = [
  {
    key: 'order_placed',
    label: 'تأكيد الطلب',
    desc: 'عند إنشاء العميل طلبًا جديدًا',
    vars: ['customer_name', 'order_id', 'total'],
    default: '🛒 Order Confirmed!\n\nHi {{customer_name}}, your order #{{order_id}} has been placed.\n💰 Total: {{total}}\n\nThank you! 🙏',
  },
  {
    key: 'order_paid',
    label: 'استلام الدفعة',
    desc: 'عند تأكيد الدفع',
    vars: ['customer_name', 'order_id', 'total'],
    default: '✅ Payment Received!\n\nHi {{customer_name}}, payment for order #{{order_id}} confirmed.\n💰 {{total}}',
  },
  {
    key: 'order_shipped',
    label: 'شحن الطلب',
    desc: 'عند تنفيذ الطلب مع رقم التتبع',
    vars: ['customer_name', 'order_id', 'tracking_number'],
    default: '🚚 Order Shipped!\n\nHi {{customer_name}}, order #{{order_id}} is on its way!\n📦 Track: {{tracking_number}}',
  },
  {
    key: 'order_cancelled',
    label: 'إلغاء الطلب',
    desc: 'عند إلغاء الطلب أو استرداده',
    vars: ['customer_name', 'order_id'],
    default: '❌ Order Cancelled\n\nHi {{customer_name}}, order #{{order_id}} has been cancelled.\nContact us if you need help.',
  },
  {
    key: 'order_refunded',
    label: 'إتمام الاسترداد',
    desc: 'عند اكتمال استرداد المبلغ',
    vars: ['customer_name', 'order_id'],
    default: '💰 Refund Processed\n\nHi {{customer_name}}, your refund for order #{{order_id}} has been processed.',
  },
  {
    key: 'abandoned_cart',
    label: 'سلة متروكة',
    desc: 'عند مغادرة العميل دون إتمام الشراء',
    vars: ['customer_name', 'checkout_url'],
    default: '🛒 You left something behind!\n\nHi {{customer_name}}, you have items waiting in your cart.\n\n💡 Complete your purchase now!\n\n🔗 {{checkout_url}}',
  },
  {
    key: 'cart_recovered',
    label: 'استعادة السلة',
    desc: 'عند عودة العميل وإتمام سلة متروكة',
    vars: ['customer_name', 'order_id'],
    default: '🎉 Welcome back!\n\nHi {{customer_name}}, your order #{{order_id}} has been completed. Thank you for coming back! 🙏',
  },
  {
    key: 'back_in_stock',
    label: 'عودة المنتج إلى المخزون',
    desc: 'عند توفر منتج طلبه العميل',
    vars: ['customer_name'],
    default: '📦 Good news, {{customer_name}}!\n\nA product you were waiting for is back in stock. Order now before it sells out! 🛒',
  },
]

const VARIABLES = [
  { var: '{{customer_name}}', desc: 'الاسم الأول للعميل' },
  { var: '{{order_id}}', desc: 'رقم الطلب (مثل 1042)' },
  { var: '{{total}}', desc: 'إجمالي الطلب مع العملة' },
  { var: '{{tracking_number}}', desc: 'رابط التتبع أو رقمه' },
  { var: '{{checkout_url}}', desc: 'رابط إكمال الشراء (السلة المتروكة)' },
]

const WIX_APP_URL = 'https://www.wix.com/app-market/48cfce94-1e3d-4d09-a34d-e5f41e5b0469'

export default function WixPage() {
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
      onSuccess: () => { qc.invalidateQueries('wix-connections'); setToDisconnect(null); toast.success('تم فصل المتجر') },
      onError: (e) => void toast.error(apiError(e, 'تعذّر فصل المتجر')),
    }
  )

  const saveTemplates = async () => {
    setTplSaving(true)
    try {
      await axios.post('/api/settings/wix-templates', { templates, enabled })
      toast.success('تم حفظ الرسائل')
    } catch { toast.error('تعذّر الحفظ') }
    setTplSaving(false)
  }

  const sendTest = async () => {
    if (!testPhone) return toast.error('أدخل رقم الهاتف')
    setSending(true)
    try {
      const ev = EVENTS.find(e => e.key === testEvent)
      const instancesResp = await axios.get('/api/whatsapp/instances')
      const allInstances = instancesResp.data?.instances || []
      const inst = allInstances.find((i: any) => i.status === 'connected')
      if (!inst) return toast.error('لا يوجد رقم واتساب متصل')

      const msg = (templates[testEvent] || ev?.default || '')
        .replace(/{{customer_name}}/g, 'Ahmed Mohamed')
        .replace(/{{order_id}}/g, 'TEST-001')
        .replace(/{{total}}/g, '$99.00')
        .replace(/{{tracking_number}}/g, 'https://track.example.com/123')
        .replace(/{{checkout_url}}/g, 'https://yourstore.com/checkout')

      await axios.post('/api/whatsapp/send', { instance_id: inst.id, to: testPhone, type: 'text', text: msg })
      toast.success('أُرسلت الرسالة التجريبية')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'تعذّر الإرسال')
    } finally {
      setSending(false)
    }
  }

  const enabledCount = EVENTS.filter(e => enabled[e.key] !== false).length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="التكاملات"
          title="Wix"
          description="أرسل إشعارات واتساب تلقائية لعملاء متجرك على Wix عند كل طلب ودفع وشحن."
          actions={<Button variant="secondary" icon={BookOpenIcon} href="/docs/integrations/wix">دليل Wix</Button>}
        />

        <Tabs idPrefix="wix" aria-label="أقسام Wix" value={tab} onChange={v => setTab(v as typeof tab)} tabs={[
          { id: 'stores', label: 'متاجري', icon: BuildingStorefrontIcon, count: connections.length || undefined },
          { id: 'templates', label: 'الرسائل', icon: ChatBubbleLeftRightIcon, count: `${enabledCount}/${EVENTS.length}` },
          { id: 'guide', label: 'طريقة الاستخدام', icon: BookOpenIcon },
        ]} />

        {/* ── Stores ───────────────────────────────── */}
        <TabPanel idPrefix="wix" id="stores" active={tab}>
          <div className="space-y-5">
            <HeroPanel
              icon={ShoppingBagIcon}
              eyebrow="Wix App Market"
              title="اربط متجرًا على Wix"
              description="ثبّت تطبيق WABEK على متجرك لترسل إشعارات واتساب تلقائيًا دون أي إعداد يدوي."
              actions={<Button variant="on-deep" iconEnd={ArrowTopRightOnSquareIcon} href={WIX_APP_URL} external>التثبيت على Wix</Button>}
            />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
              <Card padding="none">
                <CardHeader icon={BuildingStorefrontIcon} title="المتاجر المرتبطة" subtitle={connections.length ? `${connections.length} متجر` : undefined} divider />
                {isLoading ? (
                  <div className="space-y-3 p-5">{[0, 1].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                ) : isError ? (
                  <ErrorState className="m-5" message={apiError(error)} onRetry={() => refetch()} />
                ) : connections.length === 0 ? (
                  <EmptyState size="sm" icon={BuildingStorefrontIcon} title="لا توجد متاجر مرتبطة بعد"
                    description="ثبّت WABEK على متجرك من Wix App Market باستخدام الزر أعلاه."
                    action={<Button size="sm" iconEnd={ArrowTopRightOnSquareIcon} href={WIX_APP_URL} external>التثبيت على Wix</Button>} />
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {connections.map((conn: any) => (
                      <li key={conn.wix_instance_id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chip text-brand-ink">
                          <ShoppingBagIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink">{conn.wix_installations?.site_name || 'متجر Wix'}</p>
                          <p className="truncate font-mono text-xs text-muted"><span dir="ltr">{conn.wix_instance_id}</span></p>
                          {conn.connected_at && <p className="mt-0.5 text-xs text-muted">مرتبط منذ {fmtDate(conn.connected_at)}</p>}
                        </div>
                        <Button size="sm" variant="danger-soft" icon={LinkSlashIcon} onClick={() => setToDisconnect(conn.wix_instance_id)}>فصل</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <h2 className="text-[17px] font-semibold text-ink">رسالة تجريبية</h2>
                <p className="mt-1 text-sm text-muted">تأكد من أن رقم واتساب يرسل رسائل المتجر بشكل صحيح.</p>
                <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); sendTest() }}>
                  <Field label="رقم الهاتف مع رمز الدولة" required>
                    <Input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+201234567890" dir="ltr" />
                  </Field>
                  <Field label="الحدث">
                    <Select value={testEvent} onChange={e => setTestEvent(e.target.value)} options={EVENTS.map(e => ({ value: e.key, label: e.label }))} />
                  </Field>
                  <Button type="submit" icon={PaperAirplaneIcon} loading={sending} fullWidth>إرسال رسالة تجريبية</Button>
                </form>
              </Card>
            </div>
          </div>
        </TabPanel>

        {/* ── Templates ─────────────────────────────── */}
        <TabPanel idPrefix="wix" id="templates" active={tab}>
          <div className="space-y-4">
            <p className="rounded-card bg-chip/60 px-4 py-3 text-sm text-chip-ink">
              فعّل كل إشعار أو أوقفه، وخصّص نصه باستخدام متغيرات مثل <code dir="ltr" className="font-mono">{'{{customer_name}}'}</code>. اضغط المتغير لإضافته إلى نهاية النص.
            </p>
            <div className="grid gap-4 xl:grid-cols-2">
              {EVENTS.map(ev => {
                const isOn = enabled[ev.key] !== false
                return (
                  <Card key={ev.key} padding="sm" className={cn('transition-colors', isOn ? 'border-brand-teal/30' : 'opacity-80')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-ink">{ev.label}</h3>
                          <Badge tone={isOn ? 'success' : 'neutral'} size="sm">{isOn ? 'مفعّل' : 'متوقف'}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">{ev.desc}</p>
                      </div>
                      <Switch checked={isOn} onChange={v => setEnabled(e => ({ ...e, [ev.key]: v }))} aria-label={`تفعيل إشعار ${ev.label}`} />
                    </div>
                    {isOn && (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          rows={5}
                          dir="auto"
                          aria-label={`نص إشعار ${ev.label}`}
                          className="font-mono text-[13px] leading-relaxed"
                          value={templates[ev.key] || ev.default}
                          onChange={e => setTemplates(t => ({ ...t, [ev.key]: e.target.value }))}
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {ev.vars.map(v => (
                            <button
                              key={v}
                              type="button"
                              dir="ltr"
                              onClick={() => {
                                const cur = templates[ev.key] || ev.default
                                setTemplates(t => ({ ...t, [ev.key]: cur + `{{${v}}}` }))
                              }}
                              className="rounded-md border border-brand-teal/25 bg-chip px-2 py-0.5 font-mono text-xs text-chip-ink transition hover:border-brand-teal/60"
                              title="اضغط للإضافة"
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
              <Button size="lg" loading={tplSaving} onClick={saveTemplates} className="shadow-hero">حفظ جميع الرسائل</Button>
            </div>
          </div>
        </TabPanel>

        {/* ── Guide ─────────────────────────────────── */}
        <TabPanel idPrefix="wix" id="guide" active={tab}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <h2 className="mb-5 text-[17px] font-semibold text-ink">إعداد WABEK لمتجرك على Wix</h2>
              <StepList steps={[
                { title: 'ثبّت التطبيق', body: 'من تبويب «متاجري» اضغط «التثبيت على Wix» لتنتقل إلى Wix App Market، ثم اضغط Add to Site.' },
                { title: 'افتح WABEK من Wix', body: 'من لوحة تحكم Wix افتح Apps ← WABEK WhatsApp. يُنشأ حسابك تلقائيًا دون تسجيل.' },
                { title: 'اربط واتساب', body: 'اضغط «Open Full Dashboard» داخل التطبيق، ثم افتح «أرقام واتساب» واربط رقمك برمز QR أو عبر Meta Cloud API.' },
                { title: 'خصّص الرسائل', body: 'من تبويب «الرسائل» هنا عدّل نص كل حدث، وفعّل الأحداث التي تريدها أو أوقفها.' },
                { title: 'اختبر', body: 'أرسل رسالة تجريبية من تبويب «متاجري» للتأكد من أن كل شيء يعمل.' },
                { title: 'أصبحت جاهزًا', body: 'ضع طلبًا تجريبيًا في متجرك، وسيصل للعميل إشعار واتساب تلقائيًا.' },
              ]} />
            </Card>
            <div className="space-y-4">
              <Card padding="sm">
                <p className="flex items-center gap-2 font-semibold text-ink"><TruckIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />تتبع الشحن</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">عند تنفيذ الطلب في Wix وإضافة رقم تتبع، يُضاف رابط التتبع تلقائيًا إلى رسالة العميل.</p>
              </Card>
              <Card padding="sm">
                <p className="flex items-center gap-2 font-semibold text-ink"><ShoppingCartIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />استعادة السلال المتروكة</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">ترسل WABEK تذكيرًا عندما يبدأ العميل الدفع ولا يكمله، مع رابط مباشر إلى سلته.</p>
              </Card>
              <Card padding="sm">
                <p className="flex items-center gap-2 font-semibold text-ink"><LightBulbIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />نصائح</p>
                <ul className="mt-1.5 list-disc space-y-1 ps-5 text-sm text-muted">
                  <li>اجعل الرسائل قصيرة وواضحة.</li>
                  <li>استخدم <code dir="ltr" className="font-mono">{'{{customer_name}}'}</code> لتخصيص كل رسالة.</li>
                  <li>اختبر كل حدث قبل التشغيل الفعلي.</li>
                  <li>تأكد من بقاء رقم واتساب متصلًا.</li>
                </ul>
              </Card>
              <Card padding="sm">
                <p className="font-semibold text-ink">المتغيرات المتاحة</p>
                <ul className="mt-2 space-y-2">
                  {VARIABLES.map(v => (
                    <li key={v.var} className="flex items-center gap-3 text-sm">
                      <code dir="ltr" className="shrink-0 rounded-md bg-chip px-2 py-0.5 font-mono text-xs text-chip-ink">{v.var}</code>
                      <span className="text-muted">{v.desc}</span>
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
        title="فصل هذا المتجر؟"
        description="ستتوقف إشعارات واتساب لطلبات هذا المتجر حتى تعيد تثبيت التطبيق."
        confirmLabel="فصل المتجر"
      />
    </DashboardLayout>
  )
}
