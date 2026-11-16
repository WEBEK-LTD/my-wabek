---
title: "Zapier وMake وWebhooks"
description: "إرسال رسائل واتساب من Zapier أو Make أو أي أداة أتمتة، واستقبال إشعارات Webhook من WABEK."
section: integrations
order: 4
slug: integrations/zapier-webhooks
---

# Zapier وMake وWebhooks

## إرسال رسالة من أي أداة أتمتة

نقطة الإرسال المخصّصة لأدوات الأتمتة هي:

```
POST https://waabek.com/api/webhooks/trigger
```

ترويسات الطلب:

```
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

جسم الطلب (الحقل `instance_id` اختياري):

```json
{
  "to": "966500000000",
  "message": "Hello, we have received your order.",
  "instance_id": "3f1c2a7e-0000-4000-8000-000000000000"
}
```

> **ملاحظة:** هذه النقطة تقبل المفتاح في ترويسة `X-API-Key` فقط. التفاصيل في [مرجع Trigger](/docs/api/trigger).

### Zapier

1. في Zapier اضغط **Create Zap** واختر التطبيق المحفّز (مثل Google Forms أو Shopify).
2. أضف إجراء **Webhooks by Zapier** واختر **POST**.
3. اضبط الإجراء:
   - **URL:** `https://waabek.com/api/webhooks/trigger`
   - **Payload Type:** `json`
   - **Data Pass-Through:** `No`
4. في **Data** أضف الحقلين `to` (حقل هاتف العميل) و`message` (نص رسالتك).
5. في **Headers** أضف `X-API-Key` بقيمة مفتاحك.
6. اختبر الخطوة وفعّل الـ Zap.

### Make (Integromat)

1. أنشئ سيناريو وأضف وحدة المحفّز.
2. أضف وحدة **HTTP ← Make a request**.
3. اضبط: **URL** كما سبق، **Method** `POST`، **Body type** `Raw`، **Content type** `JSON (application/json)`.
4. أضف ترويسة باسم `X-API-Key` وقيمتها مفتاحك.
5. في الجسم:

```json
{"to": "{{phone}}", "message": "{{message}}"}
```

## استقبال الأحداث (Webhooks الصادرة)

يمكنك تسجيل رابط HTTPS لديك ليستقبل إشعارًا من WABEK عند وقوع حدث.

1. افتح **Integrations** ثم تبويب **Webhooks**، وانتقل إلى قسم **Outgoing Webhooks**.
2. أدخل **Webhook URL** (يجب أن يكون رابط `https://` عامًا).
3. اختر الحدث وأدخل اسمًا اختياريًا، ثم احفظ.

> **تحذير:** حاليًا يُرسَل الحدث **`message_sent`** فقط، وذلك عند إرسال رسالة بنجاح عبر `POST /api/webhooks/trigger`. الأحداث الأخرى الظاهرة في القائمة يمكن تسجيلها لكنها لا تُرسل في هذا الإصدار.

صيغة الإشعار والتحقق منه في [مرجع Webhooks الصادرة](/docs/api/outgoing-webhooks).
