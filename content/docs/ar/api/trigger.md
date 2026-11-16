---
title: "Trigger (لأدوات الأتمتة)"
description: "POST /api/webhooks/trigger — إرسال رسالة من Zapier أو Make أو أي أداة أتمتة، مع إطلاق Webhook الحدث message_sent."
section: api
order: 11
slug: api/trigger
---

# Trigger (لأدوات الأتمتة)

```
POST /api/webhooks/trigger
```

نقطة إرسال مخصّصة لأدوات الأتمتة مثل Zapier وMake. بعد نجاح الإرسال تُطلق [Webhooks الصادرة](/docs/api/outgoing-webhooks) المسجّلة للحدث `message_sent`.

## الترويسات

| الترويسة | القيمة |
|---|---|
| `X-API-Key` | مفتاحك. **هذه النقطة لا تقبل** `Authorization: Bearer` ولا المفتاح في الرابط. |
| `Content-Type` | `application/json` |

## جسم الطلب

| الحقل | النوع | إلزامي | الوصف |
|---|---|---|---|
| `to` | string | نعم | رقم المستلم بالصيغة الدولية |
| `message` | string | نعم | نص الرسالة |
| `instance_id` | string | لا | معرّف الرقم المرسِل. الافتراضي: أول رقم متصل |

> **تحذير:** على أرقام Cloud API، إذا كان المستلم خارج نافذة الـ 24 ساعة، يُرسل قالب الإشعار الافتراضي للمنصة بدل نصك. راجع [نافذة الـ 24 ساعة](/docs/getting-started/messaging-window).

## الاستجابة

`200 OK`

```json
{
  "success": true,
  "message_id": "wamid.HBgMOTY2NTAwMDAwMDAwFQIAERgSQzE2..."
}
```

## الأخطاء

| الحالة | `error` | السبب |
|---|---|---|
| `400` | `to and message required` | حقل ناقص |
| `401` | `API key required` | ترويسة `X-API-Key` مفقودة |
| `401` | `Invalid API key` | مفتاح غير صالح |
| `403` | سبب المنع | حد الباقة، أو إلغاء اشتراك، أو حظر |
| `404` | `No connected WhatsApp instance` | لا يوجد رقم متصل |
| `405` | `Method not allowed` | الطريقة ليست POST |
| `502` | سبب الفشل | رفض مزوّد واتساب الرسالة |

## أمثلة

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
