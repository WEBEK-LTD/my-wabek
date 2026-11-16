---
title: "Message gateway"
description: "GET/POST /api/gateway/whatsapp — a simple send gateway compatible with plugins such as Digits for WordPress."
section: api
order: 10
slug: api/gateway
---

# Message gateway

```
POST /api/gateway/whatsapp
GET  /api/gateway/whatsapp
```

A simple send gateway built for plugins that offer a "custom SMS/WhatsApp gateway", such as the Digits phone-login plugin for WordPress. It accepts several field names to stay compatible with these plugins.

## Headers

| Header | Value |
|---|---|
| `X-API-Key` | Your key (or `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` or `application/x-www-form-urlencoded` (for POST) |

## Parameters

With `GET`, parameters are read from the URL only. With `POST`, they are read from both the body and the URL.

| Parameter | Aliases | Required | Description |
|---|---|---|---|
| `to` | `phone`, `mobile` | Yes | Recipient number. Non-digit characters are removed. |
| `message` | `text`, `msg` | Yes | Message text |
| `instance_id` | `sender_id`, `sender` | No | ID of the sending number. Default: the first connected number |

> **Warning:** On Cloud API numbers, if the recipient is outside the 24-hour window, your text is not sent; the platform's default notification template is sent instead. For sign-in codes on the Cloud API, use [Send a message](/docs/api/send-message) with `code`, or [Send a verification code](/docs/api/send-otp); both use an Authentication template.

## Response

`200 OK`

```json
{
  "success": true,
  "status": "sent",
  "message_id": "wamid.HBgMOTY2NTAwMDAwMDAwFQIAERgSQzE2...",
  "to": "966500000000",
  "data": { "message_id": "wamid.HBgMOTY2NTAwMDAwMDAwFQIAERgSQzE2..." }
}
```

## Errors

| Status | `code` | `error` |
|---|---|---|
| `400` | `MISSING_TO` | `Phone number required (to)` |
| `400` | `MISSING_MESSAGE` | `Message required (message)` |
| `401` | `UNAUTHORIZED` | `Invalid API key` |
| `403` | `PLAN_LIMIT` / `OPTED_OUT` / `BLOCKED` | The blocking reason |
| `404` | `NO_INSTANCE` | `No connected WhatsApp instance found` |
| `502` | `SEND_FAILED` | The failure reason |

## Digits setup

| Digits setting | Value |
|---|---|
| Gateway URL | `https://waabek.com/api/gateway/whatsapp` |
| HTTP Method | `POST` |
| Headers | `X-API-Key:YOUR_KEY` |
| Parameters | `to:{to}` and `message:{message}` |

## Examples

```bash
curl -X POST https://waabek.com/api/gateway/whatsapp \
  -H "X-API-Key: $WABEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "to": "+966 50 000 0000", "message": "Welcome to our store!" }'
```

```javascript
const res = await fetch("https://waabek.com/api/gateway/whatsapp", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.WABEK_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ to: "966500000000", message: "Welcome to our store!" }),
});
const data = await res.json();
console.log(res.status, data.code || data.status);
```

```php
<?php
$ch = curl_init('https://waabek.com/api/gateway/whatsapp');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => ['X-API-Key: ' . getenv('WABEK_API_KEY')],
    CURLOPT_POSTFIELDS     => http_build_query([
        'to'      => '966500000000',
        'message' => 'Welcome to our store!',
    ]),
]);
$data = json_decode(curl_exec($ch), true);
curl_close($ch);

echo $data['status'] ?? $data['code'];
```

```python
import os
import requests

resp = requests.post(
    "https://waabek.com/api/gateway/whatsapp",
    headers={"X-API-Key": os.environ["WABEK_API_KEY"]},
    data={"to": "966500000000", "message": "Welcome to our store!"},
    timeout=30,
)
print(resp.status_code, resp.json())
```

## Key in the URL (deprecated)

The gateway still accepts `?api_key=` or `?key=` in the URL, or `api_key` in the body, for compatibility with older Digits setups. Move the setting to the `X-API-Key` header; this method may be disabled later.
