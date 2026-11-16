---
title: "WHMCS Webhook (قديم)"
description: "POST /api/v1/whmcs-webhook — نقطة استقبال أحداث WHMCS القديمة. استخدم وحدة WHMCS الجديدة بدلًا منها."
section: api
order: 9
slug: api/whmcs-webhook
---

# WHMCS Webhook (قديم)

```
POST /api/v1/whmcs-webhook
```

> **تحذير:** هذه النقطة موجودة للتوافق مع التثبيتات القديمة. نصوص الرسائل فيها ثابتة ولا يمكن تخصيصها. للتثبيتات الجديدة استخدم [وحدة WHMCS](/docs/integrations/whmcs).

تستقبل بيانات حدث من WHMCS، وترسل إشعار واتساب إلى العميل من الرقم الافتراضي المتصل في حسابك.

## الترويسات

| الترويسة | القيمة |
|---|---|
| `X-API-Key` | مفتاحك (أو `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` |

## جسم الطلب

| الحقل | النوع | إلزامي | الوصف |
|---|---|---|---|
| `action` | string | نعم | `InvoiceCreated` أو `InvoicePaid` أو `TicketOpen` |
| `phone` | string | نعم | رقم العميل (يُقبل `phonenumber` بديلًا) |
| `client_name` | string | لا | اسم العميل |
| `invoiceid` | string | مع أحداث الفواتير | رقم الفاتورة |
| `amount` | string | لا | مبلغ الفاتورة |
| `currency` | string | لا | العملة |
| `due_date` | string | لا | تاريخ الاستحقاق |
| `invoice_url` | string | لا | رابط الفاتورة |
| `ticketid` | string | مع `TicketOpen` | رقم التذكرة |
| `subject` | string | لا | موضوع التذكرة |
| `ticket_url` | string | لا | رابط التذكرة |

تُقص القيم النصية إلى 500 حرف.

## الاستجابة

`200 OK`

```json
{ "success": true }
```

> **ملاحظة:** تُعاد `success: true` أيضًا عندما لا يُرسل أي إشعار، مثل غياب رقم الهاتف أو قيمة `action` غير مدعومة. لا تعتمد على هذه الاستجابة كتأكيد للتسليم.

## الأخطاء

| الحالة | الاستجابة |
|---|---|
| `401` | `{"error": "Invalid API key"}` |
| `429` | `{"error": "Too many requests", ...}` |
| `502` | `{"success": false, "error": "Failed to process webhook"}` |

## أمثلة

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
