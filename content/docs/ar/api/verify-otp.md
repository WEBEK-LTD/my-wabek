---
title: "التحقق من رمز"
description: "POST /api/v1/otp-verify — التحقق من رمز أدخله المستخدم مقابل otpId."
section: api
order: 8
slug: api/verify-otp
---

# التحقق من رمز

```
POST /api/v1/otp-verify
```

يتحقق من رمز أدخله المستخدم مقابل `otpId` الذي حصلت عليه من [إرسال رمز تحقق](/docs/api/send-otp).

> **ملاحظة:** المسار هو `/api/v1/otp-verify` بشرطة، وليس `/api/v1/otp/verify`.

## الترويسات

| الترويسة | القيمة |
|---|---|
| `X-API-Key` | مفتاحك (أو `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` |

## جسم الطلب

| الحقل | النوع | إلزامي | الوصف |
|---|---|---|---|
| `otp_id` | string | نعم | قيمة `otpId` من استجابة الإرسال |
| `otp` | string | نعم | الرمز الذي أدخله المستخدم |

لا يمكن التحقق إلا من رموز صادرة لحسابك نفسه.

## الاستجابة

تُعاد الحالة `200` في كل نتائج التحقق. اعتمد على الحقل `valid`.

رمز صحيح:

```json
{ "valid": true }
```

رمز غير صحيح:

```json
{ "valid": false, "reason": "Invalid OTP" }
```

| `reason` | المعنى |
|---|---|
| `OTP not found` | المعرّف غير موجود أو لا يتبع حسابك |
| `Invalid OTP` | الرمز خاطئ (تُحتسب محاولة) |
| `OTP expired` | انتهت صلاحية الرمز |
| `OTP already used` | استُخدم الرمز سابقًا |
| `Too many attempts` | تجاوز 5 محاولات خاطئة؛ أُلغي الرمز |

بعد نجاح التحقق مرة واحدة يصبح الرمز مستخدمًا ولا يمكن التحقق منه مجددًا.

## الأخطاء

| الحالة | `error` |
|---|---|
| `400` | `otp_id and otp required` |
| `401` | `Invalid API key` |
| `429` | `Too many requests` |

## أمثلة

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
