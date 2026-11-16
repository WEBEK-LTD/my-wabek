import React, { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  BeakerIcon, CheckCircleIcon, ExclamationTriangleIcon, FingerPrintIcon, KeyIcon, LockClosedIcon, PaperAirplaneIcon, ShieldCheckIcon, XCircleIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, Input, Select, cn } from '@/components/ui'
import { useAdminT, useApiError } from '../i18n'
import { Notice, SettingRow } from '../shared'
import { Bound, NumberRow, SelectRow, ToggleRow } from './controls'
import messages from '@/locales/admin/settings/security'

interface Instance { id: string; display_name?: string | null; phone_number?: string | null; instance_type?: string | null }
interface OtpAttempt { templateName?: string; language?: string; components?: string; ok?: boolean; status?: number | string; error?: string }
interface OtpResult {
  success: boolean; error?: string; provider?: string; note?: string; templateName?: string; usedTemplateName?: string
  usedLanguage?: string; usedComponents?: string; messageId?: string; attempts?: OtpAttempt[]
}

export function SecuritySection({ settings, set, instances, dirty }: Bound & { instances: Instance[]; dirty: boolean }) {
  const { t } = useAdminT(messages)
  const apiError = useApiError()
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
      if (r.data.success) toast.success(t('testOtpSent'))
      else toast.error(t('testOtpFailedSee'))
    } catch (e: unknown) {
      setRes({ success: false, error: apiError(e, (e as { message?: string })?.message || t('requestFailed')) })
      toast.error(t('requestFailed'))
    } finally { setOtpTesting(false) }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={ShieldCheckIcon} title={t('whatsappOtpVerification')} subtitle={t('controlVerificationCodesAll')} />
        <div className="mt-2">
          <ToggleRow {...b} k="otp_required_on_register" label={t('requireOtpRegistration')}
            desc={t('newUsersMustVerify')} />
          <SelectRow {...b} k="otp_provider" label={t('otpProvider')} desc={t('whatsappConnectionUsedSend')}
            options={[{ value: 'wa_web', label: t('whatsappWebQr') }, { value: 'cloud_api', label: 'Cloud API (Meta)' }]} />
          <SettingRow label={t('otpWhatsappNumber')} description={t('connectedNumberThatSends')} htmlFor="set-otp_instance_id">
            <div className="space-y-1.5">
              <Select id="set-otp_instance_id" size="sm" className="min-w-[240px]" value={(settings.otp_instance_id as string) || ''} onChange={e => set('otp_instance_id', e.target.value)}
                options={[{ value: '', label: t('autoFirstConnectedNumber') },
                  ...instances.map(i => ({ value: i.id, label: `${i.display_name || i.phone_number} (${i.instance_type === 'wa_web' ? 'WA Web' : 'Cloud API'})` }))]} />
              {instances.length === 0 && <p className="flex items-center gap-1 text-xs text-warning"><ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />{t('noConnectedNumbers')}</p>}
            </div>
          </SettingRow>
          <NumberRow {...b} k="otp_expiry_minutes" label={t('codeLifetime')} desc={t('minutes')} min={1} max={60} suffix={t('min')} />
          <NumberRow {...b} k="otp_max_attempts" label={t('maxAttempts')} desc={t('wrongAttemptsBeforeCode')} min={1} max={10} />
          <SettingRow stacked htmlFor="set-otp_template_name" label={t('otpTemplateName')}
            description={<>{t('metaApprovedAuthenticationTemplate')} <code dir="ltr" className="rounded bg-surface-3 px-1 font-mono">wabek_otp</code> {t('parameter')} <code dir="ltr" className="rounded bg-surface-3 px-1 font-mono">otp_code</code>).</>}>
            <div className="flex flex-wrap items-center gap-2">
              <Input id="set-otp_template_name" dir="ltr" size="sm" className="font-mono" wrapperClassName="w-56" value={tmpl} onChange={e => set('otp_template_name', e.target.value)} placeholder="wabek_otp" />
              <span className="text-xs text-muted">{t('presets')}</span>
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
        <CardHeader icon={BeakerIcon} title={t('sendTestOtp')}
          subtitle={t('sendsRealCode123456')} />
        {dirty && <Notice className="mt-3" tone="warning" icon={ExclamationTriangleIcon}>{t('saveSettingsFirstIf')}</Notice>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Input dir="ltr" inputMode="tel" className="font-mono" wrapperClassName="w-64" value={otpTestPhone} onChange={e => setOtpTestPhone(e.target.value)} placeholder="201234567890" aria-label={t('testNumberCountryCode')} />
          <Button variant="secondary" icon={PaperAirplaneIcon} className="rtl:[&_svg]:-scale-x-100" loading={otpTesting} disabled={!otpTestPhone} onClick={sendTest}>{t('sendTest')}</Button>
        </div>
        {res && (
          <div className={cn('mt-4 space-y-1.5 rounded-xl border p-4 text-sm', res.success ? 'border-success/25 bg-success-bg' : 'border-danger/25 bg-danger-bg')} role="status">
            {res.success ? (
              <>
                <p className="flex items-center gap-2 font-semibold text-success"><CheckCircleIcon className="h-5 w-5" aria-hidden="true" />{t('sentSuccessfully')}</p>
                {res.provider === 'wa_web' ? <p className="text-body">{apiError.text(res.note)}</p> : (
                  <dl className="grid gap-1 font-mono text-xs text-body sm:grid-cols-2" dir="ltr">
                    <div><dt className="inline text-muted">{t('diagConfigured')} </dt><dd className="inline font-semibold">{res.templateName}</dd></div>
                    <div><dt className="inline text-muted">{t('diagUsed')} </dt><dd className="inline font-semibold">{res.usedTemplateName}</dd></div>
                    <div><dt className="inline text-muted">{t('diagLanguage')} </dt><dd className="inline font-semibold">{res.usedLanguage}</dd></div>
                    <div><dt className="inline text-muted">{t('diagComponents')} </dt><dd className="inline font-semibold">{res.usedComponents}</dd></div>
                    <div className="sm:col-span-2"><dt className="inline text-muted">{t('diagMessageId')} </dt><dd className="inline break-all">{res.messageId}</dd></div>
                  </dl>
                )}
                {res.provider !== 'wa_web' && res.usedTemplateName && res.usedTemplateName !== res.templateName && (
                  <Notice tone="warning" icon={ExclamationTriangleIcon} className="mt-2">
                    {t('configuredTemplateWasnT', { usedTemplateName: res.usedTemplateName })}
                  </Notice>
                )}
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 font-semibold text-danger"><XCircleIcon className="h-5 w-5" aria-hidden="true" />{t('failed')}</p>
                {res.error && <p className="text-body">{apiError.text(res.error)}</p>}
                {Array.isArray(res.attempts) && (
                  <div className="mt-2 max-h-64 space-y-1 overflow-y-auto font-mono text-xs text-body" dir="ltr">
                    <p className="text-muted">{t('diagAttempts', { n: res.attempts.length })}</p>
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
        <CardHeader icon={LockClosedIcon} title={t('loginSecurity')} />
        <div className="mt-2">
          <NumberRow {...b} k="max_login_attempts" label={t('maxFailedLoginAttempts')} desc={t('accountLocksAfterMany')} min={3} max={20} />
          <NumberRow {...b} k="lockout_minutes" label={t('lockoutDuration')} desc={t('minutes')} min={5} max={1440} suffix={t('min')} />
          <ToggleRow {...b} k="require_strong_password" label={t('requireStrongPasswords')} desc={t('least8Characters')} />
        </div>
      </Card>

      <Card variant="muted">
        <CardHeader icon={FingerPrintIcon} title={t('securitySpecs')} action={<Badge tone="success" size="sm" icon={KeyIcon}>{t('enforced')}</Badge>} />
        <dl className="mt-3 divide-y divide-line-soft">
          {[
            { l: t('passwordHashing'), v: t('specBcrypt') },
            { l: t('jwtAlgorithm'), v: t('specJwt') },
            { l: t('apiKeys'), v: t('specApiKeys') },
            { l: t('otpCodes'), v: t('specOtp') },
            { l: t('deviceTracking'), v: t('specDevice') },
            { l: t('trustedDevices'), v: t('specTrusted') },
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
