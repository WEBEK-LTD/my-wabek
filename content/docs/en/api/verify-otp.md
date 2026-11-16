---
title: "Verify a code"
description: "POST /api/v1/otp-verify — check a code the user entered against an otpId."
section: api
order: 8
slug: api/verify-otp
---

# Verify a code

```
POST /api/v1/otp-verify
```

Checks a code the user entered against the `otpId` you received from [Send a verification code](/docs/api/send-otp).

> **Note:** The path is `/api/v1/otp-verify` with a hyphen, not `/api/v1/otp/verify`.

## Headers

| Header | Value |
|---|---|
| `X-API-Key` | Your key (or `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` |

## Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `otp_id` | string | Yes | The `otpId` value from the send response |
| `otp` | string | Yes | The code the user entered |

Only codes issued for your own account can be verified.

## Response

Status `200` is returned for every verification outcome. Rely on the `valid` field.

Correct code:

```json
{ "valid": true }
```

Incorrect code:

```json
{ "valid": false, "reason": "Invalid OTP" }
```

| `reason` | Meaning |
|---|---|
| `OTP not found` | The ID does not exist or does not belong to your account |
| `Invalid OTP` | Wrong code (counts as an attempt) |
| `OTP expired` | The code has expired |
| `OTP already used` | The code was already used |
| `Too many attempts` | More than 5 wrong attempts; the code was invalidated |

After one successful verification, the code is used and cannot be verified again.

## Errors

| Status | `error` |
|---|---|
| `400` | `otp_id and otp required` |
| `401` | `Invalid API key` |
| `429` | `Too many requests` |

## Examples

```bash
curl -X POST https://waabek.com/api/v1/otp-verify \
  -H "X-API-Key: $WABEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "otp_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7", "otp": "482913" }'
```

```javascript
const res = await fetch("https://waabek.com/api/v1/otp-verify", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.WABEK_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ otp_id: otpId, otp: userInput }),
});
const { valid, reason } = await res.json();
if (!valid) console.warn("OTP rejected:", reason);
```

```php
<?php
$ch = curl_init('https://waabek.com/api/v1/otp-verify');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ' . getenv('WABEK_API_KEY'),
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS     => json_encode([
        'otp_id' => $_SESSION['otp_id'],
        'otp'    => $_POST['otp'],
    ]),
]);
$result = json_decode(curl_exec($ch), true);
curl_close($ch);

if (!empty($result['valid'])) {
    // Code accepted: sign the user in.
}
```

```python
import os
import requests

resp = requests.post(
    "https://waabek.com/api/v1/otp-verify",
    headers={"X-API-Key": os.environ["WABEK_API_KEY"]},
    json={"otp_id": otp_id, "otp": user_input},
    timeout=30,
)
result = resp.json()
if result.get("valid"):
    print("Verified")
else:
    print("Rejected:", result.get("reason"))
```
