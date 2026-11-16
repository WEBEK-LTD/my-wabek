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
| لكل مفتاح API (كل إجراءات `/api/v1/*` معًا) | **100 طلب** خلال **60 ثانية** |
| لكل عنوان IP ولكل مسار، قبل المصادقة | **300 طلب** خلال **60 ثانية** |

- يجمع حد المفتاح كل إجراءات ذلك المفتاح معًا. لكل مفتاحين في الحساب نفسه حدّان منفصلان، وتُحتسب طلبات الجلسة (لوحة التحكم) لكل حساب.
- يُطبّق سقف عنوان IP **قبل** المصادقة، فالطلبات المرفوضة بخطأ 401 تُحتسب أيضًا.
- الحدود مشتركة بين كل خوادم WABEK.
- اعتبر الرقم 100 حدًا أعلى، وصمّم تكاملك ليبقى دونه بهامش مريح.

عند تجاوز حد:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

```json
{ "error": "Too many requests", "code": "rate_limited", "retryAfter": 60 }
```

الترويسة `Retry-After` والحقل `retryAfter` بالثواني، وهما موجودان دائمًا مع `429`.

## إعادة المحاولة

1. عند `429` انتظر عدد الثواني في ترويسة `Retry-After` (أو `retryAfter`) ثم أعد المحاولة.
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
      const wait = Number(res.headers.get("Retry-After")) || data.retryAfter || 60;
      await new Promise(r => setTimeout(r, wait * 1000));
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

لـ `/api/gateway/whatsapp` الحدود نفسها التي لـ `/api/v1/*` (100 طلب في الدقيقة لكل مفتاح، تُحتسب منفصلة عن `/api/v1`). ولا يُطبّق حد طلبات منفصل حاليًا على `/api/webhooks/trigger` و`/api/webhooks/wix`. لكن تبقى الحدود التالية سارية على كل النقاط.

## حدود تؤثر في الإرسال

| الحد | المصدر | الأثر |
|---|---|---|
| حد الرسائل الشهري | باقتك | `403` برمز `plan_limit` |
| حدود Meta للرقم | Meta (حسب جودة الرقم ومستواه) | رفض من Meta يظهر في `detail` (مثل `130429`) |
| حدود حماية واتساب ويب | واتساب | الإرسال السريع أو الكثيف قد يؤدي إلى حظر الرقم |

> **تحذير:** على أرقام واتساب ويب، لا ترسل دفعات كبيرة بسرعة عبر الـ API. وزّع الرسائل على فترات، أو استخدم [الحملات](/docs/guides/campaigns) مع تأخير بين الرسائل.
