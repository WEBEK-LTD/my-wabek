import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  AdjustmentsHorizontalIcon, BoltIcon, BookOpenIcon, ChatBubbleLeftRightIcon, ClockIcon, CpuChipIcon,
  DevicePhoneMobileIcon, ExclamationTriangleIcon, HandRaisedIcon, InboxArrowDownIcon, SparklesIcon, PlusIcon,
  CheckCircleIcon, ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, ProgressBar, Skeleton, StatCard, Switch, Textarea, cn, formatNumber,
} from '@/components/ui'
import { ChatPreview, ChatMessage } from '@/components/automation/ChatPreview'
import { KeywordInput } from '@/components/automation/KeywordInput'
import { LoadError } from '@/components/analytics/LoadError'
import { apiError } from '@/components/analytics/format'

/** Server-side cap (lib/ai-engine AI_MAX_TOKENS_CAP): larger values are clamped. */
const MAX_TOKENS_CAP = 500
const DEFAULT_ESCALATION = 'agent,human,انسان,موظف,بشري'

interface Instance { id: string; display_name: string | null; phone_number: string | null; status: string; instance_type?: string; type?: string }
interface AISetting {
  instance_id: string; is_enabled: boolean; company_name: string | null; system_prompt: string | null; model: string | null
  max_tokens: number | null; temperature: number | null; escalation_keywords: string | null
}
interface AIStats { total_replies?: number; replies_this_month?: number; limit?: number; used?: number; allowed?: boolean }
interface FormState {
  is_enabled: boolean; company_name: string; system_prompt: string; model: string; max_tokens: number; temperature: number; escalation_keywords: string
}

const DEFAULT_FORM: FormState = {
  is_enabled: false, company_name: '', system_prompt: '', model: 'WABEK AI-v4-flash',
  max_tokens: 300, temperature: 0.7, escalation_keywords: DEFAULT_ESCALATION,
}

const SNIPPETS = [
  { label: 'المنتجات والخدمات', text: 'المنتجات والخدمات:\n- ' },
  { label: 'الأسعار', text: 'الأسعار:\n- ' },
  { label: 'الشحن والتوصيل', text: 'الشحن والتوصيل:\n- ' },
  { label: 'الاسترجاع', text: 'سياسة الاسترجاع:\n- ' },
  { label: 'أسلوب الرد', text: 'أسلوب الرد: ودود ومهني ومختصر (ثلاث جمل على الأكثر).' },
  { label: 'اللغة', text: 'اللغة: أجب دائمًا بلغة العميل نفسها.' },
]

const DAYS = [
  { id: 'sat', label: 'السبت' }, { id: 'sun', label: 'الأحد' }, { id: 'mon', label: 'الاثنين' }, { id: 'tue', label: 'الثلاثاء' },
  { id: 'wed', label: 'الأربعاء' }, { id: 'thu', label: 'الخميس' }, { id: 'fri', label: 'الجمعة' },
]

function tempLabel(t: number) {
  if (t <= 0.35) return 'دقيق ومتسق'
  if (t <= 0.8) return 'متوازن وطبيعي'
  return 'إبداعي ومتنوّع'
}

function SectionCard({ icon, title, subtitle, children }: { icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card padding="lg" as="section">
      <CardHeader icon={icon} title={title} subtitle={subtitle} />
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </Card>
  )
}

export default function AISettingsPage() {
  const qc = useQueryClient()
  const [selectedInstance, setSelectedInstance] = useState('')
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [dirty, setDirty] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [testing, setTesting] = useState(false)
  const [hours, setHours] = useState({ days: ['sun', 'mon', 'tue', 'wed', 'thu'], from: '09:00', to: '17:00' })

  const { data: instData, isLoading: instLoading, isError: instError, refetch: refetchInst } = useQuery<{ instances: Instance[] }>('instances', () => axios.get('/api/whatsapp/instances').then(r => r.data))
  const { data: aiData } = useQuery<{ settings: AISetting[] }>('ai-settings', () => axios.get('/api/ai/settings').then(r => r.data))
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery<AIStats>('ai-stats', () => axios.get('/api/ai/stats').then(r => r.data))

  const instances = instData?.instances || []
  const aiSettings = aiData?.settings || []
  const stats = statsData || {}
  const limit = stats.limit ?? 0
  const planOk = limit === -1 || (limit > 0 && !!stats.allowed)
  const usagePct = limit > 0 ? Math.round(((stats.replies_this_month || 0) / limit) * 100) : 0
  const activeCount = aiSettings.filter(s => s.is_enabled).length
  const current = instances.find(i => i.id === selectedInstance)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setForm(f => ({ ...f, [k]: v })); setDirty(true) }

  const loadInstance = (instanceId: string) => {
    setSelectedInstance(instanceId)
    setChat([]); setDirty(false)
    const existing = aiSettings.find(s => s.instance_id === instanceId)
    if (existing) {
      setForm({
        is_enabled: existing.is_enabled,
        company_name: existing.company_name || '',
        system_prompt: existing.system_prompt || '',
        model: existing.model || 'WABEK AI-v4-flash',
        max_tokens: Math.min(existing.max_tokens || 300, MAX_TOKENS_CAP),
        temperature: existing.temperature ?? 0.7,
        escalation_keywords: existing.escalation_keywords || DEFAULT_ESCALATION,
      })
    } else {
      setForm(DEFAULT_FORM)
    }
  }

  const saveMut = useMutation(
    () => axios.post('/api/ai/settings', { instance_id: selectedInstance, ...form }),
    {
      onSuccess: () => {
        qc.invalidateQueries('ai-settings')
        refetchStats()
        setDirty(false)
        toast.success('حُفظت إعدادات المساعد')
      },
      onError: (e: unknown) => { toast.error(apiError(e, 'تعذّر الحفظ')) },
    },
  )

  const escalationWords = form.escalation_keywords.split(',').map(k => k.trim()).filter(Boolean)

  const runTest = async () => {
    const msg = testMsg.trim()
    if (!msg || !selectedInstance) return
    setTestMsg('')
    setChat(c => [...c, { role: 'user', text: msg }])
    // Same check the live engine runs before calling the model.
    const hit = escalationWords.find(k => msg.toLowerCase().includes(k.toLowerCase()))
    if (hit) {
      setChat(c => [...c, { role: 'bot', text: 'يتوقف المساعد هنا ويُبلغ فريقك ليتولّى المحادثة.', meta: `كلمة تصعيد: «${hit}»` }])
      return
    }
    setTesting(true)
    try {
      const { data } = await axios.post('/api/ai/test', {
        instance_id: selectedInstance, message: msg, system_prompt: form.system_prompt, company_name: form.company_name,
        model: form.model, max_tokens: form.max_tokens, temperature: form.temperature,
      })
      setChat(c => [...c, { role: 'bot', text: data.reply || '(لا يوجد رد)' }])
    } catch (e) {
      setChat(c => [...c, { role: 'bot', text: apiError(e, 'تعذّر الحصول على رد'), error: true }])
    }
    setTesting(false)
  }

  const appendToPrompt = (text: string) => set('system_prompt', form.system_prompt.trim() ? `${form.system_prompt.trimEnd()}\n\n${text}` : text)

  const hoursText = () => {
    const days = DAYS.filter(d => hours.days.includes(d.id)).map(d => d.label).join('، ')
    return `ساعات العمل: ${days || '—'} من ${hours.from} إلى ${hours.to}. خارج هذه الساعات أخبر العميل بأن الفريق سيرد عليه في أقرب وقت خلال ساعات العمل.`
  }

  return (
    <DashboardLayout title="AI Auto-Reply">
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="الأتمتة والذكاء الاصطناعي"
          title="المساعد الذكي"
          description="يرد المساعد على رسائل عملائك تلقائيًا بناءً على معلومات نشاطك، ويحوّل المحادثة إلى فريقك عند الحاجة."
          actions={selectedInstance && (
            <Button icon={CheckCircleIcon} loading={saveMut.isLoading} onClick={() => saveMut.mutate()}>حفظ الإعدادات</Button>
          )}
        />

        {!statsLoading && !planOk && (
          <div role="alert" className="flex flex-wrap items-start gap-3 rounded-card border border-warning/30 bg-warning-bg p-4">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-warning">ردود المساعد غير متاحة حاليًا في باقتك</p>
              <p className="mt-0.5 text-sm text-body">
                {limit === 0 ? 'باقتك الحالية لا تتضمن ردودًا ذكية. يمكنك ضبط الإعدادات الآن وتفعيلها بعد الترقية.' : `استخدمت كل الردود المتاحة هذا الشهر (${formatNumber(limit)}). رقِّ باقتك للحصول على المزيد.`}
              </p>
            </div>
            <Button size="sm" variant="dark" href="/dashboard/billing">عرض الباقات</Button>
          </div>
        )}

        {/* Usage */}
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <Card padding="md" className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[13px] text-muted"><CpuChipIcon className="h-[18px] w-[18px] text-brand-ink" aria-hidden="true" />ردود هذا الشهر</div>
            {statsLoading ? <Skeleton className="h-8 w-32" /> : (
              <p className="tabular text-[28px] font-bold leading-none text-ink">
                {formatNumber(stats.replies_this_month || 0)}
                {limit > 0 && <span className="ms-1 text-sm font-normal text-muted">/ {formatNumber(limit)}</span>}
                {limit === -1 && <span className="ms-1 text-sm font-normal text-muted">/ غير محدود</span>}
              </p>
            )}
            {limit > 0 && <ProgressBar value={Math.min(usagePct, 100)} tone={usagePct > 85 ? 'danger' : usagePct > 60 ? 'warning' : 'gradient'} aria-label={`استهلاك ${usagePct}%`} />}
          </Card>
          <StatCard loading={statsLoading} label="إجمالي الردود" value={formatNumber(stats.total_replies || 0)} icon={ChatBubbleLeftRightIcon} sub="منذ البداية" />
          <StatCard label="أرقام مفعّل عليها المساعد" value={formatNumber(activeCount)} icon={BoltIcon} sub={`من ${formatNumber(instances.length)} رقم`} />
        </div>

        {/* How it works */}
        <Card variant="muted" padding="md">
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: InboxArrowDownIcon, title: 'تصل رسالة', desc: 'يرسل العميل رسالة على واتساب' },
              { icon: SparklesIcon, title: 'الروبوت أولًا', desc: 'إن طابقت الرسالة مسار روبوت محادثة، يرد هو' },
              { icon: CpuChipIcon, title: 'ثم المساعد الذكي', desc: 'إن لم يطابق أي مسار، يرد المساعد الذكي' },
            ].map((s, i) => (
              <li key={s.title} className="flex items-start gap-3">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand-ink shadow-sm">
                  <s.icon className="h-5 w-5" aria-hidden="true" />
                  <span className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-gradient text-2xs font-bold text-[#04282C]">{i + 1}</span>
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{s.title}</p>
                  <p className="text-xs text-muted">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* Instance picker */}
        <Card padding="lg">
          <CardHeader icon={DevicePhoneMobileIcon} title="اختر رقم واتساب" subtitle="لكل رقم إعدادات مساعد مستقلة." />
          <div className="mt-5">
            {instError ? <LoadError size="sm" onRetry={() => refetchInst()} /> : instLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1].map(i => <Skeleton key={i} className="h-[68px] w-full rounded-card" />)}</div>
            ) : instances.length === 0 ? (
              <EmptyState size="sm" icon={DevicePhoneMobileIcon} title="لا توجد أرقام متصلة" description="اربط رقم واتساب أولًا لتفعيل المساعد عليه."
                action={<Button size="sm" icon={PlusIcon} href="/dashboard/instances">ربط رقم</Button>} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="رقم واتساب">
                {instances.map(inst => {
                  const s = aiSettings.find(a => a.instance_id === inst.id)
                  const active = selectedInstance === inst.id
                  return (
                    <button key={inst.id} type="button" role="radio" aria-checked={active} onClick={() => loadInstance(inst.id)}
                      className={cn('flex items-center gap-3 rounded-card border p-3.5 text-start transition',
                        active ? 'border-brand-teal bg-chip/50 shadow-ring' : 'border-line bg-surface hover:border-line-strong hover:shadow-card')}>
                      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', inst.status === 'connected' ? 'bg-success' : 'bg-line-strong')} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{inst.display_name || inst.phone_number}</p>
                        <p className="truncate text-xs text-muted"><span dir="ltr">{inst.phone_number}</span> · {(inst.instance_type || inst.type) === 'wa_web' ? 'WA Web' : 'Cloud API'}</p>
                      </div>
                      {s?.is_enabled ? <Badge tone="violet" dot>مفعّل</Badge> : <Badge tone="neutral">متوقف</Badge>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        {selectedInstance && (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex flex-col gap-5">
              <SectionCard icon={SparklesIcon} title="الحالة والهوية" subtitle={current ? `إعدادات ${current.display_name || current.phone_number}` : undefined}>
                <Switch checked={form.is_enabled} onChange={v => set('is_enabled', v)}
                  label="تفعيل الرد الآلي على هذا الرقم"
                  description={form.is_enabled ? 'سيرد المساعد على الرسائل الواردة لهذا الرقم.' : 'المساعد متوقف على هذا الرقم.'} />
                <Field label="اسم الشركة أو العلامة التجارية" hint="يُستخدم في التعريف بنفسه إذا تُركت التعليمات فارغة.">
                  <Input value={form.company_name} maxLength={200} placeholder="اسم شركتك" onChange={e => set('company_name', e.target.value)} />
                </Field>
              </SectionCard>

              <SectionCard icon={BookOpenIcon} title="المعرفة والتعليمات" subtitle="كل ما يحتاج المساعد معرفته عن نشاطك. كلما زادت التفاصيل تحسّنت الردود.">
                <div className="flex flex-wrap gap-1.5" aria-label="إضافة قسم إلى التعليمات">
                  {SNIPPETS.map(s => (
                    <button key={s.label} type="button" onClick={() => appendToPrompt(s.text)}
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-xs font-medium text-muted transition hover:border-brand-teal hover:text-ink">
                      <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />{s.label}
                    </button>
                  ))}
                </div>
                <Field label="تعليمات النظام" srOnlyLabel>
                  <Textarea rows={10} maxLength={8000} showCount value={form.system_prompt} onChange={e => set('system_prompt', e.target.value)} className="font-mono text-[13px] leading-relaxed"
                    placeholder={'أنت مساعد خدمة عملاء لشركة [اسم الشركة].\n\n- المنتجات والخدمات: …\n- الأسعار: …\n- ساعات الدعم: من الأحد إلى الخميس، 9 صباحًا – 5 مساءً\n- لمشكلات الفواتير: اطلب بريد الحساب\n- اللغة: أجب دائمًا بلغة العميل\n- الأسلوب: ودود ومهني ومختصر'} />
                </Field>
              </SectionCard>

              <SectionCard icon={AdjustmentsHorizontalIcon} title="السلوك" subtitle="طول الرد ودرجة الإبداع.">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="ai-temp" className="text-sm font-medium text-ink">درجة الإبداع</label>
                      <span className="tabular text-sm font-semibold text-ink">{form.temperature.toFixed(1)}</span>
                    </div>
                    <input id="ai-temp" type="range" min={0} max={1} step={0.1} value={form.temperature}
                      onChange={e => set('temperature', parseFloat(e.target.value))} className="w-full accent-[#12B5BE]" aria-describedby="ai-temp-hint" />
                    <p id="ai-temp-hint" className="mt-1.5 text-xs text-muted">{tempLabel(form.temperature)} · 0.3 للدقة، 0.7 للأسلوب الطبيعي</p>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="ai-tokens" className="text-sm font-medium text-ink">أقصى طول للرد</label>
                      <span className="tabular text-sm font-semibold text-ink">{form.max_tokens} <span className="text-xs font-normal text-muted">رمز</span></span>
                    </div>
                    <input id="ai-tokens" type="range" min={50} max={MAX_TOKENS_CAP} step={10} value={form.max_tokens}
                      onChange={e => set('max_tokens', parseInt(e.target.value, 10) || 300)} className="w-full accent-[#12B5BE]" aria-describedby="ai-tokens-hint" />
                    <p id="ai-tokens-hint" className="mt-1.5 text-xs text-muted">
                      نحو {formatNumber(Math.round(form.max_tokens * 0.75))} كلمة · الحد الأقصى {MAX_TOKENS_CAP} رمز (يقصّ الخادم أي قيمة أكبر)
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard icon={ClockIcon} title="ساعات العمل" subtitle="أضِف ساعات عملك إلى التعليمات ليخبر المساعد العملاء بها.">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="أيام العمل">
                  {DAYS.map(d => {
                    const on = hours.days.includes(d.id)
                    return (
                      <button key={d.id} type="button" aria-pressed={on}
                        onClick={() => setHours(h => ({ ...h, days: on ? h.days.filter(x => x !== d.id) : [...h.days, d.id] }))}
                        className={cn('h-8 rounded-full border px-3 text-xs font-medium transition',
                          on ? 'border-transparent bg-brand-gradient text-[#04282C]' : 'border-line bg-surface text-muted hover:text-ink')}>
                        {d.label}
                      </button>
                    )
                  })}
                </div>
                <div className="grid max-w-sm grid-cols-2 gap-3">
                  <Field label="من"><Input type="time" dir="ltr" value={hours.from} onChange={e => setHours(h => ({ ...h, from: e.target.value }))} /></Field>
                  <Field label="إلى"><Input type="time" dir="ltr" value={hours.to} onChange={e => setHours(h => ({ ...h, to: e.target.value }))} /></Field>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" size="sm" icon={PlusIcon} onClick={() => { appendToPrompt(hoursText()); toast.success('أُضيفت ساعات العمل إلى التعليمات') }}>إضافة إلى التعليمات</Button>
                  <p className="text-xs text-muted">لا يتوقف المساعد خارج هذه الساعات؛ يُبلغ العميل بها فقط.</p>
                </div>
              </SectionCard>

              <SectionCard icon={HandRaisedIcon} title="التصعيد إلى الفريق" subtitle="إذا كتب العميل إحدى هذه الكلمات يتوقف المساعد ويصلك إشعار لتتولّى المحادثة.">
                <Field label="كلمات التصعيد" srOnlyLabel>
                  <KeywordInput value={escalationWords} onChange={v => set('escalation_keywords', v.join(','))} placeholder="موظف، human…" />
                </Field>
              </SectionCard>

              <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-dropdown backdrop-blur">
                <p className="text-sm text-muted">{dirty ? 'لديك تغييرات غير محفوظة.' : 'كل التغييرات محفوظة.'}</p>
                <Button icon={CheckCircleIcon} loading={saveMut.isLoading} onClick={() => saveMut.mutate()}>حفظ الإعدادات</Button>
              </div>
            </div>

            {/* Playground */}
            <div className="flex flex-col gap-3 lg:sticky lg:top-24">
              <ChatPreview
                title={form.company_name || 'المساعد الذكي'}
                subtitle="تجربة بالإعدادات الحالية — قبل الحفظ"
                avatar={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-[#04282C]"><SparklesIcon className="h-5 w-5" aria-hidden="true" /></span>}
                messages={chat}
                loading={testing}
                value={testMsg}
                onChange={setTestMsg}
                onSend={runTest}
                onReset={() => setChat([])}
                placeholder="مثال: ما أسعاركم؟"
                height="h-[420px]"
                emptyHint="اكتب سؤالًا كما سيكتبه عميلك لترى كيف سيرد المساعد."
              />
              <p className="flex items-start gap-1.5 text-xs text-muted">
                <ArrowLeftIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 ltr:rotate-180" aria-hidden="true" />
                تُختبر كل رسالة منفردة دون سياق الرسائل السابقة، وتُحتسب ضمن حد الاستخدام اليومي.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
