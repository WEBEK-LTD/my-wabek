---
title: "Send a verification code"
description: "POST /api/v1/otp — generate a 6-digit verification code and send it to a WhatsApp number."
section: api
order: 7
slug: api/send-otp
---

# Send a verification code

```
POST /api/v1/otp
```

WABEK generates a random **6-digit** code, stores it hashed, and sends it to the recipient over WhatsApp. You get an `otpId` to use later in [Verify a code](/docs/api/verify-otp).

## Headers

| Header | Value |
|---|---|
| `X-API-Key` | Your key (or `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` |

## Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `phone` | string | Yes | Recipient number in international format (digits only). `to` is accepted as an alias. |
| `purpose` | string | No | `verification` (default), `login` or `transaction` |

## Code properties

| Property | Value |
|---|---|
| Length | 6 digits |
| Validity | 10 minutes by default (may vary with platform settings) |
| Use | Single use |
| Attempts | At most 5 wrong attempts, then the code is invalidated |
| Storage | SHA-256 hash; the code itself is never stored |

## Sending number

- If the platform has a dedicated verification-code number configured, the code is sent from it.
- Otherwise it is sent from one of your connected numbers, preferring WhatsApp Web numbers.
- On Cloud API numbers the code is sent through an approved **Authentication** template. See [The verification-code template](/docs/getting-started/messaging-window).

> **Note:** The text of the code message is fixed and cannot be customized from this endpoint. If you want your own branded text, generate the code yourself and send it with [Send a message](/docs/api/send-message) using the `code` field.

## Response

`200 OK`

```json
{
  "success": true,
  "otpId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

> **Note:** The response field is named `otpId`; the verify endpoint accepts it as `otp_id` or `otpId`.

## Errors

| Status | Response | Cause |
|---|---|---|
| `400` | `{"error": "phone required"}` | Missing number |
| `401` | `{"error": "Invalid API key"}` | Invalid key |
| `403` | `{"success": false, "error": "Recipient has opted out", "code": "opted_out"}` | The recipient opted out or is blocked in your account (also `plan_no_api` / `permission_denied`) |
| `429` | `{"error": "Too many requests", ...}` + `Retry-After` | Request limit exceeded |
| `500` | Internal error | No connected number, or every Authentication template attempt failed |

## Examples

```bash
curl -X POST https://waabek.com/api/v1/otp \
  -H "X-API-Key: $WABEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "phone": "966500000000", "purpose": "login" }'
```

```javascript
const res = await fetch("https://waabek.com/api/v1/otp", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.WABEK_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ phone: "966500000000", purpose: "login" }),
});
if (!res.ok) throw new Error(`OTP send failed: ${res.status}`);
const { otpId } = await res.json();
// Store otpId in the user's server-side session, not in the browser.
```

```php
<?php
$ch = curl_init('https://waabek.com/api/v1/otp');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ' . getenv('WABEK_API_KEY'),
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS     => json_encode([
        'phone'   => '966500000000',
        'purpose' => 'login',
    ]),
]);
$body   = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($status === 200) {
    $_SESSION['otp_id'] = json_decode($body, true)['otpId'];
}
```

```python
import os
import requests

resp = requests.post(
    "https://waabek.com/api/v1/otp",
    headers={"X-API-Key": os.environ["WABEK_API_KEY"]},
    json={"phone": "966500000000", "purpose": "login"},
    timeout=30,
)
resp.raise_for_status()
otp_id = resp.json()["otpId"]
```

## Best practices

- Keep `otpId` in the user's session on your server; do not send it to the browser unless you need to.
- On your server, limit code requests per number and per user (for example one request per minute) to prevent abuse and protect your quota.
