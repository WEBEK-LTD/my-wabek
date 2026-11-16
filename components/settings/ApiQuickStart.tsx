import React, { useState } from 'react'
import { CodeBracketIcon } from '@heroicons/react/24/outline'
import { Badge, Card, CardHeader, Tabs } from '@/components/ui'
import { CodeBlock, CopyButton } from './Shared'

const LANGS = [
  { id: 'curl', label: 'cURL' },
  { id: 'js', label: 'JavaScript' },
  { id: 'php', label: 'PHP' },
  { id: 'python', label: 'Python' },
]

function samples(base: string, key: string) {
  const body = '{"to": "966500000000", "message": "Hello from WABEK"}'
  return {
    curl: `curl -X POST ${base}/api/v1/send \\
  -H "X-API-Key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`,
    js: `const res = await fetch('${base}/api/v1/send', {
  method: 'POST',
  headers: {
    'X-API-Key': '${key}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ to: '966500000000', message: 'Hello from WABEK' }),
})
const data = await res.json()`,
    php: `<?php
$ch = curl_init('${base}/api/v1/send');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'X-API-Key: ${key}',
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => json_encode(['to' => '966500000000', 'message' => 'Hello from WABEK']),
]);
$data = json_decode(curl_exec($ch), true);`,
    python: `import requests

res = requests.post(
    "${base}/api/v1/send",
    headers={"X-API-Key": "${key}"},
    json={"to": "966500000000", "message": "Hello from WABEK"},
)
data = res.json()`,
  } as Record<string, string>
}

export const API_ENDPOINTS = [
  { method: 'POST', path: '/api/v1/send', desc: 'إرسال رسالة واتساب', body: '{"to":"966500000000","message":"Hello!"}' },
  { method: 'GET', path: '/api/v1/contacts', desc: 'عرض جهات الاتصال', body: '' },
  { method: 'POST', path: '/api/v1/contacts', desc: 'إنشاء جهة اتصال أو تحديثها', body: '{"phone":"966500000000","name":"Sara"}' },
  { method: 'POST', path: '/api/v1/otp', desc: 'إرسال رمز تحقق عبر واتساب', body: '{"phone":"966500000000","purpose":"verification"}' },
  { method: 'POST', path: '/api/v1/otp-verify', desc: 'التحقق من الرمز', body: '{"otp_id":"uuid","otp":"123456"}' },
]

export function ApiQuickStart({ baseUrl, apiKey }: { baseUrl: string; apiKey: string }) {
  const [lang, setLang] = useState('curl')
  const code = samples(baseUrl, apiKey)
  return (
    <Card padding="none">
      <CardHeader icon={CodeBracketIcon} title="ابدأ خلال دقيقة" subtitle="أرسل مفتاحك في الترويسة X-API-Key مع كل طلب" divider />
      <div className="space-y-4 p-5 sm:p-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs variant="segmented" size="sm" idPrefix="qs" aria-label="لغة البرمجة" value={lang} onChange={setLang} tabs={LANGS} />
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
            <span>الرابط الأساسي</span>
            <code dir="ltr" className="truncate rounded-md bg-surface-2 px-2 py-1 font-mono text-ink">{baseUrl}</code>
            <CopyButton text={baseUrl} label="نسخ الرابط" />
          </div>
        </div>
        <CodeBlock code={code[lang]} label={`POST /api/v1/send · ${LANGS.find(l => l.id === lang)?.label}`} />
        <div className="overflow-hidden rounded-card border border-line">
          <ul className="divide-y divide-line-soft">
            {API_ENDPOINTS.map(ep => (
              <li key={ep.method + ep.path} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Badge tone={ep.method === 'GET' ? 'info' : 'violet'} size="sm" className="w-14 justify-center font-mono">{ep.method}</Badge>
                <code dir="ltr" className="font-mono text-[13px] text-ink">{ep.path}</code>
                <span className="text-sm text-muted">{ep.desc}</span>
                <span className="ms-auto">
                  <CopyButton
                    label="نسخ أمر cURL"
                    text={`curl -X ${ep.method} ${baseUrl}${ep.path} \\\n  -H "X-API-Key: ${apiKey}"${ep.body ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.body}'` : ''}`}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}
