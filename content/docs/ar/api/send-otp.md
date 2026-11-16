---
title: "إرسال رمز تحقق"
description: "POST /api/v1/otp — توليد رمز تحقق من 6 أرقام وإرساله إلى رقم واتساب."
section: api
order: 7
slug: api/send-otp
---

# إرسال رمز تحقق

```
POST /api/v1/otp
```

تولّد WABEK رمزًا عشوائيًا من **6 أرقام**، وتخزّنه مُجزّأً (Hash)، وترسله إلى المستلم عبر واتساب. تحصل على `otpId` لتستخدمه لاحقًا في [التحقق من الرمز](/docs/api/verify-otp).

## الترويسات

| الترويسة | القيمة |
|---|---|
| `X-API-Key` | مفتاحك (أو `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` |

## جسم الطلب

| الحقل | النوع | إلزامي | الوصف |
|---|---|---|---|
| `phone` | string | نعم | رقم المستلم بالصيغة الدولية (أرقام فقط). يُقبل `to` بديلًا. |
| `purpose` | string | لا | `verification` (الافتراضي)، أو `login`، أو `transaction` |

## خصائص الرمز

| الخاصية | القيمة |
|---|---|
| الطول | 6 أرقام |
| الصلاحية | 10 دقائق افتراضيًا (قد تختلف حسب إعدادات المنصة) |
| الاستخدام | مرة واحدة فقط |
| المحاولات | 5 محاولات خاطئة كحد أقصى، ثم يُلغى الرمز |
| التخزين | مُجزّأ بـ SHA-256، لا يُخزَّن الرمز نفسه |

## الرقم المرسِل

- إذا أعدّت المنصة رقمًا مخصّصًا لرموز التحقق، يُرسل الرمز منه.
- وإلا يُرسل من أحد أرقامك المتصلة، مع تفضيل أرقام واتساب ويب.
- على أرقام Cloud API يُرسل الرمز عبر قالب **Authentication** معتمد. راجع [قالب رموز التحقق](/docs/getting-started/messaging-window).

> **ملاحظة:** نص رسالة الرمز ثابت ولا يمكن تخصيصه من هذه النقطة. إذا أردت نصًا خاصًا بعلامتك، فولّد الرمز بنفسك وأرسله عبر [إرسال رسالة](/docs/api/send-message) مع الحقل `code`.

## الاستجابة

`200 OK`

```json
{
  "success": true,
  "otpId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

> **ملاحظة:** اسم الحقل في الاستجابة `otpId`، بينما تطلب نقطة التحقق الحقل `otp_id`.

## الأخطاء

| الحالة | الاستجابة | السبب |
|---|---|---|
| `400` | `{"error": "phone required"}` | الرقم مفقود |
| `401` | `{"error": "Invalid API key"}` | مفتاح غير صالح |
| `429` | `{"error": "Too many requests", ...}` | تجاوزت حد الطلبات |
| `500` | خطأ داخلي | لا يوجد رقم متصل، أو فشلت كل محاولات قالب Authentication |

## أمثلة

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

## أفضل الممارسات

- احفظ `otpId` في جلسة المستخدم على خادمك، ولا ترسله إلى المتصفح إن لم تكن بحاجة لذلك.
- حدّد على خادمك عدد طلبات الرمز لكل رقم ولكل مستخدم (مثل طلب واحد كل دقيقة)، لمنع إساءة الاستخدام واستهلاك رصيدك.
