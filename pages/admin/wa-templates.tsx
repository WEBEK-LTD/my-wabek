import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowUturnLeftIcon, ClockIcon, DocumentDuplicateIcon, PaperAirplaneIcon, PhoneIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, SearchInput, Skeleton, Tooltip, cn } from '@/components/ui'
import { apiError, useAdminT, type AdminT } from '@/components/admin/i18n'
import { ErrorState, Notice } from '@/components/admin/shared'

const BUILT_IN_TEMPLATES = (tr: AdminT) => [
  { key: 'OTP', name: 'wabek_otp', params: ['otp_code'], use: tr('رموز التحقق OTP (متغير موضعي {{1}})', 'OTP / Verification codes (positional {{1}})') },
  { key: 'WELCOME', name: 'welcome_message_v2', params: [], use: tr('ترحيب بالعميل الجديد (بلا متغيرات)', 'New customer welcome (no variables)') },
  { key: 'WELCOME_V1', name: 'welcome_message', params: [], use: tr('ترحيب (قديم، بلا متغيرات)', 'Welcome (legacy, no variables)') },
  { key: 'SUPPORT_TICKET_OPEN', name: 'support_ticket_update', params: ['customer_name'], use: tr('إشعار تحديث الخدمة', 'Service update notification') },
  { key: 'SUPPORT_REPLY', name: 'support_reply', params: ['message'], use: tr('رد فريق الدعم', 'Support team reply') },
  { key: 'MARKETING', name: 'marketing_offer', params: ['customer_name', 'offer_details'], use: tr('الحملات التسويقية', 'Marketing campaigns') },
  { key: 'BROADCAST', name: 'broadcast_notification', params: ['customer_name'], use: tr('الإعلانات الجماعية', 'Bulk announcements') },
  { key: 'INVOICE_CREATED', name: 'invoice_created', params: ['customer_name'], use: tr('فاتورة جديدة', 'New invoice') },
  { key: 'INVOICE_OVERDUE', name: 'invoice_overdue', params: ['customer_name'], use: tr('فاتورة متأخرة', 'Overdue invoice') },
  { key: 'PAYMENT_REMINDER', name: 'payment_reminder', params: ['customer_name'], use: tr('تذكير بالدفع', 'Payment reminder') },
  { key: 'SERVICE_NOTIFICATION', name: 'service_notification', params: ['customer_name'], use: tr('تحديث عام للخدمة', 'General service update') },
  { key: 'AI_FOLLOWUP', name: 'ai_assistant_followup', params: ['customer_name'], use: tr('متابعة المساعد الذكي', 'AI assistant follow-up') },
  { key: 'PASSWORD_RESET', name: 'password_reset', params: ['customer_name'], use: tr('إشعار إعادة تعيين كلمة المرور', 'Password reset notification') },
]

export default function WATemplatesPage() {
  const { tr } = useAdminT()
  const templates = useMemo(() => BUILT_IN_TEMPLATES(tr), [tr])
  const [config, setConfig] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [q, setQ] = useState('')

  const load = () => {
    setLoading(true); setError(false)
    axios.get('/api/admin/wa-templates')
      .then(r => { const c = r.data.templates || r.data.defaults || {}; setConfig(c); setSaved(c) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const dirty = JSON.stringify(config) !== JSON.stringify(saved)

  const save = async () => {
    setSaving(true)
    try {
      await axios.post('/api/admin/wa-templates', { templates: config })
      setSaved(config)
      toast.success(tr('حُفظت إعدادات القوالب', 'Templates saved'))
    } catch (e) { toast.error(apiError(e, tr('تعذّر الحفظ', 'Failed to save'))) }
    setSaving(false)
  }

  const test = async (templateKey: string) => {
    if (!testPhone) { toast.error(tr('أدخل رقم الهاتف أولًا', 'Enter a phone number first')); return }
    setTesting(templateKey)
    try {
      await axios.post('/api/admin/wa-templates/test', { templateKey, phone: testPhone })
      toast.success(tr('أُرسلت رسالة الاختبار', 'Test message sent'))
    } catch (e) { toast.error(apiError(e, tr('فشل الاختبار', 'Test failed'))) }
    setTesting(null)
  }

  const shown = templates.filter(t => !q || [t.key, t.name, t.use, config[t.key]].some(v => (v || '').toLowerCase().includes(q.toLowerCase())))
  const overridden = templates.filter(t => config[t.key]).length

  return (
    <AdminLayout title={tr('قوالب واتساب', 'WhatsApp templates')}>
      <PageHeader className="mb-6"
        eyebrow={tr('المراسلة', 'Messaging')}
        title={tr('قوالب واتساب', 'WhatsApp templates')}
        description={tr('القوالب المعتمدة من Meta التي تُستخدم عند الإرسال خارج نافذة خدمة العملاء (24 ساعة).', 'Meta-approved templates used when sending outside the 24-hour customer service window.')}
        actions={<Button loading={saving} disabled={!dirty || loading} onClick={save}>{tr('حفظ الإعدادات', 'Save configuration')}</Button>}
      />

      {error ? <ErrorState onRetry={load} /> : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card padding="none">
              <div className="flex flex-col gap-3 border-b border-line-soft p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="section-title">{tr('القوالب المدمجة', 'Built-in templates')}</h2>
                  <p className="text-xs text-muted">{tr(`${templates.length} قالبًا · ${overridden} باسم مخصّص`, `${templates.length} templates · ${overridden} renamed`)}</p>
                </div>
                <SearchInput size="sm" value={q} onChange={setQ} placeholder={tr('ابحث في القوالب', 'Search templates')} wrapperClassName="sm:w-64" />
              </div>
              {loading ? (
                <div className="space-y-3 p-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {shown.map(t => {
                    const custom = config[t.key] || ''
                    return (
                      <li key={t.key} className={cn('space-y-3 px-4 py-4 transition-colors sm:px-5', custom && 'bg-chip/25')}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <code dir="ltr" className={cn('rounded-md px-2 py-0.5 font-mono text-sm', custom ? 'bg-surface-3 text-muted line-through' : 'bg-chip text-chip-ink')}>{t.name}</code>
                              {custom && <code dir="ltr" className="rounded-md bg-chip px-2 py-0.5 font-mono text-sm text-chip-ink">{custom}</code>}
                              <span className="font-mono text-2xs text-muted" dir="ltr">{t.key}</span>
                              {custom && <Badge tone="brand" size="sm">{tr('مخصّص', 'Custom')}</Badge>}
                            </div>
                            <p className="mt-1 text-sm text-body">{t.use}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {t.params.length ? t.params.map(p => (
                                <span key={p} dir="ltr" className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs text-body">{`{{${p}}}`}</span>
                              )) : <span className="text-xs italic text-muted">{tr('بلا متغيرات', 'No parameters')}</span>}
                            </div>
                          </div>
                          <Tooltip content={testPhone ? tr('إرسال اختبار', 'Send a test') : tr('أدخل رقم اختبار أولًا', 'Enter a test number first')}>
                            <Button size="sm" variant="secondary" icon={PaperAirplaneIcon} className="rtl:[&_svg]:-scale-x-100" loading={testing === t.key} disabled={!testPhone} onClick={() => test(t.key)}>
                              {tr('اختبار', 'Test')}
                            </Button>
                          </Tooltip>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input size="sm" dir="ltr" className="font-mono" wrapperClassName="flex-1 sm:max-w-sm" value={custom} placeholder={t.name}
                            aria-label={tr(`اسم قالب Meta البديل لـ ${t.key}`, `Override Meta template name for ${t.key}`)}
                            onChange={e => setConfig(c => ({ ...c, [t.key]: e.target.value }))} />
                          {custom && <Button size="icon-sm" variant="ghost" icon={ArrowUturnLeftIcon} aria-label={tr('استعادة الاسم الافتراضي', 'Reset to default')} onClick={() => setConfig(c => ({ ...c, [t.key]: '' }))} />}
                        </div>
                      </li>
                    )
                  })}
                  {!shown.length && <li className="p-6 text-center text-sm text-muted">{tr('لا قوالب مطابقة', 'No matching templates')}</li>}
                </ul>
              )}
            </Card>

            <Card className="space-y-4">
              <CardHeader icon={SparklesIcon} title={tr('سلوك النافذة', 'Window behaviour')} subtitle={tr('القوالب الافتراضية عند انتهاء نافذة 24 ساعة', 'Default templates once the 24-hour window has closed')} />
              {[
                { key: 'default_campaign_template', label: tr('قالب الحملات الافتراضي', 'Default campaign template'), placeholder: 'marketing_offer', desc: tr('يُستخدم عند عدم اختيار قالب للحملة', 'Used when no template is selected for a campaign') },
                { key: 'default_support_template', label: tr('قالب ردود الدعم الافتراضي', 'Default support reply template'), placeholder: 'support_ticket_update', desc: tr('لردود الدعم خارج النافذة', 'For support replies outside the window') },
                { key: 'default_ai_template', label: tr('قالب المساعد الذكي الافتراضي', 'Default AI assistant template'), placeholder: 'ai_assistant_followup', desc: tr('لردود المساعد خارج النافذة', 'For AI replies outside the window') },
              ].map(s => (
                <Field key={s.key} label={s.label} hint={s.desc}>
                  <Input dir="ltr" className="font-mono" value={config[s.key] || ''} placeholder={s.placeholder} disabled={loading}
                    onChange={e => setConfig(c => ({ ...c, [s.key]: e.target.value }))} />
                </Field>
              ))}
            </Card>
          </div>

          <div className="space-y-5 lg:sticky lg:top-[72px] lg:self-start">
            <Card className="space-y-3">
              <CardHeader icon={PhoneIcon} title={tr('رقم الاختبار', 'Test number')} />
              <Field label={tr('رقم الهاتف', 'Phone number')} hint={tr('بالصيغة الدولية بدون +', 'International format, no +')}>
                <Input dir="ltr" inputMode="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="201234567890" />
              </Field>
            </Card>
            <Notice tone="info" icon={ClockIcon} title={tr('كيف تعمل نافذة 24 ساعة', 'How the 24-hour window works')}>
              {tr('عندما يراسلك العميل، يمكنك الرد بحرية لمدة 24 ساعة. بعدها تشترط Meta استخدام قالب معتمد، ويتحوّل WABEK إلى القوالب تلقائيًا.',
                'When a customer messages you, you can reply freely for 24 hours. After that Meta requires an approved template, and WABEK switches to templates automatically.')}
            </Notice>
            <Notice tone="violet" icon={DocumentDuplicateIcon}>
              {tr('غيّر اسم القالب فقط إذا كان اسمه المعتمد في Meta مختلفًا. اتركه فارغًا لاستخدام الاسم الافتراضي.', 'Only rename a template if its approved name in Meta is different. Leave empty to use the default.')}
            </Notice>
            {dirty && (
              <Card variant="gradient" padding="sm" className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{tr('لديك تغييرات غير محفوظة', 'You have unsaved changes')}</span>
                <Button size="sm" variant="dark" loading={saving} onClick={save}>{tr('حفظ', 'Save')}</Button>
              </Card>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
