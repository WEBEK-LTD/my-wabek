---
title: "Wix Automations"
description: "POST /api/webhooks/wix — receive HTTP requests from Wix Automations and send a WhatsApp notification per event."
section: api
order: 12
slug: api/wix-automations
---

# Wix Automations

```
POST /api/webhooks/wix
```

The endpoint you paste into the **Send HTTP request** action in Wix Automations. It builds a message for the event and sends it to the customer.

> **Note:** This is not the endpoint of the WABEK app on the Wix App Market; the app is set up automatically and does not need it. See [Wix integration](/docs/integrations/wix).

## Headers

| Header | Value |
|---|---|
| `X-API-Key` | Your key (or `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` |

## Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `event` | string | Yes | Event name (`type` is accepted as an alias) |
| `customer_phone` | string | Yes | Customer number. Aliases: `phone`, `billing_phone`, `buyerPhone`. Non-digits and leading zeros are removed. |
| `customer_name` | string | No | Customer name (or `name`). Default `Customer` |
| `order_id` | string | No | Order number (or `orderId`) |
| `total` | string | No | Total (or `amount`) |
| `tracking_number` | string | No | Tracking number (or `trackingNumber`) |
| `cart_url` | string | No | Cart link for abandoned carts |
| `site_name` | string | No | Site name |

### Supported events

`order_placed`, `order_paid`, `order_shipped`, `order_delivered`, `order_cancelled`, `order_refunded`, `abandoned_cart`, `new_member`, `form_submitted`.

If you saved custom text for the event on the **Wix → Messages** page, it is used, with these variables replaced: `{{customer_name}}`, `{{first_name}}`, `{{order_id}}`, `{{total}}`, `{{tracking_number}}`, `{{cart_url}}`, `{{site_name}}`. Otherwise a default English text is used.

## Response

Successful send:

```json
{
  "success": true,
  "event": "order_placed",
  "phone": "966500000000",
  "wa_message_id": "wamid.HBgMOTY2NTAwMDAwMDAwFQIAERgSQzE2..."
}
```

Request accepted without sending (`200`):

```json
{ "success": true, "skipped": "no phone number in payload" }
```

```json
{ "success": true, "skipped": "event \"order_updated\" not recognized" }
```

## Errors

| Status | `error` |
|---|---|
| `400` | `event field required. Add a key "event" with value e.g. "order_placed"` |
| `401` | `Invalid or missing API key` |
| `403` | `Failed to send` with `code` (`plan_limit`, `opted_out` or `blocked`) |
| `404` | `No connected WhatsApp instance found` |
| `405` | `Method not allowed` |
| `502` | `Failed to send` |

## Examples

```bash
curl -X POST https://waabek.com/api/webhooks/wix \
  -H "X-API-Key: $WABEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "order_placed",
    "customer_phone": "966500000000",
    "customer_name": "Sara Ahmed",
    "order_id": "1042",
    "total": "250 SAR"
  }'
```

```javascript
await fetch("https://waabek.com/api/webhooks/wix", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.WABEK_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    event: "order_placed",
    customer_phone: "966500000000",
    customer_name: "Sara Ahmed",
    order_id: "1042",
    total: "250 SAR",
  }),
});
```

```php
<?php
$ch = curl_init('https://waabek.com/api/webhooks/wix');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ' . getenv('WABEK_API_KEY'),
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS     => json_encode([
        'event'          => 'order_placed',
        'customer_phone' => '966500000000',
        'customer_name'  => 'Sara Ahmed',
        'order_id'       => '1042',
        'total'          => '250 SAR',
    ]),
]);
echo curl_exec($ch);
curl_close($ch);
```

```python
import os
import requests

resp = requests.post(
    "https://waabek.com/api/webhooks/wix",
    headers={"X-API-Key": os.environ["WABEK_API_KEY"]},
    json={
        "event": "order_placed",
        "customer_phone": "966500000000",
        "customer_name": "Sara Ahmed",
        "order_id": "1042",
        "total": "250 SAR",
    },
    timeout=30,
)
print(resp.json())
```
