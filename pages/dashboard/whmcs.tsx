import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowDownTrayIcon, BuildingOfficeIcon, KeyIcon, PaperAirplaneIcon, BookOpenIcon, ShieldCheckIcon,
  CheckIcon, Cog6ToothIcon, BellAlertIcon, ClockIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, TabPanel, Tabs } from '@/components/ui'
import { HeroPanel, Notice, StepList, apiError } from '@/components/settings/Shared'

const DOWNLOAD_URL = '/downloads/wabek-whmcs-addon.zip'

// Events shipped by the WABEK WHMCS addon v4 (modules/addons/wabek/lib/Events.php).
const EVENT_GROUPS: { title: string; items: { key: string; label: string; on: boolean }[] }[] = [
  { title: 'الفوترة', items: [
    { key: 'invoice_created', label: 'إصدار فاتورة', on: true },
    { key: 'invoice_reminder', label: 'تذكير WHMCS بالدفع', on: false },
    { key: 'invoice_due_soon', label: 'تذكير قبل الاستحقاق', on: true },
    { key: 'invoice_due_today', label: 'تذكير يوم الاستحقاق', on: true },
    { key: 'invoice_overdue', label: 'فاتورة متأخرة', on: true },
    { key: 'invoice_paid', label: 'استلام الدفعة', on: true },
    { key: 'invoice_cancelled', label: 'إلغاء الفاتورة', on: false },
  ] },
  { title: 'الطلبات والخدمات', items: [
    { key: 'order_accepted', label: 'قبول الطلب', on: true },
    { key: 'service_activated', label: 'تفعيل الخدمة', on: true },
    { key: 'service_suspended', label: 'تعليق الخدمة', on: true },
    { key: 'service_unsuspended', label: 'إلغاء تعليق الخدمة', on: true },
    { key: 'service_terminated', label: 'إنهاء الخدمة', on: true },
    { key: 'domain_renewal', label: 'تذكير تجديد النطاق', on: true },
  ] },
  { title: 'الدعم والحساب', items: [
    { key: 'client_welcome', label: 'الترحيب بعميل جديد', on: true },
    { key: 'ticket_opened', label: 'فتح تذكرة', on: true },
    { key: 'ticket_reply', label: 'رد الفريق على تذكرة', on: true },
    { key: 'ticket_status', label: 'تغيير حالة التذكرة', on: false },
    { key: 'password_changed', label: 'تغيير كلمة المرور', on: false },
  ] },
  { title: 'تنبيهات الإدارة', items: [
    { key: 'admin_new_order', label: 'طلب جديد', on: true },
    { key: 'admin_new_ticket', label: 'تذكرة جديدة', on: true },
    { key: 'admin_payment', label: 'دفعة جديدة', on: true },
  ] },
]
const EVENT_COUNT = EVENT_GROUPS.reduce((n, g) => n + g.items.length, 0)

const MERGE_FIELDS = ['client_name', 'first_name', 'company', 'invoice_id', 'invoice_total', 'due_date', 'invoice_url', 'service_name', 'domain', 'ticket_id', 'ticket_subject', 'ticket_url', 'order_number', 'system_name']

// Event keys accepted by /api/whmcs/test.
const TEST_EVENTS = [
  { value: 'invoice_created', label: 'إصدار فاتورة' },
  { value: 'invoice_paid', label: 'استلام الدفعة' },
  { value: 'invoice_overdue', label: 'فاتورة متأخرة' },
  { value: 'payment_reminder', label: 'تذكير بالدفع' },
  { value: 'ticket_open', label: 'فتح تذكرة' },
  { value: 'ticket_reply', label: 'رد على تذكرة' },
  { value: 'service_active', label: 'تفعيل الخدمة' },
  { value: 'service_suspended', label: 'تعليق الخدمة' },
]

export default function WHMCSPage() {
  const [tab, setTab] = useState('setup')
  const [testPhone, setTestPhone] = useState('')
  const [testEvent, setTestEvent] = useState('invoice_created')
  const [testing, setTesting] = useState(false)

  const sendTest = async () => {
    if (!testPhone) { toast.error('أدخل رقم الهاتف'); return }
    setTesting(true)
    try {
      await axios.post('/api/whmcs/test', { phone: testPhone, event: testEvent })
      toast.success('أُرسلت الرسالة التجريبية')
    } catch (e) {
      toast.error(apiError(e, 'تعذّر الإرسال — تحقق من اتصال رقم واتساب'))
    } finally { setTesting(false) }
  }

  return (
    <DashboardLayout title="WHMCS Integration">
      <div className="space-y-6">
        <PageHeader
          eyebrow="التكاملات"
          title="WHMCS"
          description="أرسل إشعارات الفواتير والخدمات والتذاكر لعملائك عبر واتساب مباشرة من WHMCS."
          actions={<Button variant="secondary" icon={BookOpenIcon} href="/docs/integrations/whmcs">دليل WHMCS</Button>}
        />

        <HeroPanel
          icon={BuildingOfficeIcon}
          eyebrow="الإصدار 4 · WHMCS 8.x · PHP 7.4 – 8.3"
          title="وحدة WABEK لـ WHMCS"
          description={`${EVENT_COUNT} حدثًا جاهزًا بنصوص عربية وإنجليزية قابلة للتعديل، مع قائمة انتظار وإعادة محاولة وسجل إرسال وصفحة موافقة للعملاء.`}
          actions={
            <>
              <Button variant="on-deep" icon={ArrowDownTrayIcon} href={DOWNLOAD_URL} external download>تنزيل الوحدة</Button>
              <Button variant="on-deep-ghost" icon={KeyIcon} href="/dashboard/api-keys">مفاتيح API</Button>
            </>
          }
        >
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-deep-muted">
            <li className="flex items-center gap-1.5"><ShieldCheckIcon className="h-4 w-4 text-brand-green" aria-hidden="true" />المفتاح مشفّر ويُرسل في الترويسة X-API-Key</li>
            <li className="flex items-center gap-1.5"><ClockIcon className="h-4 w-4 text-brand-green" aria-hidden="true" />تعالج مهام WHMCS المجدولة قائمة الانتظار</li>
            <li className="flex items-center gap-1.5"><BellAlertIcon className="h-4 w-4 text-brand-green" aria-hidden="true" />تنبيهات لفريق الإدارة</li>
          </ul>
        </HeroPanel>

        <Tabs idPrefix="whmcs" aria-label="أقسام WHMCS" value={tab} onChange={setTab} tabs={[
          { id: 'setup', label: 'التثبيت', icon: Cog6ToothIcon },
          { id: 'events', label: 'الأحداث', icon: BellAlertIcon, count: EVENT_COUNT },
          { id: 'test', label: 'رسالة تجريبية', icon: PaperAirplaneIcon },
        ]} />

        <TabPanel idPrefix="whmcs" id="setup" active={tab}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <h2 className="mb-5 text-[17px] font-semibold text-ink">خطوات التثبيت</h2>
              <StepList steps={[
                {
                  title: 'نزّل الوحدة وارفعها',
                  body: <>فك ضغط <code dir="ltr" className="font-mono text-ink">wabek-whmcs-addon.zip</code> وارفع مجلد <code dir="ltr" className="font-mono text-ink">modules</code> إلى المجلد الجذري لـ WHMCS، ليصبح المسار <code dir="ltr" className="font-mono text-ink">modules/addons/wabek/wabek.php</code>.</>,
                },
                {
                  title: 'فعّل الوحدة',
                  body: <>من لوحة الإدارة افتح <strong className="text-ink">System Settings ← Addon Modules</strong>، وفعّل <strong className="text-ink">WABEK WhatsApp</strong>، ثم اضغط <strong className="text-ink">Configure</strong> وحدد مجموعات المشرفين المسموح لها بالوصول.</>,
                },
                {
                  title: 'الصق مفتاح API',
                  body: <>أنشئ مفتاحًا باسم مثل <code dir="ltr" className="font-mono text-ink">WHMCS Production</code> من صفحة <a className="text-link hover:text-link-hover" href="/dashboard/api-keys">مفاتيح API</a>، ثم افتح <strong className="text-ink">Addons ← WABEK WhatsApp</strong> والصقه في تبويب <strong className="text-ink">الإعدادات</strong>. تحفظه الوحدة مشفّرًا وترسله في الترويسة فقط.</>,
                },
                {
                  title: 'اختبر الاتصال',
                  body: <>اضغط <strong className="text-ink">اختبار الاتصال</strong> في إعدادات الوحدة وتأكد من ظهور رسالة نجاح، ثم أرسل رسالة تجريبية.</>,
                },
                {
                  title: 'فعّل الأحداث وعدّل النصوص',
                  body: 'من تبويب «الإشعارات» داخل الوحدة اختر الأحداث المطلوبة وعدّل نص كل حدث، ويمكنك تحديد اسم قالب معتمد لاستخدامه خارج نافذة الـ 24 ساعة.',
                },
              ]} />
            </Card>

            <div className="space-y-4">
              <Card variant="muted">
                <h3 className="mb-3 font-semibold text-ink">المتطلبات</h3>
                <ul className="space-y-2 text-sm text-body">
                  {['WHMCS 8.x', 'PHP 7.4 – 8.3 مع curl وjson وmbstring', 'مهام WHMCS المجدولة كل 5 دقائق', 'رقم واتساب متصل في WABEK', 'مفتاح API (يتطلب باقة تتضمن الوصول إلى API)'].map(r => (
                    <li key={r} className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />{r}</li>
                  ))}
                </ul>
              </Card>
              <Notice tone="warning" title="تستخدم إصدارًا قديمًا؟">
                الروابط القديمة التي تضع المفتاح داخل الرابط لم تعد مدعومة. احذف الملف <code dir="ltr" className="break-all font-mono">includes/hooks/wabek_notifications.php</code> إن وُجد، ثم ثبّت الوحدة الجديدة؛ تُنقل إعداداتك تلقائيًا.
              </Notice>
              <Notice tone="info" title="نافذة الـ 24 ساعة">
                على أرقام Cloud API لا يُسلَّم النص الحر لعميل لم يراسلك خلال 24 ساعة؛ حدّد قالبًا معتمدًا لكل حدث. <a className="font-medium underline" href="/docs/getting-started/messaging-window">اعرف المزيد</a>
              </Notice>
            </div>
          </div>
        </TabPanel>

        <TabPanel idPrefix="whmcs" id="events" active={tab}>
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {EVENT_GROUPS.map(g => (
                <Card key={g.title} padding="none">
                  <CardHeader title={g.title} subtitle={`${g.items.length} أحداث`} divider />
                  <ul className="divide-y divide-line-soft">
                    {g.items.map(e => (
                      <li key={e.key} className="flex items-center gap-3 px-5 py-3">
                        <span className={e.on ? 'h-2 w-2 shrink-0 rounded-full bg-success' : 'h-2 w-2 shrink-0 rounded-full bg-line-strong'} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink">{e.label}</span>
                          <span className="block truncate text-xs text-muted"><code dir="ltr" className="font-mono">{e.key}</code></span>
                        </span>
                        <Badge tone={e.on ? 'success' : 'neutral'} size="sm">{e.on ? 'مفعّل افتراضيًا' : 'اختياري'}</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
            <Card>
              <h3 className="font-semibold text-ink">حقول الدمج</h3>
              <p className="mt-1 text-sm text-muted">تُستبدل تلقائيًا في نص كل إشعار داخل الوحدة، مثل: «مرحبًا {'{client_name}'}، صدرت الفاتورة {'{invoice_id}'}».</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {MERGE_FIELDS.map(f => <code key={f} dir="ltr" className="rounded-md bg-chip px-2 py-0.5 font-mono text-xs text-chip-ink">{`{${f}}`}</code>)}
              </div>
            </Card>
          </div>
        </TabPanel>

        <TabPanel idPrefix="whmcs" id="test" active={tab}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,480px)_1fr]">
            <Card>
              <h2 className="text-[17px] font-semibold text-ink">إرسال رسالة تجريبية</h2>
              <p className="mt-1 text-sm text-muted">تُرسل من أول رقم متصل في حسابك لتتأكد من أن الإرسال يعمل.</p>
              <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); sendTest() }}>
                <Field label="رقم الهاتف مع رمز الدولة" required>
                  <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+201234567890" dir="ltr" inputMode="tel" />
                </Field>
                <Field label="الحدث">
                  <Select value={testEvent} onChange={e => setTestEvent(e.target.value)} options={TEST_EVENTS} />
                </Field>
                <Button type="submit" icon={PaperAirplaneIcon} loading={testing} fullWidth>إرسال الرسالة التجريبية</Button>
              </form>
            </Card>
            <Notice tone="info" title="اختبار الاتصال من داخل WHMCS">
              هذا الاختبار يتحقق من رقمك في WABEK فقط. للتحقق من الوحدة نفسها استخدم زر «اختبار الاتصال» في إعداداتها داخل WHMCS.
            </Notice>
          </div>
        </TabPanel>
      </div>
    </DashboardLayout>
  )
}
