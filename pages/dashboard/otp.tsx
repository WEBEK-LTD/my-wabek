import { useState } from 'react'
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

type Step = 'send' | 'verify' | 'done'

const PURPOSES = [
  { value: 'verification', label: 'تحقق' },
  { value: 'login', label: 'تسجيل الدخول' },
  { value: 'transaction', label: 'عملية مالية' },
]

const VERIFY_REASONS: Record<string, string> = {
  'OTP not found': 'الرمز غير موجود',
  'OTP already used': 'استُخدم هذا الرمز من قبل',
  'OTP expired': 'انتهت صلاحية الرمز',
  'Too many attempts': 'محاولات كثيرة، اطلب رمزًا جديدًا',
  'Invalid OTP': 'الرمز غير صحيح',
}

const SEND_ERRORS: Record<string, string> = {
  no_instance: 'لا يوجد رقم واتساب متصل لإرسال الرمز. اربط رقمًا أولًا.',
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true); toast.success('تم النسخ')
      setTimeout(() => setCopied(false), 1500)
    }, () => toast.error('تعذّر النسخ'))
  }
  return (
    <div className="relative overflow-hidden rounded-card border border-white/10 bg-[#04282C]">
      <Button size="xs" variant="on-deep-ghost" icon={copied ? CheckIcon : ClipboardDocumentIcon} onClick={copy}
        className="absolute end-2 top-2" aria-label={`نسخ ${label}`}>
        {copied ? 'نُسخ' : 'نسخ'}
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

export default function OTPPage() {
  // The default API key is fetched on demand (owner-only), not from the user object.
  const { data: defaultKeyData, isLoading: keyLoading } = useQuery<{ api_key: string | null }>('default-api-key',
    () => axios.get('/api/settings/default-api-key').then(r => r.data), { retry: false, staleTime: Infinity })
  const apiKey = defaultKeyData?.api_key || null

  const [phone, setPhone] = useState('')
  const [purpose, setPurpose] = useState('verification')
  const [otpId, setOtpId] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<Step>('send')
  const [verifyError, setVerifyError] = useState('')
  const [lang, setLang] = useState('curl')
  const [docTab, setDocTab] = useState('send')
  const [showKey, setShowKey] = useState(false)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-site.netlify.app'
  const keyInCode = showKey && apiKey ? apiKey : 'YOUR_API_KEY'
  const code = snippets(appUrl, keyInCode)

  const sendMut = useMutation(
    () => axios.post('/api/v1/otp', { phone, purpose }).then(r => r.data),
    {
      onSuccess: (data: { otpId: string }) => {
        setOtpId(data.otpId)
        setOtp(''); setVerifyError('')
        setStep('verify')
        toast.success('أُرسل الرمز عبر واتساب')
      },
      onError: (e: unknown) => {
        const errCode = (e as { response?: { data?: { code?: string } } })?.response?.data?.code
        toast.error((errCode && SEND_ERRORS[errCode]) || apiError(e, 'تعذّر إرسال الرمز'))
      },
    },
  )

  const verifyMut = useMutation(
    () => axios.post('/api/v1/otp-verify', { otp_id: otpId, otp }).then(r => r.data),
    {
      onSuccess: (data: { valid: boolean; reason?: string }) => {
        if (data.valid) { setStep('done'); setVerifyError(''); toast.success('تم التحقق من الرمز بنجاح') }
        else {
          const msg = (data.reason && VERIFY_REASONS[data.reason]) || data.reason || 'الرمز غير صالح'
          setVerifyError(msg)
          toast.error(msg)
        }
      },
      onError: () => { toast.error('تعذّر التحقق') },
    },
  )

  const reset = () => { setStep('send'); setOtp(''); setOtpId(''); setVerifyError('') }

  const copyKey = () => apiKey && navigator.clipboard?.writeText(apiKey).then(() => toast.success('نُسخ المفتاح'), () => toast.error('تعذّر النسخ'))
  const maskedKey = apiKey ? `${apiKey.slice(0, 6)}${'•'.repeat(18)}${apiKey.slice(-4)}` : ''

  return (
    <DashboardLayout title="OTP System">
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="الحملات"
          title="رموز التحقق (OTP)"
          description="أرسل رموز تحقق لمرة واحدة إلى عملائك عبر واتساب، وتحقّق منها من موقعك أو تطبيقك عبر واجهة برمجية بسيطة."
          actions={<Button variant="secondary" icon={KeyIcon} href="/dashboard/api-keys">مفاتيح API</Button>}
        />

        <div className="grid gap-5 lg:grid-cols-5">
          {/* Live test */}
          <Card padding="lg" className="lg:col-span-3">
            <CardHeader title="تجربة مباشرة" subtitle="أرسل رمزًا إلى رقمك ثم أدخله للتحقق." icon={ShieldCheckIcon} />
            <ol className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="مراحل التجربة">
              <StepDot n={1} label="إرسال الرمز" state={step === 'send' ? 'current' : 'done'} />
              <span className="hidden h-px w-8 bg-line sm:block" aria-hidden="true" />
              <StepDot n={2} label="إدخال الرمز" state={step === 'verify' ? 'current' : step === 'done' ? 'done' : 'todo'} />
              <span className="hidden h-px w-8 bg-line sm:block" aria-hidden="true" />
              <StepDot n={3} label="تم التحقق" state={step === 'done' ? 'done' : 'todo'} />
            </ol>

            <div className="mt-6">
              {step === 'send' && (
                <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); if (phone) sendMut.mutate() }}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="رقم الهاتف" hint="بالصيغة الدولية، مثل ‎+905551234567" required>
                      <Input dir="ltr" type="tel" icon={PhoneIcon} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+905551234567" />
                    </Field>
                    <Field label="الغرض">
                      <Select value={purpose} onChange={e => setPurpose(e.target.value)} options={PURPOSES} />
                    </Field>
                  </div>
                  <div>
                    <Button type="submit" icon={PaperAirplaneIcon} loading={sendMut.isLoading} disabled={!phone}>إرسال الرمز عبر واتساب</Button>
                  </div>
                </form>
              )}

              {step === 'verify' && (
                <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); if (otp.length === 6) verifyMut.mutate() }}>
                  <div className="flex items-start gap-3 rounded-card bg-chip p-4 text-sm text-chip-ink">
                    <CheckCircleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <p>أُرسل الرمز إلى <strong dir="ltr">{phone}</strong>. افتح واتساب وأدخل الرمز المكوّن من 6 أرقام.</p>
                  </div>
                  <Field label="معرّف الرمز (otp_id)" hint="يُملأ تلقائيًا — هذا ما تحفظه في نظامك بعد الخطوة الأولى.">
                    <Input dir="ltr" readOnly value={otpId} className="font-mono text-xs text-muted" />
                  </Field>
                  <Field label="الرمز المكوّن من 6 أرقام" error={verifyError || undefined}>
                    <Input dir="ltr" inputMode="numeric" autoComplete="one-time-code" value={otp} maxLength={6} placeholder="123456" size="lg"
                      className="text-center font-mono text-xl tracking-[0.5em]"
                      onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setVerifyError('') }} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" icon={CheckCircleIcon} loading={verifyMut.isLoading} disabled={otp.length < 6}>تحقّق من الرمز</Button>
                    <Button type="button" variant="secondary" icon={ArrowPathIcon} onClick={reset}>إعادة الإرسال</Button>
                  </div>
                </form>
              )}

              {step === 'done' && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-[#04282C] shadow-glow">
                    <CheckCircleIcon className="h-8 w-8" aria-hidden="true" />
                  </span>
                  <p className="text-xl font-bold text-ink">تم التحقق من الرمز</p>
                  <p className="text-sm text-muted">كان الرمز صالحًا، وقد عُلّم الآن بأنه مستخدم.</p>
                  <Button variant="secondary" onClick={() => { reset(); setPhone('') }}>تجربة رقم آخر</Button>
                </div>
              )}
            </div>
          </Card>

          {/* Settings + key */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            <Card padding="lg">
              <CardHeader title="مفتاح API الافتراضي" icon={KeyIcon} />
              <div className="mt-4">
                {keyLoading ? <div className="skeleton h-11 w-full rounded-field" /> : apiKey ? (
                  <div className="flex items-center gap-2">
                    <code dir="ltr" className="min-w-0 flex-1 truncate rounded-field border border-line bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-ink">{showKey ? apiKey : maskedKey}</code>
                    <Button size="icon" variant="secondary" icon={showKey ? EyeSlashIcon : EyeIcon} aria-label={showKey ? 'إخفاء المفتاح' : 'إظهار المفتاح'} onClick={() => setShowKey(v => !v)} />
                    <Button size="icon" variant="secondary" icon={ClipboardDocumentIcon} aria-label="نسخ المفتاح" onClick={copyKey} />
                  </div>
                ) : (
                  <p className="text-sm text-muted">لا يظهر المفتاح الافتراضي إلا لمالك الحساب. يمكنك إنشاء مفتاح من صفحة <Link href="/dashboard/api-keys" className="text-link hover:text-link-hover">مفاتيح API</Link>.</p>
                )}
                {apiKey && (
                  <Switch size="sm" className="mt-4" checked={showKey} onChange={setShowKey}
                    label="إظهار مفتاحي في أمثلة الكود" description="أبقِه مخفيًا عند مشاركة الشاشة." />
                )}
              </div>
            </Card>

            <Card padding="lg">
              <CardHeader title="إعدادات الرموز" />
              <dl className="mt-3 divide-y divide-line-soft text-sm">
                {[
                  { label: 'طول الرمز', value: '6 أرقام' },
                  { label: 'مدة الصلاحية', value: `${process.env.NEXT_PUBLIC_OTP_EXPIRY || 10} دقائق` },
                  { label: 'الاستخدام', value: 'مرة واحدة فقط' },
                  { label: 'التخزين', value: 'مُشفّر بـ SHA-256' },
                  { label: 'الإرسال', value: 'عبر رقم واتساب المتصل' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between gap-3 py-2.5">
                    <dt className="text-muted">{s.label}</dt>
                    <dd className="font-medium text-ink">{s.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-muted">لتغيير مدة الصلاحية عدّل متغير البيئة <code dir="ltr" className="rounded bg-surface-3 px-1 font-mono">OTP_EXPIRY_MINUTES</code> في Netlify.</p>
            </Card>
          </div>
        </div>

        {/* API docs */}
        <Card padding="none">
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <CardHeader title="الربط عبر الواجهة البرمجية" subtitle="خطوتان: أرسل الرمز واحفظ otpId، ثم تحقّق من الرمز الذي يدخله العميل." icon={CodeBracketIcon} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 sm:px-6">
            <Tabs idPrefix="otp-doc" value={docTab} onChange={setDocTab} aria-label="أقسام التوثيق"
              tabs={[{ id: 'send', label: '1 · إرسال الرمز' }, { id: 'verify', label: '2 · التحقق' }, { id: 'whmcs', label: 'WHMCS' }]} />
          </div>
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            {docTab !== 'whmcs' ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge tone="brand" size="md">POST</Badge>
                    <code dir="ltr" className="font-mono text-sm text-ink">{docTab === 'send' ? '/api/v1/otp' : '/api/v1/otp-verify'}</code>
                  </div>
                  <Tabs variant="segmented" size="sm" value={lang} onChange={setLang} tabs={LANGS} aria-label="لغة البرمجة" />
                </div>
                {docTab === 'send' ? (
                  <p className="text-sm text-muted">
                    الحقول: <code dir="ltr" className="font-mono text-ink">phone</code> (إلزامي) و<code dir="ltr" className="font-mono text-ink">purpose</code> (verification | login | transaction).
                    اختياريًا: <code dir="ltr" className="font-mono text-ink">instance_id</code> لاختيار رقم الإرسال، و<code dir="ltr" className="font-mono text-ink">brand_name</code>.
                  </p>
                ) : (
                  <p className="text-sm text-muted">أرسل <code dir="ltr" className="font-mono text-ink">otp_id</code> من الخطوة الأولى مع <code dir="ltr" className="font-mono text-ink">otp</code> الذي أدخله العميل. يُرفض الرمز بعد استخدامه أو انتهاء صلاحيته.</p>
                )}
                <CodeBlock label="المثال" code={(docTab === 'send' ? code.send : code.verify)[lang as keyof typeof code.send]} />
              </>
            ) : (
              <>
                <p className="text-sm text-muted">ضع الملف في مجلد <code dir="ltr" className="font-mono text-ink">/includes/hooks/</code> في WHMCS باسم <code dir="ltr" className="font-mono text-ink">wabek_otp.php</code>.</p>
                <CodeBlock label="ملف WHMCS" code={code.whmcs} />
              </>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
