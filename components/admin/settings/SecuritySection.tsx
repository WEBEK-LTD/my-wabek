import React, { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  BeakerIcon, CheckCircleIcon, ExclamationTriangleIcon, FingerPrintIcon, KeyIcon, LockClosedIcon, PaperAirplaneIcon, ShieldCheckIcon, XCircleIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, Input, Select, cn } from '@/components/ui'
import { useAdminT } from '../i18n'
import { Notice, SettingRow } from '../shared'
import { Bound, NumberRow, SelectRow, ToggleRow } from './controls'

interface Instance { id: string; display_name?: string | null; phone_number?: string | null; instance_type?: string | null }
interface OtpAttempt { templateName?: string; language?: string; components?: string; ok?: boolean; status?: number | string; error?: string }
interface OtpResult {
  success: boolean; error?: string; provider?: string; note?: string; templateName?: string; usedTemplateName?: string
  usedLanguage?: string; usedComponents?: string; messageId?: string; attempts?: OtpAttempt[]
}

export function SecuritySection({ settings, set, instances, dirty }: Bound & { instances: Instance[]; dirty: boolean }) {
  const { tr } = useAdminT()
  const b = { settings, set }
  const [otpTestPhone, setOtpTestPhone] = useState('')
  const [otpTesting, setOtpTesting] = useState(false)
  const [res, setRes] = useState<OtpResult | null>(null)
  const tmpl = (settings.otp_template_name as string) || ''

  const sendTest = async () => {
    setOtpTesting(true); setRes(null)
    try {
      const r = await axios.post('/api/admin/otp-test', { phone: otpTestPhone })
      setRes(r.data)
      if (r.data.success) toast.success(tr('أُرسل رمز الاختبار', 'Test OTP sent'))
      else toast.error(tr('فشل رمز الاختبار — راجع التفاصيل', 'Test OTP failed — see details'))
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string }
      setRes({ success: false, error: err?.response?.data?.error || err?.message })
      toast.error(tr('فشل الطلب', 'Request failed'))
    } finally { setOtpTesting(false) }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={ShieldCheckIcon} title={tr('التحقق عبر واتساب (OTP)', 'WhatsApp OTP verification')} subtitle={tr('تحكّم في رموز التحقق لجميع المستخدمين', 'Control verification codes for all users')} />
        <div className="mt-2">
          <ToggleRow {...b} k="otp_required_on_register" label={tr('اشتراط OTP عند التسجيل', 'Require OTP on registration')}
            desc={tr('يجب على المستخدم الجديد تأكيد رقم واتساب قبل الدخول إلى المنصة', 'New users must verify their WhatsApp number before using the platform')} />
          <SelectRow {...b} k="otp_provider" label={tr('مزوّد OTP', 'OTP provider')} desc={tr('اتصال واتساب المستخدم لإرسال الرموز', 'WhatsApp connection used to send codes')}
            options={[{ value: 'wa_web', label: tr('واتساب ويب (QR)', 'WhatsApp Web (QR)') }, { value: 'cloud_api', label: 'Cloud API (Meta)' }]} />
          <SettingRow label={tr('رقم واتساب لإرسال OTP', 'OTP WhatsApp number')} description={tr('الرقم المتصل الذي يرسل رموز التحقق', 'The connected number that sends verification codes')} htmlFor="set-otp_instance_id">
            <div className="space-y-1.5">
              <Select id="set-otp_instance_id" size="sm" className="min-w-[240px]" value={(settings.otp_instance_id as string) || ''} onChange={e => set('otp_instance_id', e.target.value)}
                options={[{ value: '', label: tr('تلقائي (أول رقم متصل)', 'Auto (first connected number)') },
                  ...instances.map(i => ({ value: i.id, label: `${i.display_name || i.phone_number} (${i.instance_type === 'wa_web' ? 'WA Web' : 'Cloud API'})` }))]} />
              {instances.length === 0 && <p className="flex items-center gap-1 text-xs text-warning"><ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />{tr('لا توجد أرقام متصلة', 'No connected numbers')}</p>}
            </div>
          </SettingRow>
          <NumberRow {...b} k="otp_expiry_minutes" label={tr('مدة صلاحية الرمز', 'Code lifetime')} desc={tr('بالدقائق', 'In minutes')} min={1} max={60} suffix={tr('دقيقة', 'min')} />
          <NumberRow {...b} k="otp_max_attempts" label={tr('أقصى محاولات', 'Max attempts')} desc={tr('المحاولات الخاطئة قبل إبطال الرمز', 'Wrong attempts before the code is invalidated')} min={1} max={10} />
          <SettingRow stacked htmlFor="set-otp_template_name" label={tr('اسم قالب OTP', 'OTP template name')}
            description={<>{tr('اسم قالب «المصادقة» المعتمد من Meta. الافتراضي', 'The Meta-approved Authentication template. Defaults to')} <code dir="ltr" className="rounded bg-surface-3 px-1 font-mono">wabek_otp</code> {tr('(المتغير', '(parameter')} <code dir="ltr" className="rounded bg-surface-3 px-1 font-mono">otp_code</code>).</>}>
            <div className="flex flex-wrap items-center gap-2">
              <Input id="set-otp_template_name" dir="ltr" size="sm" className="font-mono" wrapperClassName="w-56" value={tmpl} onChange={e => set('otp_template_name', e.target.value)} placeholder="wabek_otp" />
              <span className="text-xs text-muted">{tr('قوالب جاهزة:', 'Presets:')}</span>
              {['wabek_otp', 'digits'].map(p => {
                const on = (tmpl || 'wabek_otp') === p
                return (
                  <button key={p} type="button" onClick={() => set('otp_template_name', p)} aria-pressed={on}
                    className={cn('rounded-lg border px-2.5 py-1 font-mono text-xs transition-colors', on ? 'border-brand-teal bg-chip text-chip-ink' : 'border-line text-muted hover:border-line-strong hover:text-ink')}>{p}</button>
                )
              })}
            </div>
          </SettingRow>
        </div>
      </Card>

      <Card>
        <CardHeader icon={BeakerIcon} title={tr('إرسال رمز اختبار', 'Send a test OTP')}
          subtitle={tr('يرسل رمزًا حقيقيًا (123456) بالقالب أعلاه، ويعرض اللغة والصيغة التي قبلتها Meta أو الخطأ بالتفصيل.', 'Sends a real code (123456) with the template above and shows which language/format Meta accepted — or the exact error.')} />
        {dirty && <Notice className="mt-3" tone="warning" icon={ExclamationTriangleIcon}>{tr('احفظ الإعدادات أولًا إن غيّرت اسم القالب أو الرقم.', 'Save the settings first if you changed the template name or number.')}</Notice>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Input dir="ltr" inputMode="tel" className="font-mono" wrapperClassName="w-64" value={otpTestPhone} onChange={e => setOtpTestPhone(e.target.value)} placeholder="201234567890" aria-label={tr('رقم الاختبار مع رمز الدولة', 'Test number with country code')} />
          <Button variant="secondary" icon={PaperAirplaneIcon} className="rtl:[&_svg]:-scale-x-100" loading={otpTesting} disabled={!otpTestPhone} onClick={sendTest}>{tr('إرسال اختبار', 'Send test')}</Button>
        </div>
        {res && (
          <div className={cn('mt-4 space-y-1.5 rounded-xl border p-4 text-sm', res.success ? 'border-success/25 bg-success-bg' : 'border-danger/25 bg-danger-bg')} role="status">
            {res.success ? (
              <>
                <p className="flex items-center gap-2 font-semibold text-success"><CheckCircleIcon className="h-5 w-5" aria-hidden="true" />{tr('أُرسل بنجاح', 'Sent successfully')}</p>
                {res.provider === 'wa_web' ? <p className="text-body">{res.note}</p> : (
                  <dl className="grid gap-1 font-mono text-xs text-body sm:grid-cols-2" dir="ltr">
                    <div><dt className="inline text-muted">Configured: </dt><dd className="inline font-semibold">{res.templateName}</dd></div>
                    <div><dt className="inline text-muted">Used: </dt><dd className="inline font-semibold">{res.usedTemplateName}</dd></div>
                    <div><dt className="inline text-muted">Language: </dt><dd className="inline font-semibold">{res.usedLanguage}</dd></div>
                    <div><dt className="inline text-muted">Components: </dt><dd className="inline font-semibold">{res.usedComponents}</dd></div>
                    <div className="sm:col-span-2"><dt className="inline text-muted">Message ID: </dt><dd className="inline break-all">{res.messageId}</dd></div>
                  </dl>
                )}
                {res.provider !== 'wa_web' && res.usedTemplateName && res.usedTemplateName !== res.templateName && (
                  <Notice tone="warning" icon={ExclamationTriangleIcon} className="mt-2">
                    {tr(`لم يُعثر على القالب المضبوط — أُرسل بالقالب البديل ${res.usedTemplateName}. حدّث اسم القالب ليطابقه.`, `The configured template wasn’t found — sent with fallback ${res.usedTemplateName}. Consider updating the template name.`)}
                  </Notice>
                )}
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 font-semibold text-danger"><XCircleIcon className="h-5 w-5" aria-hidden="true" />{tr('فشل الإرسال', 'Failed')}</p>
                {res.error && <p className="text-body">{res.error}</p>}
                {Array.isArray(res.attempts) && (
                  <div className="mt-2 max-h-64 space-y-1 overflow-y-auto font-mono text-xs text-body" dir="ltr">
                    <p className="text-muted">Attempts ({res.attempts.length}):</p>
                    {res.attempts.map((a, i) => (
                      <p key={i}>• template=<b>{a.templateName}</b> lang=<b>{a.language}</b> components=<b>{a.components}</b> → {a.ok ? 'OK' : `failed (${a.status || ''} ${a.error || ''})`}</p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader icon={LockClosedIcon} title={tr('أمان تسجيل الدخول', 'Login security')} />
        <div className="mt-2">
          <NumberRow {...b} k="max_login_attempts" label={tr('أقصى محاولات دخول فاشلة', 'Max failed login attempts')} desc={tr('يُقفل الحساب بعد هذا العدد', 'The account locks after this many')} min={3} max={20} />
          <NumberRow {...b} k="lockout_minutes" label={tr('مدة القفل', 'Lockout duration')} desc={tr('بالدقائق', 'In minutes')} min={5} max={1440} suffix={tr('دقيقة', 'min')} />
          <ToggleRow {...b} k="require_strong_password" label={tr('اشتراط كلمات مرور قوية', 'Require strong passwords')} desc={tr('8 أحرف على الأقل', 'At least 8 characters')} />
        </div>
      </Card>

      <Card variant="muted">
        <CardHeader icon={FingerPrintIcon} title={tr('مواصفات الأمان', 'Security specs')} action={<Badge tone="success" size="sm" icon={KeyIcon}>{tr('مفعّلة', 'Enforced')}</Badge>} />
        <dl className="mt-3 divide-y divide-line-soft">
          {[
            { l: tr('تجزئة كلمات المرور', 'Password hashing'), v: 'bcrypt (12 rounds)' },
            { l: tr('خوارزمية JWT', 'JWT algorithm'), v: 'HS256 — 7 day expiry' },
            { l: tr('مفاتيح API', 'API keys'), v: 'SHA-256 hashed in DB' },
            { l: tr('رموز OTP', 'OTP codes'), v: 'SHA-256 hashed, single-use' },
            { l: tr('تتبّع الأجهزة', 'Device tracking'), v: 'Browser fingerprint + IP' },
            { l: tr('الأجهزة الموثوقة', 'Trusted devices'), v: '30-day expiry' },
          ].map(r => (
            <div key={r.l} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-sm text-muted">{r.l}</dt>
              <dd dir="ltr" className="font-mono text-xs text-brand-ink">{r.v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}
