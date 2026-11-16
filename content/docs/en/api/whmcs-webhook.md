---
title: "WHMCS webhook (legacy)"
description: "POST /api/v1/whmcs-webhook — the legacy WHMCS event receiver. Use the new WHMCS addon instead."
section: api
order: 9
slug: api/whmcs-webhook
---

# WHMCS webhook (legacy)

```
POST /api/v1/whmcs-webhook
```

> **Warning:** This endpoint exists for compatibility with older installs. Its message texts are fixed and cannot be customized. For new installs, use the [WHMCS addon](/docs/integrations/whmcs).

It receives event data from WHMCS and sends a WhatsApp notification to the client from the default connected number on your account.

## Headers

| Header | Value |
|---|---|
| `X-API-Key` | Your key (or `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` |

## Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | Yes | `InvoiceCreated`, `InvoicePaid` or `TicketOpen` |
| `phone` | string | Yes | Client number (`phonenumber` is accepted as an alias) |
| `client_name` | string | No | Client name |
| `invoiceid` | string | For invoice events | Invoice number |
| `amount` | string | No | Invoice amount |
| `currency` | string | No | Currency |
| `due_date` | string | No | Due date |
| `invoice_url` | string | No | Invoice link |
| `ticketid` | string | For `TicketOpen` | Ticket number |
| `subject` | string | No | Ticket subject |
| `ticket_url` | string | No | Ticket link |

Text values are truncated to 500 characters.

## Response

`200 OK`

```json
{ "success": true }
```

> **Note:** `success: true` is also returned when no notification is sent, for example when the phone number is missing or `action` is not supported. Do not treat this response as delivery confirmation.

## Errors

| Status | Response |
|---|---|
| `401` | `{"error": "Invalid API key"}` |
| `429` | `{"error": "Too many requests", ...}` |
| `502` | `{"success": false, "error": "Failed to process webhook"}` |

## Examples

```bash
curl -X POST https://waabek.com/api/v1/whmcs-webhook \
  -H "X-API-Key: $WABEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "InvoicePaid",
    "invoiceid": "1042",
    "phone": "966500000000",
    "client_name": "Sara Ahmed",
    "amount": "99.00",
    "currency": "USD"
  }'
```

```javascript
await fetch("https://waabek.com/api/v1/whmcs-webhook", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.WABEK_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    action: "InvoicePaid",
    invoiceid: "1042",
    phone: "966500000000",
    client_name: "Sara Ahmed",
    amount: "99.00",
    currency: "USD",
  }),
});
```

```php
<?php
// Example WHMCS hook (includes/hooks/wabek_invoice_paid.php)
add_hook('InvoicePaid', 1, function ($vars) {
    $invoice = localAPI('GetInvoice', ['invoiceid' => $vars['invoiceid']]);
    $client  = localAPI('GetClientsDetails', ['clientid' => $invoice['userid']]);

    $ch = curl_init('https://waabek.com/api/v1/whmcs-webhook');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'X-API-Key: ' . getenv('WABEK_API_KEY'),
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS     => json_encode([
            'action'      => 'InvoicePaid',
            'invoiceid'   => (string) $vars['invoiceid'],
            'phone'       => preg_replace('/\D/', '', $client['phonenumberformatted'] ?? $client['phonenumber']),
            'client_name' => trim($client['firstname'] . ' ' . $client['lastname']),
            'amount'      => $invoice['total'],
            'currency'    => $invoice['currencycode'] ?? '',
        ]),
    ]);
    curl_exec($ch);
    curl_close($ch);
});
```

```python
import os
import requests

requests.post(
    "https://waabek.com/api/v1/whmcs-webhook",
    headers={"X-API-Key": os.environ["WABEK_API_KEY"]},
    json={
        "action": "InvoicePaid",
        "invoiceid": "1042",
        "phone": "966500000000",
        "client_name": "Sara Ahmed",
        "amount": "99.00",
        "currency": "USD",
    },
    timeout=15,
)
```
