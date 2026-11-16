---
title: "حدود المعدّل"
description: "عدد الطلبات المسموح به لكل نقطة، وكيف تتعامل مع الخطأ 429، والحدود الأخرى التي تؤثر في الإرسال."
section: api
order: 2
slug: api/rate-limits
---

# حدود المعدّل

## حد الطلبات على `/api/v1/*`

| النطاق | الحد |
|---|---|
| لكل عنوان IP ولكل مسار | **100 طلب** خلال **60 ثانية** |

- يُحسب كل مسار على حدة: الطلبات إلى `/api/v1/send` لا تُحتسب ضمن `/api/v1/contacts`.
- يُطبّق الحد **قبل** المصادقة، فالطلبات المرفوضة بخطأ 401 تُحتسب أيضًا.
- اعتبر الرقم 100 حدًا أعلى، وصمّم تكاملك ليبقى دونه بهامش مريح.

عند تجاوز الحد:

```json
{ "error": "Too many requests", "retryAfter": 42 }
```

الحالة HTTP: `429`. القيمة `retryAfter` بالثواني.

> **ملاحظة:** لا تعتمد على وجود ترويسة `Retry-After`؛ استخدم الحقل `retryAfter` في جسم الاستجابة.

## إعادة المحاولة

1. عند `429` انتظر المدة في `retryAfter` ثم أعد المحاولة.
2. عند `502` أو `500` أعد المحاولة بتأخير متزايد (مثل 2 ثم 4 ثم 8 ثوانٍ) مع حد أقصى لعدد المحاولات.
3. **لا تُعِد المحاولة** عند `400` أو `401` أو `403` أو `404` أو `422`؛ أصلح الطلب أولًا.

```javascript
async function sendWithRetry(payload, maxAttempts = 4) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch("https://waabek.com/api/v1/send", {
      method: "POST",
      headers: {
        "X-API-Key": process.env.WABEK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, (data.retryAfter || 60) * 1000));
      continue;
    }
    if (res.status >= 500 && attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, 2 ** attempt * 1000));
      continue;
    }
    throw new Error(`${res.status} ${data.error || ""} ${data.detail || ""}`.trim());
  }
  throw new Error("Max attempts reached");
}
```

## النقاط الأخرى

لا يُطبّق حد طلبات منفصل حاليًا على `/api/gateway/whatsapp` و`/api/webhooks/trigger` و`/api/webhooks/wix`. لكن تبقى الحدود التالية سارية على كل النقاط.

## حدود تؤثر في الإرسال

| الحد | المصدر | الأثر |
|---|---|---|
| حد الرسائل الشهري | باقتك | `403` برمز `plan_limit` |
| حدود Meta للرقم | Meta (حسب جودة الرقم ومستواه) | رفض من Meta يظهر في `detail` (مثل `130429`) |
| حدود حماية واتساب ويب | واتساب | الإرسال السريع أو الكثيف قد يؤدي إلى حظر الرقم |

> **تحذير:** على أرقام واتساب ويب، لا ترسل دفعات كبيرة بسرعة عبر الـ API. وزّع الرسائل على فترات، أو استخدم [الحملات](/docs/guides/campaigns) مع تأخير بين الرسائل.
