---
title: "إرسال رسالة"
description: "POST /api/v1/send — إرسال رسالة نصية أو رمز تحقق أو قالب معتمد إلى رقم واتساب."
section: api
order: 4
slug: api/send-message
---

# إرسال رسالة

```
POST /api/v1/send
```

يرسل رسالة من أحد أرقامك. تختار WABEK طريقة الإرسال تلقائيًا حسب نوع الرقم ونافذة الـ 24 ساعة.

## الترويسات

| الترويسة | القيمة |
|---|---|
| `X-API-Key` | مفتاحك (أو `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` |

## جسم الطلب

| الحقل | النوع | إلزامي | الوصف |
|---|---|---|---|
| `to` | string | نعم | رقم المستلم بالصيغة الدولية، أرقام فقط مع رمز الدولة (مثل `966500000000`). يُقبل `phone` بديلًا. |
| `message` | string | نعم | نص الرسالة. |
| `instance_id` | string | لا | معرّف الرقم المرسِل. إن لم يُحدَّد يُستخدم أقدم رقم متصل في حسابك. |
| `template` | string | لا | اسم قالب معتمد يُستخدم إذا كان المستلم خارج نافذة الـ 24 ساعة (Cloud API). |
| `template_params` | object | لا | معاملات القالب المسمّاة، مثل `{"customer_name": "Sara"}`. تُستخدم مع `template`. |
| `customer_name` | string | لا | اسم العميل للقالب الافتراضي خارج النافذة. الافتراضي `Customer`. |
| `code` | string أو number | لا | رمز تحقق من 4 إلى 8 أرقام. وجوده يجعل الرسالة تُرسل عبر قالب Authentication. |
| `type` | string | لا | القيمة `otp` تعني أن `message` تحتوي رمز تحقق يُستخرج منها. |

> **ملاحظة:** إن لم يكن لديك أي رقم متصل، تحاول WABEK الإرسال عبر أقدم رقم في حسابك أيًا كانت حالته، وغالبًا يفشل الطلب. تأكّد من أن الرقم متصل، أو مرّر `instance_id` لرقم متصل.

## كيف يُختار أسلوب الإرسال

| نوع الرقم | الحالة | ما يحدث |
|---|---|---|
| واتساب ويب | دائمًا | يُرسل `message` نصًا |
| Cloud API | مع `code` أو `type: "otp"` | يُرسل الرمز عبر قالب Authentication؛ إن فشل وكان العميل داخل النافذة يُرسل النص |
| Cloud API | داخل نافذة الـ 24 ساعة | يُرسل `message` نصًا |
| Cloud API | خارج النافذة و`message` تحتوي رقمًا من 4–8 خانات | يُعامل كرمز تحقق ويُرسل عبر قالب Authentication |
| Cloud API | خارج النافذة مع `template` | يُرسل القالب المحدد بمعاملات `template_params` |
| Cloud API | خارج النافذة بلا `template` | يُرسل قالب التسويق الافتراضي للمنصة، مع اسم العميل في `customer_name` ونص `message` في `offer_details` |

تُجرّب القوالب باللغتين `en` ثم `en_US`. راجع [نافذة الـ 24 ساعة والقوالب](/docs/getting-started/messaging-window).

> **تحذير:** قبل كل إرسال تتحقق WABEK من حد الرسائل الشهري ومن أن المستلم غير محظور ولم يُلغِ اشتراكه. إذا مُنع الإرسال تُعاد الحالة `403` ولا تُرسل الرسالة.

## الاستجابة

`200 OK`

```json
{
  "success": true,
  "message_id": "wamid.HBgMOTY2NTAwMDAwMDAwFQIAERgSQzE2..."
}
```

| الحقل | النوع | الوصف |
|---|---|---|
| `success` | boolean | `true` عند قبول الرسالة للإرسال |
| `message_id` | string أو null | معرّف الرسالة لدى واتساب (قد يكون `null` لبعض رسائل واتساب ويب) |

تُحفظ الرسالة في صندوق الوارد كرسالة صادرة.

## الأخطاء

| الحالة | المثال | السبب |
|---|---|---|
| `400` | `{"error": "to and message required"}` | حقل ناقص |
| `401` | `{"error": "Invalid API key"}` | مفتاح غير صالح |
| `403` | `{"error": "Recipient has opted out", "code": "opted_out"}` | حد الباقة، أو إلغاء اشتراك، أو حظر |
| `404` | `{"error": "No connected WhatsApp instance"}` | لا يوجد رقم في الحساب |
| `422` | انظر أدناه | خارج النافذة وفشلت كل محاولات القالب |
| `429` | `{"error": "Too many requests", "retryAfter": 42}` | تجاوزت حد الطلبات |
| `502` | `{"error": "Failed to send message", "detail": "..."}` | رفض مزوّد واتساب الرسالة |

مثال `422`:

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

## أمثلة

### رسالة نصية

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

### مع قالب احتياطي خارج النافذة

إذا كان العميل داخل النافذة يُرسل `message` نصًا، وإلا يُرسل القالب `order_update`. يجب أن يكون القالب معتمدًا على حساب واتساب للأعمال المرتبط بالرقم، وأن تطابق مفاتيح `template_params` أسماء المتغيرات في نصّه، وأن تكون لغته `en` أو `en_US`.

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

### رمز تحقق

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

> **ملاحظة:** إذا أردت أن تولّد WABEK الرمز وتتحقق منه نيابةً عنك، فاستخدم [إرسال رمز تحقق](/docs/api/send-otp) بدلًا من ذلك.
