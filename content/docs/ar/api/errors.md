---
title: "الأخطاء ورموزها"
description: "صيغة استجابات الخطأ، ومعنى كل حالة HTTP، ورموز الأخطاء التي تعيدها كل نقطة."
section: api
order: 3
slug: api/errors
---

# الأخطاء ورموزها

## صيغة الخطأ

تعيد النقاط الأخطاء بصيغة JSON. الحقل `error` موجود دائمًا، والحقول الأخرى حسب الحالة:

```json
{
  "error": "Recipient has opted out",
  "code": "opted_out"
}
```

| الحقل | النوع | الوصف |
|---|---|---|
| `error` | string | وصف مختصر للخطأ |
| `code` | string | رمز يمكن الاعتماد عليه برمجيًا (في بعض الأخطاء) |
| `detail` | string | تفاصيل إضافية، وغالبًا رسالة الخطأ الأصلية من Meta |
| `attempts` | array | محاولات القوالب التي جُرّبت (في أخطاء `422`) |
| `retryAfter` | number | ثوانٍ قبل إعادة المحاولة (في أخطاء `429`) |

> **ملاحظة:** اعتمد في منطقك البرمجي على حالة HTTP والحقل `code`، لا على نص `error`؛ قد يتغيّر النص.

## حالات HTTP

| الحالة | المعنى | ماذا تفعل |
|---|---|---|
| `200` | نجاح | — |
| `400` | حقل إلزامي ناقص أو غير صالح | أصلح الطلب |
| `401` | المفتاح مفقود أو غير صالح | تحقّق من المفتاح |
| `403` | غير مسموح: حد الباقة أو باقة بلا وصول إلى API، أو المفتاح بلا الصلاحية اللازمة، أو دور الفريق لا يسمح، أو المستلم ألغى اشتراكه / محظور | راجع `code` |
| `404` | لا يوجد رقم متصل، أو نقطة غير معروفة | اربط رقمًا أو صحّح المسار |
| `405` | طريقة HTTP غير مدعومة | استخدم الطريقة الصحيحة |
| `422` | تعذّر التسليم خارج نافذة الـ 24 ساعة (`outside_window`) | أرسل قالبًا معتمدًا صالحًا |
| `429` | تجاوزت حد الطلبات | انتظر المدة في ترويسة `Retry-After` / الحقل `retryAfter` |
| `500` | خطأ داخلي | أعد المحاولة لاحقًا |
| `502` | رفض مزوّد واتساب الرسالة | اقرأ `detail` |

## رموز منع الإرسال

تعيدها كل نقاط الإرسال بالحالة `403`:

| `code` في `/api/v1` | `code` في `/api/gateway/whatsapp` | المعنى |
|---|---|---|
| `plan_limit` | `PLAN_LIMIT` | بلغت حد الرسائل الشهري لباقتك |
| `opted_out` | `OPTED_OUT` | المستلم ألغى اشتراكه في حسابك |
| `blocked` | `BLOCKED` | المستلم محظور في حسابك |

## رموز الوصول

| الحالة | `code` | المعنى |
|---|---|---|
| `403` | `plan_no_api` | باقتك لا تشمل الوصول إلى API (`/api/v1/*` و`/api/gateway/whatsapp`). رقِّ الباقة |
| `403` | `permission_denied` | مفتاح API لا يملك الصلاحية التي يتطلبها الإجراء؛ يذكرها الحقل `required` (`send`، `contacts:read`، `contacts:write`، `otp`). راجع [مفاتيح API](/docs/security/api-keys) |
| `403` | `member_forbidden` | لطلبات لوحة التحكم فقط: دورك في الفريق (`viewer` / `agent`) لا يسمح بهذا التعديل. راجع [أدوار الفريق](/docs/guides/team-roles) |
| `403` | `plan_limit` | بلغت حدًا من حدود الباقة: الرسائل الشهرية، أو جهات الاتصال (`max_contacts`)، أو الحسابات الفرعية (`max_sub_accounts`)؛ يذكر الحقل `limit` القيمة |
| `422` | `outside_window` | المستلم خارج نافذة الـ 24 ساعة ولم يُحدَّد قالب. لا تستبدل WABEK بنصّك قالبًا آخر أبدًا |
| `429` | `rate_limited` | طلبات كثيرة لهذا المفتاح؛ انتظر عدد الثواني في `Retry-After` |

## رسائل الخطأ حسب النقطة

### `/api/v1/*`

| الحالة | `error` |
|---|---|
| 400 | `to and message required` |
| 400 | `phone required` |
| 400 | `otp_id and otp required` |
| 401 | `Invalid API key` |
| 403 | `Monthly message limit reached for your plan` / `Recipient has opted out` / `Recipient is blocked` |
| 403 | `plan_no_api` / `permission_denied` / `plan_limit` (جهات الاتصال) |
| 404 | `No connected WhatsApp instance` |
| 404 | `Unknown action` |
| 422 | `Recipient is outside the 24-hour messaging window` |
| 422 | `Failed to deliver message outside the 24h window` |
| 422 | `Failed to deliver the verification code` |
| 500 | `Failed to send message` / `Failed to save contact` |
| 502 | `Failed to send message` (مع `detail`) |

### `/api/gateway/whatsapp`

| الحالة | `code` | `error` |
|---|---|---|
| 400 | `MISSING_TO` | `Phone number required (to)` |
| 400 | `MISSING_MESSAGE` | `Message required (message)` |
| 401 | `UNAUTHORIZED` | `Invalid API key` |
| 403 | `PLAN_LIMIT` / `OPTED_OUT` / `BLOCKED` | سبب المنع |
| 403 | `plan_no_api` / `permission_denied` | الباقة بلا وصول إلى API / المفتاح بلا صلاحية `send` |
| 404 | `NO_INSTANCE` | `No connected WhatsApp instance found` |
| 422 | `OUTSIDE_WINDOW` | خارج نافذة الـ 24 ساعة (تُرسل الرموز عبر قالب المصادقة متى أمكن) |
| 429 | `rate_limited` | طلبات كثيرة |
| 502 | `SEND_FAILED` | سبب الفشل |

### `/api/webhooks/trigger`

| الحالة | `error` |
|---|---|
| 400 | `to and message required` |
| 401 | `API key required` / `Invalid API key` |
| 403 | سبب المنع، أو `permission_denied` |
| 404 | `No connected WhatsApp instance` |
| 405 | `Method not allowed` |
| 422 | `outside_window` |
| 502 | سبب الفشل |

### `/api/webhooks/wix`

| الحالة | `error` |
|---|---|
| 400 | `event field required. ...` |
| 401 | `Invalid or missing API key` |
| 403 | `Failed to send` مع `code` |
| 404 | `No connected WhatsApp instance found` |
| 405 | `Method not allowed` |
| 422 | `outside_window` |
| 502 | `Failed to send` |

## أخطاء Meta الشائعة

عندما ترفض Meta رسالة على Cloud API، تظهر رسالتها في `detail`. أشهر الرموز:

| الرمز | المعنى |
|---|---|
| `131047` | أكثر من 24 ساعة منذ آخر رسالة من العميل؛ يلزم قالب |
| `132001` | القالب غير موجود بهذا الاسم أو اللغة |
| `132000` | عدد معاملات القالب غير مطابق |
| `131026` | تعذّر تسليم الرسالة إلى هذا الرقم |
| `130429` | تجاوزت حد الإرسال لدى Meta |
| `190` | رمز الوصول (Access Token) منتهي أو غير صالح |

راجع [استكشاف الأخطاء](/docs/faq/troubleshooting) لحلول مفصّلة.
