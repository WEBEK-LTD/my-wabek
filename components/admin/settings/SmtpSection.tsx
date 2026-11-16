import React, { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { EnvelopeIcon, InformationCircleIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, Field, Input, Select } from '@/components/ui'
import { apiError, useAdminT } from '../i18n'
import { Notice, SecretField } from '../shared'

const DEFAULTS = { host: 'my.mailbux.com', port: '587', secure: 'tls', username: '', password: '', from_name: '', from_email: '' }
type Smtp = typeof DEFAULTS

export function SmtpSection({ smtp, onSaved }: { smtp: Partial<Smtp> | undefined; onSaved: (next: Smtp) => void }) {
  const { tr } = useAdminT()
  const [f, setF] = useState<Smtp>(DEFAULTS)
  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (smtp) setF({ ...DEFAULTS, ...smtp, port: String(smtp.port ?? DEFAULTS.port) }) }, [smtp])
  const set = (k: keyof Smtp, v: string) => setF(p => ({ ...p, [k]: v }))
  const configured = !!(smtp?.host && smtp?.username && smtp?.password)

  const test = async () => {
    setTesting(true)
    try {
      // A masked password is resolved server-side, only against the stored host/user.
      await axios.post('/api/admin/test-smtp', { ...f, to: testTo })
      toast.success(tr('أُرسل البريد التجريبي', 'Test email sent'))
    } catch (e) { toast.error(apiError(e, tr('فشل اختبار SMTP', 'SMTP test failed'))) }
    setTesting(false)
  }
  const save = async () => {
    setSaving(true)
    try {
      await axios.put('/api/admin/seo', { smtp: f })
      onSaved(f)
      toast.success(tr('حُفظت إعدادات البريد', 'SMTP settings saved'))
    } catch (e) { toast.error(apiError(e, tr('تعذّر الحفظ', 'Failed to save'))) }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-5">
        <CardHeader icon={EnvelopeIcon} title={tr('خادم البريد (SMTP)', 'Mail server (SMTP)')} subtitle={tr('يُستخدم لإشعارات البريد وإعادة تعيين كلمات المرور وردود الدعم.', 'Used for email notifications, password resets and support replies.')}
          action={<Badge tone={configured ? 'success' : 'warning'} dot>{configured ? tr('مضبوط', 'Configured') : tr('غير مكتمل', 'Incomplete')}</Badge>} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr('المضيف', 'Host')} className="sm:col-span-2"><Input dir="ltr" value={f.host} onChange={e => set('host', e.target.value)} placeholder="my.mailbux.com" /></Field>
          <Field label={tr('المنفذ', 'Port')} hint="25 · 465 · 587 · 2525"><Input dir="ltr" inputMode="numeric" value={f.port} onChange={e => set('port', e.target.value)} placeholder="587" /></Field>
          <Field label={tr('التشفير', 'Security')}>
            <Select value={f.secure} onChange={e => set('secure', e.target.value)} options={[
              { value: 'tls', label: 'TLS / STARTTLS (587)' }, { value: 'ssl', label: 'SSL (465)' }, { value: 'none', label: tr('بدون', 'None') },
            ]} />
          </Field>
          <Field label={tr('اسم المستخدم (البريد كاملًا)', 'Username (full email)')}><Input dir="ltr" autoComplete="off" value={f.username} onChange={e => set('username', e.target.value)} placeholder="noreply@yourdomain.com" /></Field>
          <Field label={tr('كلمة المرور', 'Password')}>
            <SecretField stored={smtp?.password} value={f.password} onChange={v => set('password', v)} />
          </Field>
          <Field label={tr('اسم المرسل', 'From name')}><Input value={f.from_name} onChange={e => set('from_name', e.target.value)} placeholder="WABEK" /></Field>
          <Field label={tr('بريد المرسل', 'From email')}><Input dir="ltr" value={f.from_email} onChange={e => set('from_email', e.target.value)} placeholder="noreply@yourdomain.com" /></Field>
        </div>
        <div className="flex justify-end border-t border-line-soft pt-4">
          <Button loading={saving} onClick={save}>{tr('حفظ إعدادات البريد', 'Save SMTP settings')}</Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <CardHeader icon={PaperAirplaneIcon} title={tr('اختبار الإرسال', 'Send a test email')} subtitle={tr('يستخدم القيم الظاهرة أعلاه، حتى قبل الحفظ.', 'Uses the values shown above, even before saving.')} />
        <div className="flex flex-wrap gap-2">
          <Input type="email" dir="ltr" wrapperClassName="min-w-[220px] flex-1" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="test@example.com" aria-label={tr('أرسل إلى', 'Send to')} />
          <Button variant="secondary" icon={PaperAirplaneIcon} className="rtl:[&_svg]:-scale-x-100" loading={testing} disabled={!testTo} onClick={test}>{tr('إرسال اختبار', 'Send test')}</Button>
        </div>
      </Card>

      <Notice tone="info" icon={InformationCircleIcon} title={tr('إعداد سريع: my.mailbux.com', 'Quick setup: my.mailbux.com')}>
        <span dir="ltr" className="block font-mono text-xs">SMTP my.mailbux.com:587 (TLS) · SMTPS :465 (SSL) · IMAP :993 · POP3 :995</span>
      </Notice>
    </div>
  )
}
