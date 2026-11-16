---
title: "Trigger (for automation tools)"
description: "POST /api/webhooks/trigger — send a message from Zapier, Make or any automation tool, and fire the message_sent webhook."
section: api
order: 11
slug: api/trigger
---

# Trigger (for automation tools)

```
POST /api/webhooks/trigger
```

A send endpoint for automation tools such as Zapier and Make. After a successful send, the [outgoing webhooks](/docs/api/outgoing-webhooks) registered for `message_sent` are fired.

## Headers

| Header | Value |
|---|---|
| `X-API-Key` | Your key. **This endpoint does not accept** `Authorization: Bearer` or the key in the URL. |
| `Content-Type` | `application/json` |

## Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `to` | string | Yes | Recipient number in international format |
| `message` | string | Yes | Message text |
| `instance_id` | string | No | ID of the sending number. Default: the first connected number |

> **Warning:** On Cloud API numbers, if the recipient is outside the 24-hour window, nothing is sent and the request returns `422` with code `outside_window` (WABEK never sends a different template in place of your text). Use [Send a message](/docs/api/send-message) with `template` for those recipients. See [24-hour window](/docs/getting-started/messaging-window).

The key needs the `send` permission (otherwise `403` `permission_denied`).

## Response

`200 OK`

```json
{
  "success": true,
  "message_id": "wamid.HBgMOTY2NTAwMDAwMDAwFQIAERgSQzE2..."
}
```

## Errors

| Status | `error` | Cause |
|---|---|---|
| `400` | `to and message required` | Missing field |
| `401` | `API key required` | Missing `X-API-Key` header |
| `401` | `Invalid API key` | Invalid key |
| `403` | The blocking reason | Plan limit, opt-out or block |
| `404` | `No connected WhatsApp instance` | No connected number |
| `405` | `Method not allowed` | Method is not POST |
| `502` | The failure reason | The WhatsApp provider rejected the message |

## Examples

```bash
curl -X POST https://waabek.com/api/webhooks/trigger \
  -H "X-API-Key: $WABEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "to": "966500000000", "message": "Thanks for filling in our form!" }'
```

```javascript
const res = await fetch("https://waabek.com/api/webhooks/trigger", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.WABEK_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: "966500000000",
    message: "Thanks for filling in our form!",
  }),
});
console.log(res.status, await res.json());
```

```php
<?php
$ch = curl_init('https://waabek.com/api/webhooks/trigger');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ' . getenv('WABEK_API_KEY'),
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS     => json_encode([
        'to'      => '966500000000',
        'message' => 'Thanks for filling in our form!',
    ]),
]);
echo curl_exec($ch);
curl_close($ch);
```

```python
import os
import requests

resp = requests.post(
    "https://waabek.com/api/webhooks/trigger",
    headers={"X-API-Key": os.environ["WABEK_API_KEY"]},
    json={"to": "966500000000", "message": "Thanks for filling in our form!"},
    timeout=30,
)
print(resp.status_code, resp.json())
```
