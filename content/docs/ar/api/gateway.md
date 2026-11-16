---
title: "بوابة الرسائل (Gateway)"
description: "GET/POST /api/gateway/whatsapp — بوابة إرسال بسيطة متوافقة مع إضافات مثل Digits لـ WordPress."
section: api
order: 10
slug: api/gateway
---

# بوابة الرسائل (Gateway)

```
POST /api/gateway/whatsapp
GET  /api/gateway/whatsapp
```

بوابة إرسال بسيطة صُمّمت لإضافات تتيح «بوابة SMS/واتساب مخصّصة»، مثل إضافة Digits لتسجيل الدخول برقم الهاتف في WordPress. تقبل أسماء حقول متعددة لتتوافق مع هذه الإضافات.

## الترويسات

| الترويسة | القيمة |
|---|---|
| `X-API-Key` | مفتاحك (أو `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` أو `application/x-www-form-urlencoded` (لطلبات POST) |

## المعاملات

في `GET` تُقرأ المعاملات من الرابط فقط. في `POST` تُقرأ من الجسم والرابط معًا.

| المعامل | الأسماء البديلة | إلزامي | الوصف |
|---|---|---|---|
| `to` | `phone`، `mobile` | نعم | رقم المستلم. تُحذف أي رموز غير رقمية. |
| `message` | `text`، `msg` | نعم | نص الرسالة |
| `instance_id` | `sender_id`، `sender` | لا | معرّف الرقم المرسِل. الافتراضي: أول رقم متصل |

> **تحذير:** على أرقام Cloud API، إذا كان المستلم خارج نافذة الـ 24 ساعة فلا يمكن تسليم نص عادي. إن احتوت الرسالة رمزًا من 4 إلى 8 أرقام (مثل «رمزك 482913») ترسل WABEK الرمز عبر قالب Authentication المعتمد لديك؛ وإلا فلا يُرسل شيء ويُعاد `422` بالرمز `OUTSIDE_WINDOW`. لا ترسل WABEK قالبًا مختلفًا بدل نصك أبدًا.

يتطلب باقة تشمل الوصول إلى API (`403` بالرمز `plan_no_api`) وصلاحية المفتاح `send` (`403` بالرمز `permission_denied`). الحد 100 طلب في الدقيقة لكل مفتاح (`429` مع `Retry-After`).

## الاستجابة

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

## الأخطاء

| الحالة | `code` | `error` |
|---|---|---|
| `400` | `MISSING_TO` | `Phone number required (to)` |
| `400` | `MISSING_MESSAGE` | `Message required (message)` |
| `401` | `UNAUTHORIZED` | `Invalid API key` |
| `403` | `PLAN_LIMIT` / `OPTED_OUT` / `BLOCKED` | سبب المنع |
| `404` | `NO_INSTANCE` | `No connected WhatsApp instance found` |
| `502` | `SEND_FAILED` | سبب الفشل |

## إعداد Digits

| إعداد Digits | القيمة |
|---|---|
| Gateway URL | `https://waabek.com/api/gateway/whatsapp` |
| HTTP Method | `POST` |
| Headers | `X-API-Key:YOUR_KEY` |
| Parameters | `to:{to}` و`message:{message}` |

## أمثلة

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

## المفتاح في الرابط (مُهمَل)

ما زالت البوابة تقبل `?api_key=` أو `?key=` في الرابط، أو `api_key` في الجسم، للتوافق مع إعدادات Digits القديمة. انقل الإعداد إلى ترويسة `X-API-Key`؛ هذه الطريقة قد تُعطَّل لاحقًا.
