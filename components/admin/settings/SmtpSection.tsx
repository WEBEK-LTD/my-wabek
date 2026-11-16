import React, { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { EnvelopeIcon, InformationCircleIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, Field, Input, Select } from '@/components/ui'
import { useApiError, useAdminT } from '../i18n'
import { Notice, SecretField } from '../shared'
import messages from '@/locales/admin/settings/smtp'

const DEFAULTS = { host: 'my.mailbux.com', port: '587', secure: 'tls', username: '', password: '', from_name: '', from_email: '' }
type Smtp = typeof DEFAULTS

export function SmtpSection({ smtp, onSaved }: { smtp: Partial<Smtp> | undefined; onSaved: (next: Smtp) => void }) {
  const { t } = useAdminT(messages)
  const apiError = useApiError()
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
      toast.success(t('testEmailSent'))
    } catch (e) { toast.error(apiError(e, t('smtpTestFailed'))) }
    setTesting(false)
  }
  const save = async () => {
    setSaving(true)
    try {
      await axios.put('/api/admin/seo', { smtp: f })
      onSaved(f)
      toast.success(t('smtpSettingsSaved'))
    } catch (e) { toast.error(apiError(e, t('failedSave'))) }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-5">
        <CardHeader icon={EnvelopeIcon} title={t('mailServerSmtp')} subtitle={t('usedEmailNotificationsPassword')}
          action={<Badge tone={configured ? 'success' : 'warning'} dot>{configured ? t('configured') : t('incomplete')}</Badge>} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('host')} className="sm:col-span-2"><Input dir="ltr" value={f.host} onChange={e => set('host', e.target.value)} placeholder="my.mailbux.com" /></Field>
          <Field label={t('port')} hint="25 · 465 · 587 · 2525"><Input dir="ltr" inputMode="numeric" value={f.port} onChange={e => set('port', e.target.value)} placeholder="587" /></Field>
          <Field label={t('security')}>
            <Select value={f.secure} onChange={e => set('secure', e.target.value)} options={[
              { value: 'tls', label: 'TLS / STARTTLS (587)' }, { value: 'ssl', label: 'SSL (465)' }, { value: 'none', label: t('none') },
            ]} />
          </Field>
          <Field label={t('usernameFullEmail')}><Input dir="ltr" autoComplete="off" value={f.username} onChange={e => set('username', e.target.value)} placeholder="noreply@yourdomain.com" /></Field>
          <Field label={t('password')}>
            <SecretField stored={smtp?.password} value={f.password} onChange={v => set('password', v)} />
          </Field>
          <Field label={t('name')}><Input value={f.from_name} onChange={e => set('from_name', e.target.value)} placeholder="WABEK" /></Field>
          <Field label={t('email')}><Input dir="ltr" value={f.from_email} onChange={e => set('from_email', e.target.value)} placeholder="noreply@yourdomain.com" /></Field>
        </div>
        <div className="flex justify-end border-t border-line-soft pt-4">
          <Button loading={saving} onClick={save}>{t('saveSmtpSettings')}</Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <CardHeader icon={PaperAirplaneIcon} title={t('sendTestEmail')} subtitle={t('usesValuesShownAbove')} />
        <div className="flex flex-wrap gap-2">
          <Input type="email" dir="ltr" wrapperClassName="min-w-[220px] flex-1" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="test@example.com" aria-label={t('send')} />
          <Button variant="secondary" icon={PaperAirplaneIcon} className="rtl:[&_svg]:-scale-x-100" loading={testing} disabled={!testTo} onClick={test}>{t('sendTest')}</Button>
        </div>
      </Card>

      <Notice tone="info" icon={InformationCircleIcon} title={t('quickSetupMyMailbux')}>
        <span dir="ltr" className="block font-mono text-xs">SMTP my.mailbux.com:587 (TLS) · SMTPS :465 (SSL) · IMAP :993 · POP3 :995</span>
      </Notice>
    </div>
  )
}
