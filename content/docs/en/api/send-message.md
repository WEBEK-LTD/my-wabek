---
title: "Send a message"
description: "POST /api/v1/send — send a text message, a verification code or an approved template to a WhatsApp number."
section: api
order: 4
slug: api/send-message
---

# Send a message

```
POST /api/v1/send
```

Sends a message from one of your numbers. WABEK picks the sending method automatically based on the number type and the 24-hour window.

## Headers

| Header | Value |
|---|---|
| `X-API-Key` | Your key (or `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` |

## Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `to` | string | Yes | Recipient number in international format, digits only with country code (for example `966500000000`). `phone` is accepted as an alias. |
| `message` | string | Yes | Message text. |
| `instance_id` | string | No | ID of the sending number. If omitted, the oldest connected number on your account is used. |
| `template` | string | No | Name of an approved template used if the recipient is outside the 24-hour window (Cloud API). |
| `template_params` | object | No | Named template parameters, for example `{"customer_name": "Sara"}`. Used with `template`. |
| `customer_name` | string | No | Customer name for the default template outside the window. Defaults to `Customer`. |
| `code` | string or number | No | A 4–8 digit verification code. When present, the message is sent through an Authentication template. |
| `type` | string | No | `otp` means `message` contains a verification code to extract. |

> **Note:** If you have no connected number, WABEK tries the oldest number on your account whatever its status, and the request usually fails. Make sure the number is connected, or pass the `instance_id` of a connected number.

## How the sending method is chosen

| Number type | Case | What happens |
|---|---|---|
| WhatsApp Web | Always | `message` is sent as text |
| Cloud API | With `code` or `type: "otp"` | The code is sent through an Authentication template; if that fails and the customer is inside the window, the text is sent |
| Cloud API | Inside the 24-hour window | `message` is sent as text |
| Cloud API | Outside the window and `message` contains a 4–8 digit number | Treated as a verification code and sent through an Authentication template |
| Cloud API | Outside the window with `template` | The given template is sent with `template_params` |
| Cloud API | Outside the window without `template` | The platform's default marketing template is sent, with the customer name in `customer_name` and the `message` text in `offer_details` |

Templates are tried in languages `en`, then `en_US`. See [24-hour window and templates](/docs/getting-started/messaging-window).

> **Warning:** Before every send, WABEK checks the monthly message limit and that the recipient is not blocked or opted out. If sending is not allowed, status `403` is returned and the message is not sent.

## Response

`200 OK`

```json
{
  "success": true,
  "message_id": "wamid.HBgMOTY2NTAwMDAwMDAwFQIAERgSQzE2..."
}
```

| Field | Type | Description |
|---|---|---|
| `success` | boolean | `true` when the message was accepted for sending |
| `message_id` | string or null | WhatsApp's message ID (may be `null` for some WhatsApp Web messages) |

The message is saved in the inbox as an outbound message.

## Errors

| Status | Example | Cause |
|---|---|---|
| `400` | `{"error": "to and message required"}` | Missing field |
| `401` | `{"error": "Invalid API key"}` | Invalid key |
| `403` | `{"error": "Recipient has opted out", "code": "opted_out"}` | Plan limit, opt-out or block |
| `404` | `{"error": "No connected WhatsApp instance"}` | No number on the account |
| `422` | See below | Outside the window and every template attempt failed |
| `429` | `{"error": "Too many requests", "retryAfter": 42}` | Request limit exceeded |
| `502` | `{"error": "Failed to send message", "detail": "..."}` | The WhatsApp provider rejected the message |

`422` example:

```json
{
  "error": "Recipient is outside the 24-hour messaging window",
  "detail": "Plain text cannot be delivered outside the 24h window. Tried sending via the \"order_update\" template ...",
  "attempts": [
    {
      "language": "en",
      "components": "named params (explicit)",
      "ok": false,
      "status": 404,
      "error": "(#132001) Template name does not exist in the translation"
    }
  ]
}
```

## Examples

### Text message

```bash
curl -X POST https://waabek.com/api/v1/send \
  -H "X-API-Key: $WABEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "966500000000",
    "message": "Your order #1042 has shipped."
  }'
```

```javascript
// Server-side only (Node.js 18+). Never put your API key in browser code.
const res = await fetch("https://waabek.com/api/v1/send", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.WABEK_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: "966500000000",
    message: "Your order #1042 has shipped.",
  }),
});
const data = await res.json();
if (!res.ok) {
  console.error(res.status, data.error, data.code, data.detail);
} else {
  console.log("Sent:", data.message_id);
}
```

```php
<?php
$ch = curl_init('https://waabek.com/api/v1/send');
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
        'message' => 'Your order #1042 has shipped.',
    ]),
]);
$body   = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($body, true);
if ($status !== 200) {
    error_log("WABEK error $status: " . ($data['error'] ?? $body));
} else {
    echo $data['message_id'];
}
```

```python
import os
import requests

resp = requests.post(
    "https://waabek.com/api/v1/send",
    headers={"X-API-Key": os.environ["WABEK_API_KEY"]},
    json={
        "to": "966500000000",
        "message": "Your order #1042 has shipped.",
    },
    timeout=30,
)
data = resp.json()
if resp.ok:
    print("Sent:", data["message_id"])
else:
    print(resp.status_code, data.get("error"), data.get("code"), data.get("detail"))
```

### With a fallback template outside the window

If the customer is inside the window, `message` is sent as text; otherwise the `order_update` template is sent. The template must be approved on the WhatsApp Business Account linked to the number, the `template_params` keys must match the variable names in its body, and its language must be `en` or `en_US`.

```bash
curl -X POST https://waabek.com/api/v1/send \
  -H "X-API-Key: $WABEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "966500000000",
    "message": "Hi Sara, your order #1042 has shipped.",
    "instance_id": "3f1c2a7e-0000-4000-8000-000000000000",
    "template": "order_update",
    "template_params": { "customer_name": "Sara", "order_id": "1042" }
  }'
```

### Verification code

```bash
curl -X POST https://waabek.com/api/v1/send \
  -H "X-API-Key: $WABEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "966500000000",
    "message": "Your verification code is 482913",
    "code": "482913"
  }'
```

> **Note:** If you want WABEK to generate and verify the code for you, use [Send a verification code](/docs/api/send-otp) instead.
