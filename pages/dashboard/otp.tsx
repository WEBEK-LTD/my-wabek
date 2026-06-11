// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useMutation } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ShieldCheckIcon, PaperAirplaneIcon, CheckCircleIcon, ClipboardIcon, CodeBracketIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/store'

export default function OTPPage() {
  const { user } = useAuthStore()
  const [phone, setPhone] = useState('')
  const [purpose, setPurpose] = useState('verification')
  const [otpId, setOtpId] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'send' | 'verify' | 'done'>('send')
  const [verifyResult, setVerifyResult] = useState(null)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-site.netlify.app'
  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!') }

  const sendMut = useMutation(
    () => axios.post('/api/v1/otp', { phone, purpose }).then(r => r.data),
    {
      onSuccess: (data) => {
        setOtpId(data.otpId)
        setStep('verify')
        toast.success('OTP sent via WhatsApp!')
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'Failed to send OTP'),
    }
  )

  const verifyMut = useMutation(
    () => axios.post('/api/v1/otp-verify', { otp_id: otpId, otp }).then(r => r.data),
    {
      onSuccess: (data) => {
        setVerifyResult(data)
        if (data.valid) { setStep('done'); toast.success('OTP verified successfully!') }
        else toast.error(`Invalid: ${data.reason}`)
      },
      onError: () => toast.error('Verification failed'),
    }
  )

  return (
    <DashboardLayout title="OTP System">
      <div className="max-w-3xl space-y-6">

        {/* Header */}
        <div className="card border-blue-200/50 bg-blue-50/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-slate-900">WhatsApp OTP System</h3>
              <p className="text-sm text-slate-400">Send one-time passwords via WhatsApp for verification</p>
            </div>
          </div>
        </div>

        {/* Live Test */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-4">🧪 Live Test</h3>

          {step === 'send' && (
            <div className="space-y-4">
              <div>
                <label className="label">Phone Number</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+905551234567" className="input" />
              </div>
              <div>
                <label className="label">Purpose</label>
                <select value={purpose} onChange={e => setPurpose(e.target.value)} className="input">
                  <option value="verification">Verification</option>
                  <option value="login">Login</option>
                  <option value="transaction">Transaction</option>
                </select>
              </div>
              <button onClick={() => sendMut.mutate()} disabled={!phone || sendMut.isLoading} className="btn-primary">
                <PaperAirplaneIcon className="w-4 h-4" />
                {sendMut.isLoading ? 'Sending…' : 'Send OTP via WhatsApp'}
              </button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <div className="bg-blue-50/20 border border-blue-200 rounded-lg p-3 text-sm text-blue-600">
                ✅ OTP sent to <strong>{phone}</strong> — check WhatsApp!
              </div>
              <div>
                <label className="label">OTP ID (auto-filled)</label>
                <input value={otpId} readOnly className="input opacity-60 font-mono text-xs" />
              </div>
              <div>
                <label className="label">Enter the 6-digit OTP</label>
                <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="123456" maxLength={6} className="input font-mono text-xl tracking-[0.5em] text-center" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => verifyMut.mutate()} disabled={otp.length < 6 || verifyMut.isLoading} className="btn-primary flex-1">
                  <CheckCircleIcon className="w-4 h-4" />
                  {verifyMut.isLoading ? 'Verifying…' : 'Verify OTP'}
                </button>
                <button onClick={() => { setStep('send'); setOtp(''); setOtpId('') }} className="btn-secondary">
                  Resend
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircleIcon className="w-8 h-8 text-blue-600" />
              </div>
              <p className="font-display font-bold text-xl text-slate-900 mb-1">OTP Verified! ✅</p>
              <p className="text-slate-400 text-sm mb-4">The OTP was valid and has been marked as used.</p>
              <button onClick={() => { setStep('send'); setPhone(''); setOtp(''); setOtpId('') }} className="btn-secondary">
                Test Another
              </button>
            </div>
          )}
        </div>

        {/* API Reference */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CodeBracketIcon className="w-5 h-5 text-blue-600" />
            API Integration
          </h3>
          <div className="space-y-4">

            {/* Step 1: Send OTP */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Step 1 — Send OTP</p>
              <div className="bg-[#F8FAFC] rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">POST</span>
                    <code className="text-sm text-slate-800 font-mono text-slate-800">/api/v1/otp</code>
                  </div>
                  <button onClick={() => copy(`curl -X POST ${appUrl}/api/v1/otp \\\n  -H "X-API-Key: ${user?.api_key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"phone": "+905551234567", "purpose": "verification"}'`)} className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1">
                    <ClipboardIcon className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
                <pre className="px-4 py-3 text-xs text-slate-800 font-mono overflow-x-auto bg-white rounded-lg border border-slate-200">{`curl -X POST ${appUrl}/api/v1/otp \\
  -H "X-API-Key: ${user?.api_key || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "+905551234567", "purpose": "verification"}'

// Response:
{
  "success": true,
  "otpId": "uuid-of-otp-record"
}`}</pre>
              </div>
            </div>

            {/* Step 2: Verify OTP */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Step 2 — Verify OTP</p>
              <div className="bg-[#F8FAFC] rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">POST</span>
                    <code className="text-sm text-slate-800 font-mono text-slate-800">/api/v1/otp-verify</code>
                  </div>
                  <button onClick={() => copy(`curl -X POST ${appUrl}/api/v1/otp-verify \\\n  -H "X-API-Key: ${user?.api_key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"otp_id": "uuid-from-step-1", "otp": "123456"}'`)} className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1">
                    <ClipboardIcon className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
                <pre className="px-4 py-3 text-xs text-slate-800 font-mono overflow-x-auto bg-white rounded-lg border border-slate-200">{`curl -X POST ${appUrl}/api/v1/otp-verify \\
  -H "X-API-Key: ${user?.api_key || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{"otp_id": "uuid-from-step-1", "otp": "123456"}'

// Response (valid):
{ "valid": true }

// Response (invalid):
{ "valid": false, "reason": "OTP expired" }`}</pre>
              </div>
            </div>

            {/* WHMCS Integration */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">WHMCS Hook Integration (PHP)</p>
              <div className="bg-[#F8FAFC] rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
                  <span className="text-xs text-slate-400">hooks/wabek_otp.php — paste in WHMCS /includes/hooks/</span>
                  <button onClick={() => copy(`<?php
add_hook('ClientLogin', 1, function($vars) {
  $phone = $vars['client']['phonenumber'];
  $apiKey = 'YOUR_WABEK_API_KEY';
  $url = '${appUrl}/api/v1/otp';

  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_POST, 1);
  curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'phone'   => $phone,
    'purpose' => 'login',
  ]));
  curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-API-Key: ' . $apiKey,
  ]);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  $response = json_decode(curl_exec($ch), true);
  curl_close($ch);

  // Store OTP ID in session for verification step
  $_SESSION['wabek_otp_id'] = $response['otpId'] ?? '';
});`)} className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1">
                    <ClipboardIcon className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
                <pre className="px-4 py-3 text-xs text-slate-800 font-mono overflow-x-auto bg-white rounded-lg border border-slate-200">{`<?php
// WHMCS Hook: Send OTP on client login
add_hook('ClientLogin', 1, function($vars) {
  $phone  = $vars['client']['phonenumber'];
  $apiKey = '${user?.api_key || 'YOUR_WABEK_API_KEY'}';

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

// WHMCS Hook: Send OTP on invoice creation
add_hook('InvoiceCreated', 1, function($vars) {
  // Notify client via WHMCS webhook (handled automatically)
  $apiKey  = '${user?.api_key || 'YOUR_WABEK_API_KEY'}';
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
});`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* OTP Settings */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-3">⚙️ OTP Settings</h3>
          <div className="space-y-2 text-sm">
            {[
              { label: 'OTP Length', value: '6 digits' },
              { label: 'Expiry', value: `${process.env.NEXT_PUBLIC_OTP_EXPIRY || 10} minutes` },
              { label: 'One-time use', value: 'Yes — invalidated after first use' },
              { label: 'Storage', value: 'SHA-256 hashed in database' },
              { label: 'Delivery', value: 'Via connected WhatsApp instance' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                <span className="text-slate-400">{s.label}</span>
                <span className="text-slate-700 font-medium">{s.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Change expiry via <code className="bg-[#F8FAFC] px-1 rounded">OTP_EXPIRY_MINUTES</code> environment variable in Netlify
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
