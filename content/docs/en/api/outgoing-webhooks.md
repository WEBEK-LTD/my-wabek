---
title: "Outgoing webhooks"
description: "The notifications WABEK sends to your URL, their format, and how to secure your receiving endpoint."
section: api
order: 13
slug: api/outgoing-webhooks
---

# Outgoing webhooks

WABEK sends a `POST` request to an HTTPS URL you register when an event happens. URLs are managed under **Integrations → Webhooks → Outgoing Webhooks** in the dashboard.

## Events currently delivered

| Event | Sent when |
|---|---|
| `message_sent` | After a message is sent successfully through [`POST /api/webhooks/trigger`](/docs/api/trigger) |

> **Note:** The dashboard list shows other events (`message_received`, `contact_created`, `campaign_completed`, `chatbot_triggered`, `link_clicked`). They can be registered but are **not delivered** in this release. This reference will be updated when they are enabled.

## The request

```
POST <your target_url>
Content-Type: application/json
```

```json
{
  "to": "966500000000",
  "message": "Thanks for filling in our form!",
  "timestamp": "2026-11-16T10:00:00.000Z"
}
```

| Field | Type | Description |
|---|---|---|
| `to` | string | The number the message was sent to, as given in the Trigger request |
| `message` | string | Message text |
| `timestamp` | string (ISO 8601) | Send time |

## Delivery behavior

| Property | Value |
|---|---|
| Protocol | `https://` only, to a public address |
| Timeout | 5 seconds |
| Retries | None; each notification is sent once |
| Maximum | 20 URLs per event |
| Response size read | Up to 64 KB |

Return a `2xx` response quickly and do heavy processing later in the background.

## Verifying the source

> **Warning:** Notifications do not currently carry a signature header (HMAC). Any earlier document mentioning an `X-WABEK-Signature` header does not apply to this release.

To secure your endpoint:

1. Add a long random secret token to the URL when you register it, for example:

   ```
   https://example.com/hooks/wabek?token=9f3c...e71a
   ```

2. In your endpoint, reject any request without the correct token, using a constant-time comparison.
3. Check that the JSON body contains the expected fields.
4. Do not perform sensitive actions (such as payments) based on the notification alone.

```javascript
// Express example
import crypto from "node:crypto";
import express from "express";

const app = express();
app.use(express.json());

app.post("/hooks/wabek", (req, res) => {
  const expected = Buffer.from(process.env.WABEK_HOOK_TOKEN);
  const given = Buffer.from(String(req.query.token || ""));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.sendStatus(401);
  }
  const { to, message, timestamp } = req.body || {};
  if (typeof to !== "string" || typeof message !== "string") return res.sendStatus(400);
  res.sendStatus(204);
  // Process asynchronously after responding.
  console.log("WABEK message_sent", to, timestamp);
});

app.listen(3000);
```

```php
<?php
$expected = getenv('WABEK_HOOK_TOKEN');
$given    = $_GET['token'] ?? '';
if (!is_string($given) || !hash_equals($expected, $given)) {
    http_response_code(401);
    exit;
}
$event = json_decode(file_get_contents('php://input'), true);
if (!is_array($event) || !isset($event['to'], $event['message'])) {
    http_response_code(400);
    exit;
}
http_response_code(204);
error_log('WABEK message_sent to ' . $event['to']);
```

```python
import hmac
import os
from flask import Flask, abort, request

app = Flask(__name__)

@app.post("/hooks/wabek")
def wabek_hook():
    given = request.args.get("token", "")
    if not hmac.compare_digest(given, os.environ["WABEK_HOOK_TOKEN"]):
        abort(401)
    event = request.get_json(silent=True) or {}
    if not isinstance(event.get("to"), str) or not isinstance(event.get("message"), str):
        abort(400)
    print("WABEK message_sent", event["to"], event.get("timestamp"))
    return "", 204
```

## Testing your URL

Send a test message through [Trigger](/docs/api/trigger) and check that the notification reaches your endpoint:

```bash
curl -X POST https://waabek.com/api/webhooks/trigger \
  -H "X-API-Key: $WABEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "to": "966500000000", "message": "Webhook test" }'
```
