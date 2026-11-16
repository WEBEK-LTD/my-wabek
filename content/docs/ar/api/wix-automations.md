---
title: "Wix Automations"
description: "POST /api/webhooks/wix — استقبال طلبات HTTP من Wix Automations وإرسال إشعار واتساب حسب الحدث."
section: api
order: 12
slug: api/wix-automations
---

# Wix Automations

```
POST /api/webhooks/wix
```

النقطة التي تلصقها في إجراء **Send HTTP request** داخل Wix Automations. تبني رسالة حسب الحدث وترسلها إلى العميل.

> **ملاحظة:** هذه ليست نقطة تطبيق WABEK على Wix App Market؛ التطبيق يُعدّ تلقائيًا ولا يحتاج إلى هذه النقطة. راجع [تكامل Wix](/docs/integrations/wix).

## الترويسات

| الترويسة | القيمة |
|---|---|
| `X-API-Key` | مفتاحك (أو `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` |

## جسم الطلب

| الحقل | النوع | إلزامي | الوصف |
|---|---|---|---|
| `event` | string | نعم | اسم الحدث (يُقبل `type` بديلًا) |
| `customer_phone` | string | نعم | رقم العميل. البدائل: `phone`، `billing_phone`، `buyerPhone`. تُحذف الرموز غير الرقمية والأصفار البادئة. |
| `customer_name` | string | لا | اسم العميل (أو `name`). الافتراضي `Customer` |
| `order_id` | string | لا | رقم الطلب (أو `orderId`) |
| `total` | string | لا | الإجمالي (أو `amount`) |
| `tracking_number` | string | لا | رقم التتبّع (أو `trackingNumber`) |
| `cart_url` | string | لا | رابط السلة للسلة المتروكة |
| `site_name` | string | لا | اسم الموقع |

### الأحداث المدعومة

`order_placed`، `order_paid`، `order_shipped`، `order_delivered`، `order_cancelled`، `order_refunded`، `abandoned_cart`، `new_member`، `form_submitted`.

إذا حفظت نصًا مخصّصًا للحدث في صفحة **Wix ← Messages** يُستخدم، مع استبدال المتغيرات: `{{customer_name}}`، `{{first_name}}`، `{{order_id}}`، `{{total}}`، `{{tracking_number}}`، `{{cart_url}}`، `{{site_name}}`. وإلا يُستخدم نص افتراضي بالإنجليزية.

## الاستجابة

إرسال ناجح:

```json
{
  "success": true,
  "event": "order_placed",
  "phone": "966500000000",
  "wa_message_id": "wamid.HBgMOTY2NTAwMDAwMDAwFQIAERgSQzE2..."
}
```

طلب مقبول دون إرسال (`200`):

```json
{ "success": true, "skipped": "no phone number in payload" }
```

```json
{ "success": true, "skipped": "event \"order_updated\" not recognized" }
```

## الأخطاء

| الحالة | `error` |
|---|---|
| `400` | `event field required. Add a key "event" with value e.g. "order_placed"` |
| `401` | `Invalid or missing API key` |
| `403` | `Failed to send` مع `code` (`plan_limit` أو `opted_out` أو `blocked`) |
| `404` | `No connected WhatsApp instance found` |
| `405` | `Method not allowed` |
| `502` | `Failed to send` |

## أمثلة

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
