// @ts-nocheck
import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  SwatchIcon, GlobeAltIcon, CheckCircleIcon, XCircleIcon, ClockIcon, MagnifyingGlassIcon,
  LifebuoyIcon, AdjustmentsHorizontalIcon, EyeIcon, BookOpenIcon, ChatBubbleLeftRightIcon, HomeIcon, UsersIcon,
} from '@heroicons/react/24/outline'
import { Button, Card, Field, Input, PageHeader, Skeleton, Switch, Textarea, Table, TBody, TD, TH, THead, TR } from '@/components/ui'
import { CopyButton, Notice, PlanGate, SectionTitle } from '@/components/settings/Shared'

const DNS_TARGET = 'wabek.netlify.app'

export default function WhiteLabelPage() {
  return <PlanGate feature="allow_white_label"><WhiteLabelContent /></PlanGate>
}

function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-field border border-line-strong" style={{ backgroundColor: value }}>
          <span className="sr-only">{label}</span>
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={e => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
        <Input value={value} onChange={e => onChange(e.target.value)} dir="ltr" className="font-mono" aria-label={`${label} (HEX)`} />
      </div>
    </Field>
  )
}

function WhiteLabelContent() {
  const [dnsStatus, setDnsStatus] = useState(null) // null | 'ok' | 'pending' | 'error'
  const [dnsChecking, setDnsChecking] = useState(false)

  const checkDns = async () => {
    if (!form.custom_domain) return
    setDnsChecking(true)
    try {
      const { data } = await axios.get(`/api/white-label/check-dns?domain=${encodeURIComponent(form.custom_domain)}`)
      setDnsStatus(data.status)
    } catch { setDnsStatus('error') }
    finally { setDnsChecking(false) }
  }

  const [form, setForm] = useState({
    brand_name: '', brand_logo: '', brand_color: '#00D46A',
    brand_secondary_color: '#F8FAFC', custom_domain: '',
    favicon_url: '', support_email: '', support_whatsapp: '',
    hide_powered_by: false, custom_css: '', custom_footer: '',
  })
  const [logoError, setLogoError] = useState(false)

  const { data, isLoading } = useQuery('white-label', () => axios.get('/api/white-label').then(r => r.data))

  useEffect(() => {
    if (data?.settings && Object.keys(data.settings).length > 0) {
      setForm(prev => ({ ...prev, ...data.settings }))
    }
  }, [data])
  useEffect(() => { setLogoError(false) }, [form.brand_logo])

  const saveMut = useMutation(
    (body) => axios.put('/api/white-label', body),
    {
      onSuccess: (r) => {
        if (r.data.domain_status === 'configured') {
          toast.success('تم الحفظ وأُضيف النطاق إلى الخادم')
        } else if (r.data.domain_status === 'netlify_error') {
          toast.success('تم حفظ الإعدادات')
          // Don't expose internal infra error to user
        } else {
          toast.success('تم حفظ إعدادات العلامة البيضاء')
        }
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'تعذّر الحفظ'),
    }
  )

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const subdomain = form.custom_domain?.split('.').slice(0, -2).join('.') || 'app'

  return (
    <DashboardLayout title="White Label">
      <div className="space-y-6 pb-24">
        <PageHeader
          eyebrow="الإعدادات"
          title="العلامة البيضاء"
          description="قدّم المنصة لعملائك باسمك وألوانك وشعارك وعلى نطاقك الخاص."
          actions={<Button variant="secondary" icon={BookOpenIcon} href="/docs/guides/white-label">الدليل</Button>}
        />

        {isLoading ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-56 w-full rounded-panel" />)}</div>
            <Skeleton className="h-80 w-full rounded-panel" />
          </div>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">
              {/* Brand */}
              <Card>
                <SectionTitle icon={SwatchIcon} title="هوية العلامة" subtitle="الاسم والشعار والألوان التي يراها عملاؤك" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="اسم العلامة">
                    <Input value={form.brand_name} onChange={e => set('brand_name', e.target.value)} placeholder="شركتي" />
                  </Field>
                  <Field label="رابط الشعار" hint="رابط صورة مباشر (PNG أو SVG)">
                    <Input value={form.brand_logo} onChange={e => set('brand_logo', e.target.value)} placeholder="https://..." dir="ltr" />
                  </Field>
                  <ColorField label="اللون الأساسي" value={form.brand_color} onChange={v => set('brand_color', v)} />
                  <ColorField label="لون الخلفية" value={form.brand_secondary_color} onChange={v => set('brand_secondary_color', v)} />
                  <Field label="رابط أيقونة المتصفح (Favicon)" className="sm:col-span-2">
                    <Input value={form.favicon_url} onChange={e => set('favicon_url', e.target.value)} placeholder="https://..." dir="ltr" />
                  </Field>
                </div>
              </Card>

              {/* Domain */}
              <Card>
                <SectionTitle icon={GlobeAltIcon} title="النطاق المخصص" subtitle="اربط نطاقًا فرعيًا من نطاقك بالمنصة" />
                <Field label="النطاق">
                  <div className="flex gap-2">
                    <Input value={form.custom_domain} onChange={e => { set('custom_domain', e.target.value); setDnsStatus(null) }} placeholder="app.mycompany.com" dir="ltr" wrapperClassName="flex-1" className="flex-1" />
                    <Button variant="secondary" icon={MagnifyingGlassIcon} loading={dnsChecking} disabled={!form.custom_domain} onClick={checkDns}>فحص DNS</Button>
                  </div>
                </Field>
                <div className="mt-3" aria-live="polite">
                  {dnsStatus === 'ok' && <Notice tone="success" icon={CheckCircleIcon}>إعدادات DNS صحيحة. سيعمل نطاقك خلال 24–48 ساعة بعد اكتمال الانتشار.</Notice>}
                  {dnsStatus === 'pending' && <Notice tone="warning" icon={ClockIcon}>لم يتصل النطاق بعد. قد يستغرق الانتشار حتى 24–48 ساعة.</Notice>}
                  {dnsStatus === 'error' && <Notice tone="danger" icon={XCircleIcon}>لم يُعثر على النطاق. تحقق من كتابته أو من إعدادات DNS.</Notice>}
                </div>

                <div className="mt-4 overflow-hidden rounded-card border border-line">
                  <p className="border-b border-line-soft bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink">أضف هذا السجل لدى مزوّد النطاق (GoDaddy أو Namecheap أو Cloudflare…)</p>
                  <Table minWidth={420} dense caption="سجل DNS المطلوب" wrapperClassName="rounded-none border-0">
                    <THead><TR><TH>النوع</TH><TH>الاسم</TH><TH>القيمة</TH><TH align="end"><span className="sr-only">نسخ</span></TH></TR></THead>
                    <TBody>
                      <TR>
                        <TD><code className="font-mono text-ink">CNAME</code></TD>
                        <TD><code dir="ltr" className="font-mono text-ink">{subdomain}</code></TD>
                        <TD><code dir="ltr" className="font-mono text-ink">{DNS_TARGET}</code></TD>
                        <TD align="end"><CopyButton text={DNS_TARGET} label="نسخ القيمة" /></TD>
                      </TR>
                    </TBody>
                  </Table>
                  <p className="border-t border-line-soft px-4 py-2.5 text-xs text-muted">احفظ السجل وانتظر من 15 دقيقة إلى 48 ساعة حتى يكتمل الانتشار.</p>
                </div>
                <Notice tone="warning" className="mt-3" title="مستخدمو Cloudflare">
                  اضبط الوكيل على <strong>DNS only</strong> (السحابة الرمادية) وليس Proxied، لأن وضع الوكيل يعطّل شهادة SSL.
                </Notice>
              </Card>

              {/* Support */}
              <Card>
                <SectionTitle icon={LifebuoyIcon} title="بيانات الدعم" subtitle="تظهر لعملائك عند طلب المساعدة" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="بريد الدعم">
                    <Input type="email" value={form.support_email} onChange={e => set('support_email', e.target.value)} placeholder="support@..." dir="ltr" />
                  </Field>
                  <Field label="واتساب الدعم">
                    <Input value={form.support_whatsapp} onChange={e => set('support_whatsapp', e.target.value)} placeholder="+201234567890" dir="ltr" />
                  </Field>
                </div>
              </Card>

              {/* Advanced */}
              <Card>
                <SectionTitle icon={AdjustmentsHorizontalIcon} title="خيارات متقدمة" />
                <div className="space-y-4">
                  <Switch checked={!!form.hide_powered_by} onChange={v => set('hide_powered_by', v)}
                    label="إخفاء «Powered by WABEK»" description="إزالة علامة WABEK من التذييل" />
                  <Field label="CSS مخصص">
                    <Textarea value={form.custom_css} onChange={e => set('custom_css', e.target.value)} rows={4} dir="ltr" placeholder=":root { --brand: #ff0000; }" className="font-mono text-xs" />
                  </Field>
                  <Field label="نص التذييل">
                    <Input value={form.custom_footer} onChange={e => set('custom_footer', e.target.value)} placeholder="© شركتي" />
                  </Field>
                </div>
              </Card>
            </div>

            {/* Live preview */}
            <div className="space-y-3 lg:sticky lg:top-6">
              <p className="flex items-center gap-2 text-sm font-medium text-ink"><EyeIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />معاينة مباشرة</p>
              <div className="overflow-hidden rounded-panel border border-line shadow-hero" aria-label="معاينة العلامة" role="img">
                <div className="flex items-center gap-1.5 border-b border-black/5 bg-[#EEF3F2] px-3 py-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F28B9B]" /><span className="h-2.5 w-2.5 rounded-full bg-[#F5C26B]" /><span className="h-2.5 w-2.5 rounded-full bg-[#8BE07A]" />
                  <span className="ms-2 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-[11px] text-[#4A6668]" dir="ltr">{form.custom_domain || 'app.mycompany.com'}</span>
                </div>
                <div className="flex min-h-[15rem]" style={{ backgroundColor: form.brand_secondary_color }}>
                  <div className="flex w-32 flex-col gap-2 p-3" style={{ backgroundColor: form.brand_color }}>
                    <div className="mb-2 flex items-center gap-1.5">
                      {form.brand_logo && !logoError ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.brand_logo} alt="" onError={() => setLogoError(true)} className="h-6 w-6 rounded object-contain" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-white/25 text-[11px] font-bold text-white">{(form.brand_name || 'B')[0]}</span>
                      )}
                      <span className="truncate text-[11px] font-bold text-white">{form.brand_name || 'اسم العلامة'}</span>
                    </div>
                    {[HomeIcon, ChatBubbleLeftRightIcon, UsersIcon].map((I, i) => (
                      <span key={i} className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] text-white ${i === 0 ? 'bg-white/25' : 'opacity-80'}`}>
                        <I className="h-3 w-3" aria-hidden="true" /><span className="h-1.5 w-12 rounded-full bg-white/60" />
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <span className="h-2.5 w-20 rounded-full bg-black/15" />
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1].map(i => <div key={i} className="h-12 rounded-lg bg-white shadow-sm" />)}
                    </div>
                    <div className="h-16 rounded-lg bg-white shadow-sm" />
                    <span className="mt-auto inline-flex w-fit rounded-md px-2.5 py-1 text-[10px] font-semibold text-white" style={{ backgroundColor: form.brand_color }}>زر أساسي</span>
                  </div>
                </div>
                <div className="border-t border-black/5 bg-white px-3 py-1.5 text-center text-[10px] text-[#4A6668]">
                  {form.custom_footer || (form.hide_powered_by ? '' : 'Powered by WABEK')}
                </div>
              </div>
              {form.brand_logo && logoError && <p className="text-xs text-danger">تعذّر تحميل الشعار من الرابط المحدد.</p>}
            </div>
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      <div className="pointer-events-none sticky bottom-4 z-10 -mt-20 flex justify-end">
        <Button size="lg" className="pointer-events-auto shadow-hero" loading={saveMut.isLoading} disabled={isLoading} onClick={() => saveMut.mutate(form)}>حفظ إعدادات العلامة البيضاء</Button>
      </div>
    </DashboardLayout>
  )
}
