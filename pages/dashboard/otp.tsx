import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, CheckCircleIcon, ClipboardDocumentIcon, CodeBracketIcon, EyeIcon, EyeSlashIcon, KeyIcon,
  PaperAirplaneIcon, PhoneIcon, ShieldCheckIcon, CheckIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, Switch, Tabs, cn } from '@/components/ui'
import { apiError } from '@/components/analytics/format'
import { rich } from '@/components/campaigns/rich'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/otp'

type Key = keyof typeof messages.en
type T = (key: Key, vars?: Record<string, string | number>) => string

type Step = 'send' | 'verify' | 'done'

const PURPOSES: Array<{ value: string; label: Key }> = [
  { value: 'verification', label: 'p_verification' },
  { value: 'login', label: 'p_login' },
  { value: 'transaction', label: 'p_transaction' },
]

const VERIFY_REASONS: Record<string, Key> = {
  'OTP not found': 'vr_not_found',
  'OTP already used': 'vr_used',
  'OTP expired': 'vr_expired',
  'Too many attempts': 'vr_attempts',
  'Invalid OTP': 'vr_invalid',
}

const SEND_ERRORS: Record<string, Key> = {
  no_instance: 'err_no_instance',
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const { t } = useT(messages)
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true); toast.success(t('copied'))
      setTimeout(() => setCopied(false), 1500)
    }, () => toast.error(t('copy_failed')))
  }
  return (
    <div className="relative overflow-hidden rounded-card border border-white/10 bg-[#04282C]">
      <Button size="xs" variant="on-deep-ghost" icon={copied ? CheckIcon : ClipboardDocumentIcon} onClick={copy}
        className="absolute end-2 top-2" aria-label={t('copy_x', { label })}>
        {copied ? t('copied_short') : t('copy')}
      </Button>
      <pre dir="ltr" className="scrollbar-none overflow-x-auto p-4 pt-11 text-start font-mono text-[12.5px] leading-relaxed text-[#EAF7F5]"><code>{code}</code></pre>
    </div>
  )
}

const LANGS = [
  { id: 'curl', label: 'cURL' },
  { id: 'node', label: 'Node.js' },
  { id: 'php', label: 'PHP' },
  { id: 'python', label: 'Python' },
]

function snippets(appUrl: string, key: string) {
  const send = {
    curl: `curl -X POST ${appUrl}/api/v1/otp \\
  -H "X-API-Key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "+905551234567", "purpose": "verification"}'

# Response:
# { "success": true, "otpId": "uuid-of-otp-record" }`,
    node: `const res = await fetch('${appUrl}/api/v1/otp', {
  method: 'POST',
  headers: { 'X-API-Key': '${key}', 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+905551234567', purpose: 'verification' }),
})
const { success, otpId } = await res.json()
// Store otpId — you need it to verify the code.`,
    php: `<?php
$ch = curl_init('${appUrl}/api/v1/otp');
curl_setopt_array($ch, [
  CURLOPT_POST           => 1,
  CURLOPT_POSTFIELDS     => json_encode(['phone' => '+905551234567', 'purpose' => 'verification']),
  CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'X-API-Key: ${key}'],
  CURLOPT_RETURNTRANSFER => true,
]);
$res = json_decode(curl_exec($ch), true);
curl_close($ch);
$otpId = $res['otpId'] ?? '';`,
    python: `import requests

res = requests.post(
    "${appUrl}/api/v1/otp",
    headers={"X-API-Key": "${key}"},
    json={"phone": "+905551234567", "purpose": "verification"},
)
otp_id = res.json()["otpId"]`,
  }
  const verify = {
    curl: `curl -X POST ${appUrl}/api/v1/otp-verify \\
  -H "X-API-Key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"otp_id": "uuid-from-step-1", "otp": "123456"}'

# Response (valid):   { "valid": true }
# Response (invalid): { "valid": false, "reason": "OTP expired" }`,
    node: `const res = await fetch('${appUrl}/api/v1/otp-verify', {
  method: 'POST',
  headers: { 'X-API-Key': '${key}', 'Content-Type': 'application/json' },
  body: JSON.stringify({ otp_id: otpId, otp: codeFromUser }),
})
const { valid, reason } = await res.json()`,
    php: `<?php
$ch = curl_init('${appUrl}/api/v1/otp-verify');
curl_setopt_array($ch, [
  CURLOPT_POST           => 1,
  CURLOPT_POSTFIELDS     => json_encode(['otp_id' => $otpId, 'otp' => $_POST['code']]),
  CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'X-API-Key: ${key}'],
  CURLOPT_RETURNTRANSFER => true,
]);
$res = json_decode(curl_exec($ch), true);
curl_close($ch);
if (!empty($res['valid'])) { /* verified */ }`,
    python: `res = requests.post(
    "${appUrl}/api/v1/otp-verify",
    headers={"X-API-Key": "${key}"},
    json={"otp_id": otp_id, "otp": code_from_user},
)
data = res.json()  # {"valid": True} or {"valid": False, "reason": "..."}`,
  }
  const whmcs = `<?php
// WHMCS Hook: Send OTP on client login
add_hook('ClientLogin', 1, function($vars) {
  $phone  = $vars['client']['phonenumber'];
  $apiKey = '${key}';

  $ch = curl_init('${appUrl}/api/v1/otp');
  curl_setopt_array($ch, [
    CURLOPT_POST       => 1,
    CURLOPT_POSTFIELDS => json_encode(['phone' => $phone, 'purpose' => 'login']),
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-API-Key: '.$apiKey],
    CURLOPT_RETURNTRANSFER => true,
  ]);
  $res = json_decode(curl_exec($ch), true);
  curl_close($ch);

  // Save OTP ID to verify later
  $_SESSION['wabek_otp_id'] = $res['otpId'] ?? '';
});

// WHMCS Hook: Notify on invoice creation
add_hook('InvoiceCreated', 1, function($vars) {
  $apiKey  = '${key}';
  $payload = [
    'action'    => 'InvoiceCreated',
    'invoiceid' => $vars['invoiceid'],
    'userid'    => $vars['userid'],
  ];
  $ch = curl_init('${appUrl}/api/v1/whmcs-webhook');
  curl_setopt_array($ch, [
    CURLOPT_POST       => 1,
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-API-Key: '.$apiKey],
    CURLOPT_RETURNTRANSFER => true,
  ]);
  curl_exec($ch);
  curl_close($ch);
});`
  return { send, verify, whmcs }
}

function StepDot({ n, label, state }: { n: number; label: string; state: 'done' | 'current' | 'todo' }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
        state === 'done' ? 'bg-brand-gradient text-[#04282C]' : state === 'current' ? 'bg-ink text-canvas' : 'bg-surface-3 text-muted')}>
        {state === 'done' ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : n}
      </span>
      <span className={cn('text-[13px]', state === 'todo' ? 'text-muted' : 'font-medium text-ink')}>{label}</span>
    </li>
  )
}

/** Count of minutes with the right plural form (Arabic: 1 / 2 / 3–10 / 11+). */
function minutesLabel(n: number, t: T): string {
  if (n === 1) return t('min_1')
  if (n === 2) return t('min_2')
  if (n >= 3 && n <= 10) return t('min_few', { n })
  return t('min_many', { n })
}

export default function OTPPage() {
  const { t } = useT(messages)
  // The default API key is fetched on demand (owner-only), not from the user object.
  const { data: defaultKeyData, isLoading: keyLoading } = useQuery<{ api_key: string | null }>('default-api-key',
    () => axios.get('/api/settings/default-api-key').then(r => r.data), { retry: false, staleTime: Infinity })
  const apiKey = defaultKeyData?.api_key || null
  // Real server-side OTP settings (OTP_EXPIRY_MINUTES).
  const otpConfigQ = useQuery<{ expiry_minutes: number; code_length: number }>('otp-config',
    () => axios.get('/api/settings/otp-config').then(r => r.data), { retry: false, staleTime: 300000 })

  const [phone, setPhone] = useState('')
  const [purpose, setPurpose] = useState('verification')
  const [otpId, setOtpId] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<Step>('send')
  const [verifyError, setVerifyError] = useState('')
  const [lang, setLang] = useState('curl')
  const [docTab, setDocTab] = useState('send')
  const [showKey, setShowKey] = useState(false)

  // Set after mount so server and client render the same markup.
  const [appUrl, setAppUrl] = useState('https://your-site.netlify.app')
  useEffect(() => { setAppUrl(window.location.origin) }, [])
  const keyInCode = showKey && apiKey ? apiKey : 'YOUR_API_KEY'
  const code = snippets(appUrl, keyInCode)

  const sendMut = useMutation(
    () => axios.post('/api/v1/otp', { phone, purpose }).then(r => r.data),
    {
      onSuccess: (data: { otpId: string }) => {
        setOtpId(data.otpId)
        setOtp(''); setVerifyError('')
        setStep('verify')
        toast.success(t('sent_toast'))
      },
      onError: (e: unknown) => {
        const errCode = (e as { response?: { data?: { code?: string } } })?.response?.data?.code
        toast.error((errCode && SEND_ERRORS[errCode] ? t(SEND_ERRORS[errCode]) : '') || apiError(e, t('send_failed')))
      },
    },
  )

  const verifyMut = useMutation(
    () => axios.post('/api/v1/otp-verify', { otp_id: otpId, otp }).then(r => r.data),
    {
      onSuccess: (data: { valid: boolean; reason?: string }) => {
        if (data.valid) { setStep('done'); setVerifyError(''); toast.success(t('verified_toast')) }
        else {
          const msg = (data.reason && VERIFY_REASONS[data.reason] ? t(VERIFY_REASONS[data.reason]) : '') || data.reason || t('invalid')
          setVerifyError(msg)
          toast.error(msg)
        }
      },
      onError: () => { toast.error(t('verify_failed')) },
    },
  )

  const reset = () => { setStep('send'); setOtp(''); setOtpId(''); setVerifyError('') }

  const copyKey = () => apiKey && navigator.clipboard?.writeText(apiKey).then(() => toast.success(t('key_copied')), () => toast.error(t('copy_failed')))
  const maskedKey = apiKey ? `${apiKey.slice(0, 6)}${'•'.repeat(18)}${apiKey.slice(-4)}` : ''

  return (
    <DashboardLayout title={t('page_title')}>
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={<Button variant="secondary" icon={KeyIcon} href="/dashboard/api-keys">{t('api_keys')}</Button>}
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* Live test */}
          <Card padding="lg" className="lg:col-span-3">
            <CardHeader className="!p-0" title={t('live_title')} subtitle={t('live_sub')} icon={ShieldCheckIcon} />
            <ol className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2" aria-label={t('steps_aria')}>
              <StepDot n={1} label={t('s_send')} state={step === 'send' ? 'current' : 'done'} />
              <span className="hidden h-px w-8 bg-line sm:block" aria-hidden="true" />
              <StepDot n={2} label={t('s_enter')} state={step === 'verify' ? 'current' : step === 'done' ? 'done' : 'todo'} />
              <span className="hidden h-px w-8 bg-line sm:block" aria-hidden="true" />
              <StepDot n={3} label={t('s_done')} state={step === 'done' ? 'done' : 'todo'} />
            </ol>

            <div className="mt-6">
              {step === 'send' && (
                <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); if (phone) sendMut.mutate() }}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('phone')} hint={t('phone_hint')} required>
                      <Input dir="ltr" type="tel" icon={PhoneIcon} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+905551234567" />
                    </Field>
                    <Field label={t('purpose')}>
                      <Select value={purpose} onChange={e => setPurpose(e.target.value)} options={PURPOSES.map(p => ({ value: p.value, label: t(p.label) }))} />
                    </Field>
                  </div>
                  <div>
                    <Button type="submit" icon={PaperAirplaneIcon} loading={sendMut.isLoading} disabled={!phone}>{t('send_btn')}</Button>
                  </div>
                </form>
              )}

              {step === 'verify' && (
                <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); if (otp.length === 6) verifyMut.mutate() }}>
                  <div className="flex items-start gap-3 rounded-card bg-chip p-4 text-sm text-chip-ink">
                    <CheckCircleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <p>{rich(t('sent_to'), { phone: <strong dir="ltr">{phone}</strong> })}</p>
                  </div>
                  <Field label={t('otp_id')} hint={t('otp_id_hint')}>
                    <Input dir="ltr" readOnly value={otpId} className="font-mono text-xs text-muted" />
                  </Field>
                  <Field label={t('code_6')} error={verifyError || undefined}>
                    <Input dir="ltr" inputMode="numeric" autoComplete="one-time-code" value={otp} maxLength={6} placeholder="123456" size="lg"
                      className="text-center font-mono text-xl tracking-[0.5em]"
                      onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setVerifyError('') }} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" icon={CheckCircleIcon} loading={verifyMut.isLoading} disabled={otp.length < 6}>{t('verify_btn')}</Button>
                    <Button type="button" variant="secondary" icon={ArrowPathIcon} onClick={reset}>{t('resend')}</Button>
                  </div>
                </form>
              )}

              {step === 'done' && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-[#04282C] shadow-glow">
                    <CheckCircleIcon className="h-8 w-8" aria-hidden="true" />
                  </span>
                  <p className="text-xl font-bold text-ink">{t('done_title')}</p>
                  <p className="text-sm text-muted">{t('done_desc')}</p>
                  <Button variant="secondary" onClick={() => { reset(); setPhone('') }}>{t('try_other')}</Button>
                </div>
              )}
            </div>
          </Card>

          {/* Settings + key */}
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
            <Card padding="lg">
              <CardHeader className="!p-0" title={t('key_title')} icon={KeyIcon} />
              <div className="mt-4">
                {keyLoading ? <div className="skeleton h-11 w-full rounded-field" /> : apiKey ? (
                  <div className="flex items-center gap-2">
                    <code dir="ltr" className="min-w-0 flex-1 truncate rounded-field border border-line bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-ink">{showKey ? apiKey : maskedKey}</code>
                    <Button size="icon" variant="secondary" icon={showKey ? EyeSlashIcon : EyeIcon} aria-label={showKey ? t('hide_key') : t('show_key')} onClick={() => setShowKey(v => !v)} />
                    <Button size="icon" variant="secondary" icon={ClipboardDocumentIcon} aria-label={t('copy_key')} onClick={copyKey} />
                  </div>
                ) : (
                  <p className="text-sm text-muted">{rich(t('key_owner_only'), { link: <Link href="/dashboard/api-keys" className="text-link hover:text-link-hover">{t('api_keys')}</Link> })}</p>
                )}
                {apiKey && (
                  <Switch size="sm" className="mt-4" checked={showKey} onChange={setShowKey}
                    label={t('show_in_code')} description={t('show_in_code_desc')} />
                )}
              </div>
            </Card>

            <Card padding="lg">
              <CardHeader className="!p-0" title={t('settings_title')} />
              <dl className="mt-3 divide-y divide-line-soft text-sm">
                {[
                  { label: t('s_length'), value: t('s_length_v') },
                  { label: t('s_expiry'), value: otpConfigQ.data ? minutesLabel(otpConfigQ.data.expiry_minutes, t) : '…' },
                  { label: t('s_usage'), value: t('s_usage_v') },
                  { label: t('s_storage'), value: t('s_storage_v') },
                  { label: t('s_sending'), value: t('s_sending_v') },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-muted">{s.label}</dt>
                    <dd className="font-medium text-ink">{s.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted">{rich(t('expiry_note'), { env: <code dir="ltr" className="rounded bg-surface-3 px-1 font-mono">OTP_EXPIRY_MINUTES</code> })}</p>
            </Card>
          </div>
        </div>

        {/* API docs */}
        <Card padding="none">
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardHeader className="!p-0" title={t('api_title')} subtitle={t('api_sub')} icon={CodeBracketIcon} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 sm:px-6">
            <Tabs idPrefix="otp-doc" value={docTab} onChange={setDocTab} aria-label={t('docs_aria')}
              tabs={[{ id: 'send', label: t('tab_send') }, { id: 'verify', label: t('tab_verify') }, { id: 'whmcs', label: 'WHMCS' }]} />
          </div>
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            {docTab !== 'whmcs' ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge tone="brand" size="md">POST</Badge>
                    <code dir="ltr" className="font-mono text-sm text-ink">{docTab === 'send' ? '/api/v1/otp' : '/api/v1/otp-verify'}</code>
                  </div>
                  <Tabs variant="segmented" size="sm" value={lang} onChange={setLang} tabs={LANGS} aria-label={t('lang_aria')} />
                </div>
                {docTab === 'send' ? (
                  <p className="text-sm text-muted">
                    {rich(t('send_fields'), {
                      phone: <code dir="ltr" className="font-mono text-ink">phone</code>,
                      purpose: <code dir="ltr" className="font-mono text-ink">purpose</code>,
                      instance: <code dir="ltr" className="font-mono text-ink">instance_id</code>,
                      brand: <code dir="ltr" className="font-mono text-ink">brand_name</code>,
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-muted">{rich(t('verify_fields'), { otp_id: <code dir="ltr" className="font-mono text-ink">otp_id</code>, otp: <code dir="ltr" className="font-mono text-ink">otp</code> })}</p>
                )}
                <CodeBlock label={t('example')} code={(docTab === 'send' ? code.send : code.verify)[lang as keyof typeof code.send]} />
              </>
            ) : (
              <>
                <p className="text-sm text-muted">{rich(t('whmcs_note'), { dir: <code dir="ltr" className="font-mono text-ink">/includes/hooks/</code>, file: <code dir="ltr" className="font-mono text-ink">wabek_otp.php</code> })}</p>
                <CodeBlock label={t('whmcs_file')} code={code.whmcs} />
              </>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
