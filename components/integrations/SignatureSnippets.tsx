import React, { useState } from 'react'
import { ShieldCheckIcon, BookOpenIcon } from '@heroicons/react/24/outline'
import { Button, Card, CardHeader, Tabs } from '@/components/ui'
import { CodeBlock } from '@/components/campaigns/copy'
import { rich } from '@/components/campaigns/rich'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/integrations'

// Signing (lib/outgoing-webhooks.ts → signWebhookBody):
//   X-WABEK-Signature: sha256=hex(HMAC_SHA256(secret, `${X-WABEK-Timestamp}.${raw body}`))
const SNIPPETS: Record<string, { label: string; file: string; code: string }> = {
  js: {
    label: 'JavaScript',
    file: 'Node.js / Express',
    code: `import crypto from "node:crypto";
import express from "express";

const app = express();

app.post("/hooks/wabek", express.raw({ type: "application/json" }), (req, res) => {
  const ts = req.get("X-WABEK-Timestamp") || "";
  const sig = req.get("X-WABEK-Signature") || "";
  const expected = "sha256=" + crypto
    .createHmac("sha256", process.env.WABEK_WEBHOOK_SECRET)
    .update(\`\${ts}.\${req.body}\`)
    .digest("hex");
  const ok = sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return res.sendStatus(401);

  const event = JSON.parse(req.body.toString("utf8"));
  res.sendStatus(204);               // answer fast, process afterwards
  console.log(event.event, event.data);
});

app.listen(3000);`,
  },
  php: {
    label: 'PHP',
    file: 'PHP',
    code: `<?php
$raw    = file_get_contents('php://input');
$ts     = $_SERVER['HTTP_X_WABEK_TIMESTAMP'] ?? '';
$sig    = $_SERVER['HTTP_X_WABEK_SIGNATURE'] ?? '';
$secret = getenv('WABEK_WEBHOOK_SECRET');

$expected = 'sha256=' . hash_hmac('sha256', $ts . '.' . $raw, $secret);
if (!hash_equals($expected, $sig) || abs(time() - (int) $ts) > 300) {
    http_response_code(401);
    exit;
}
$event = json_decode($raw, true);
http_response_code(204);
error_log('WABEK ' . $event['event']);`,
  },
  python: {
    label: 'Python',
    file: 'Python / Flask',
    code: `import hashlib, hmac, json, os, time
from flask import Flask, abort, request

app = Flask(__name__)

@app.post("/hooks/wabek")
def wabek_hook():
    raw = request.get_data()                       # raw bytes
    ts = request.headers.get("X-WABEK-Timestamp", "")
    sig = request.headers.get("X-WABEK-Signature", "")
    mac = hmac.new(os.environ["WABEK_WEBHOOK_SECRET"].encode(), f"{ts}.".encode() + raw, hashlib.sha256)
    if not hmac.compare_digest("sha256=" + mac.hexdigest(), sig) or abs(time.time() - int(ts or 0)) > 300:
        abort(401)
    event = json.loads(raw)
    print(event["event"], event["data"])
    return "", 204`,
  },
}

const HEADERS = `POST <your URL>
Content-Type: application/json
User-Agent: WABEK-Webhooks/1.0
X-WABEK-Event: message_received
X-WABEK-Delivery: 5d1c0c3e-8f0a-4d5e-9b62-0f6f3b1e9a11
X-WABEK-Timestamp: 1735732800
X-WABEK-Signature: sha256=<hex>

{
  "event": "message_received",
  "created_at": "2025-01-01T12:00:00.000Z",
  "data": {
    "message_id": "wamid.HBgM...",
    "from": "201234567890",
    "name": "Contact Name",
    "message": "Hello!",
    "type": "text",
    "contact_id": "uuid",
    "instance_id": "uuid"
  }
}`

export const OUTGOING_WEBHOOKS_DOC = '/docs/api/outgoing-webhooks'

export function SignatureSnippets() {
  const { t } = useT(messages)
  const [lang, setLang] = useState('js')
  const s = SNIPPETS[lang]
  return (
    <Card padding="none">
      <CardHeader className="px-5 pt-5 sm:px-6" icon={ShieldCheckIcon} title={t('sig_title')}
        subtitle={t('sig_sub')}
        action={<Button size="sm" variant="ghost" icon={BookOpenIcon} href={OUTGOING_WEBHOOKS_DOC}>{t('docs')}</Button>} />
      <div className="space-y-4 p-5 sm:p-6">
        <div className="rounded-card border border-line-soft bg-surface-2 p-4 text-sm leading-relaxed text-body">
          <p>
            {rich(t('sig_intro'), { header: <code dir="ltr" className="font-mono text-[12.5px] text-ink">X-WABEK-Signature: sha256=&lt;hex&gt;</code> })}
          </p>
          <p dir="ltr" className="mt-2 rounded-lg bg-surface px-3 py-2 text-start font-mono text-[12.5px] text-ink">X-WABEK-Timestamp + &quot;.&quot; + raw_body</p>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-[13px] text-muted">
            <li>{t('sig_li1')}</li>
            <li>{rich(t('sig_li2'), { ts: <code dir="ltr" className="font-mono">X-WABEK-Timestamp</code> })}</li>
            <li>{rich(t('sig_li3'), { delivery: <code dir="ltr" className="font-mono">X-WABEK-Delivery</code> })}</li>
          </ul>
        </div>
        <Tabs variant="segmented" size="sm" value={lang} onChange={setLang} idPrefix="sig" aria-label={t('sig_lang_aria')}
          tabs={Object.entries(SNIPPETS).map(([id, v]) => ({ id, label: v.label }))} />
        <CodeBlock label={s.file} code={s.code} />
        <details className="group rounded-card border border-line-soft">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink marker:hidden">
            {t('sig_example')}
          </summary>
          <div className="px-3 pb-3"><CodeBlock label="HTTP" code={HEADERS} /></div>
        </details>
      </div>
    </Card>
  )
}
