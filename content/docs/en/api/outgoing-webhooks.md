---
title: "Outgoing webhooks"
description: "The events WABEK sends to your URL, their format, the signature header and how to verify it."
section: api
order: 13
slug: api/outgoing-webhooks
---

# Outgoing webhooks

WABEK sends a signed `POST` request to an HTTPS URL you register when an event happens in your account. URLs are managed under **Integrations → Webhooks → Outgoing Webhooks** in the dashboard; each URL subscribes to one event.

## Events

| Event | Sent when |
|---|---|
| `message_received` | A contact sends you a message (Cloud API or WhatsApp Web number) |
| `message_sent` | Any outbound message is sent: API, inbox, campaigns, chatbot, automations, AI (one-time codes are never included) |
| `message_status` | An outbound message becomes `delivered`, `read` or `failed` |
| `contact_created` | A new contact is created (dashboard, API, or the first message from an unknown number) |
| `campaign_completed` | A campaign has finished sending |
| `opt_out` | A contact unsubscribes (`STOP` keyword, dashboard toggle or API) |
| `opt_in` | A contact re-subscribes (`START` keyword, dashboard toggle or API) |
| `chatbot_triggered` | A chatbot flow starts for a contact |
| `link_clicked` | A tracked short link is opened |

## The request

```
POST <your target_url>
Content-Type: application/json
User-Agent: WABEK-Webhooks/1.0
X-WABEK-Event: message_received
X-WABEK-Delivery: 5d1c0c3e-8f0a-4d5e-9b62-0f6f3b1e9a11
X-WABEK-Timestamp: 1763287200
X-WABEK-Signature: sha256=3f6c…e91b
```

Every body has the same envelope:

```json
{
  "event": "message_received",
  "created_at": "2026-11-16T10:00:00.000Z",
  "data": {
    "message_id": "wamid.HBgMOTY2NTAwMDAwMDAwFQIAEhggQ0Y…",
    "id": "8b0e4c4a-1f7e-4d0c-9c1e-2a7f7d1f3c55",
    "from": "966500000000",
    "name": "Sara",
    "message": "Hello!",
    "type": "text",
    "media_url": null,
    "contact_id": "2f1a…",
    "instance_id": "a71c…",
    "provider": "cloud_api"
  }
}
```

| Field | Description |
|---|---|
| `event` | The event name (also in `X-WABEK-Event`) |
| `created_at` | When the event happened (ISO 8601) |
| `data` | Event fields (below) |

### `data` per event

| Event | Fields |
|---|---|
| `message_received` | `message_id`, `id`, `from`, `name`, `message`, `type`, `media_url`, `contact_id`, `instance_id`, `provider` (`cloud_api` / `wa_web`) |
| `message_sent` | `message_id`, `id`, `to`, `message`, `type`, `method` (`text` / `template` / `wa_web` / `media`), `source` (`api`, `campaign`, `chatbot`, `automation`, `live_chat`, …), `template`, `contact_id`, `campaign_id`, `instance_id` |
| `message_status` | `message_id`, `id`, `status` (`delivered` / `read` / `failed`), `to`, `contact_id`, `campaign_id`, `instance_id`, `error` (`{code, message}`, failed only) |
| `contact_created` | `contact_id`, `phone`, `name`, `email`, `tags`, `source` (`dashboard` / `api` / `inbound_message`) |
| `campaign_completed` | `campaign_id`, `name`, `status`, `total`, `sent`, `failed`, `completed_at` |
| `opt_out` / `opt_in` | `phone`, `contact_id`, `opted_out`, `source` (`keyword` / `dashboard` / `api`), `instance_id` |
| `chatbot_triggered` | `flow_id`, `flow_name`, `trigger_type`, `from`, `message`, `instance_id` |
| `link_clicked` | `link_id`, `short_code`, `url`, `clicked_at` |

A test delivery (the **Test** button) has the same headers and envelope with `"test": true`.

## Verifying the signature

Each subscription has its own secret (`whsec_…`). It is shown **once** when you create the webhook; use **🔑 Secret** on the Integrations page to generate a new one (the old one stops working immediately). Webhooks created before signing existed have a secret too — rotate it to see it.

The signature is an HMAC-SHA256, in hex, of the timestamp, a dot, and the **raw** request body:

```
X-WABEK-Signature: sha256=hex( HMAC_SHA256(secret, X-WABEK-Timestamp + "." + raw_body) )
```

1. Read the raw body before parsing JSON.
2. Recompute the signature and compare it in constant time.
3. Reject requests whose `X-WABEK-Timestamp` is more than 5 minutes from your clock (replay protection).
4. Use `X-WABEK-Delivery` to ignore a delivery you already processed (retries reuse the same id).

```javascript
// Node.js / Express
import crypto from "node:crypto";
import express from "express";

const app = express();

app.post("/hooks/wabek", express.raw({ type: "application/json" }), (req, res) => {
  const ts = req.get("X-WABEK-Timestamp") || "";
  const sig = req.get("X-WABEK-Signature") || "";
  const expected = "sha256=" + crypto
    .createHmac("sha256", process.env.WABEK_WEBHOOK_SECRET)
    .update(`${ts}.${req.body}`)
    .digest("hex");
  const ok = sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return res.sendStatus(401);

  const event = JSON.parse(req.body.toString("utf8"));
  res.sendStatus(204);               // answer fast, process afterwards
  console.log(event.event, event.data);
});

app.listen(3000);
```

```php
<?php
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
error_log('WABEK ' . $event['event']);
```

```python
import hashlib, hmac, json, os, time
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
    return "", 204
```

## Delivery behavior

| Property | Value |
|---|---|
| Protocol | `https://` only, to a public address (checked on every delivery and redirect) |
| Timeout | 5 seconds |
| Success | Any `2xx` response |
| Retries | A failed delivery is retried with backoff — about 1, 5, 15, 60 and 180 minutes — up to 6 attempts in total, with the same `X-WABEK-Delivery` id |
| Maximum | 20 URLs per event |
| Response size read | Up to 64 KB |

Return a `2xx` response quickly and do heavy processing in the background. Deliveries can arrive more than once or out of order; make your handler idempotent.

## Testing your URL

Click **🧪 Test** next to the webhook: WABEK sends a signed test payload from its servers and shows whether your URL answered `2xx`. The same is available from the API used by the dashboard:

```bash
# session cookie / dashboard token required
curl -X POST https://waabek.com/api/webhooks/zapier \
  -H "Authorization: Bearer $WABEK_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "action": "test", "id": "<webhook id>" }'
```
