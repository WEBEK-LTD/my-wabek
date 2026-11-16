---
title: "Wix"
description: "ربط متجر Wix بـ WABEK عبر تطبيق Wix أو عبر Wix Automations لإرسال إشعارات الطلبات."
section: integrations
order: 3
slug: integrations/wix
---

# Wix

هناك طريقتان لربط Wix:

| الطريقة | متى تستخدمها |
|---|---|
| **تطبيق WABEK على Wix App Market** | الطريقة الموصى بها لمتاجر Wix Stores؛ الإعداد تلقائي |
| **Wix Automations** (طلب HTTP) | لأحداث مخصّصة مثل النماذج والأعضاء، أو إذا لم تستخدم التطبيق |

## الطريقة 1: تطبيق Wix

1. في WABEK افتح **Wix** ثم تبويب **My Stores**، واضغط **Install on Wix**.
2. في Wix App Market اضغط **Add to Site** واختر موقعك.
3. من لوحة Wix افتح **Apps ← WABEK WhatsApp**. يُنشأ حسابك ويُربط تلقائيًا.
4. اضغط **Open Full Dashboard**، ثم اربط رقم واتساب من صفحة **WhatsApp**. راجع [ربط رقم واتساب](/docs/getting-started/connect-number).
5. في تبويب **Messages** عدّل نص كل حدث، وفعّل الأحداث أو عطّلها.
6. من **My Stores ← Test Message** أرسل رسالة تجريبية.

### الأحداث

| الحدث | متى يُرسل |
|---|---|
| Order Confirmed | عند إنشاء طلب جديد |
| Payment Received | عند تأكيد الدفع |
| Order Shipped | عند تنفيذ الطلب مع رقم تتبّع |
| Order Cancelled | عند إلغاء الطلب |
| Order Refunded | عند استرداد المبلغ |
| Abandoned Cart | عند بدء الدفع دون إكماله |
| Cart Recovered | عند إكمال سلة متروكة |
| Back in Stock | عند توفّر المنتج مجددًا |

### المتغيرات

| المتغير | القيمة |
|---|---|
| `{{customer_name}}` | اسم العميل |
| `{{order_id}}` | رقم الطلب |
| `{{total}}` | الإجمالي مع العملة |
| `{{tracking_number}}` | رقم أو رابط التتبّع |
| `{{checkout_url}}` | رابط إكمال الدفع (للسلة المتروكة) |

## الطريقة 2: Wix Automations

استخدم إجراء **Send HTTP request** في Wix Automations لإرسال بيانات الحدث إلى WABEK.

1. أنشئ مفتاح API من **API Keys** في WABEK.
2. في Wix افتح **Automations** وأنشئ أتمتة جديدة، واختر المحفّز (مثل إرسال نموذج).
3. اختر الإجراء **Send HTTP request** واضبطه:
   - **URL:** `https://waabek.com/api/webhooks/wix`
   - **Method:** `POST`
   - **Header:** `X-API-Key: <مفتاحك>`
4. أضف أزواج المفتاح والقيمة في جسم الطلب:

| المفتاح | إلزامي | الوصف |
|---|---|---|
| `event` | نعم | اسم الحدث (انظر الجدول التالي) |
| `customer_phone` | نعم | رقم العميل (تُقبل أيضًا `phone` و`billing_phone` و`buyerPhone`) |
| `customer_name` | لا | اسم العميل |
| `order_id` | لا | رقم الطلب |
| `total` | لا | الإجمالي |
| `tracking_number` | لا | رقم التتبّع |
| `cart_url` | لا | رابط السلة |
| `site_name` | لا | اسم الموقع |

قيم `event` المدعومة: `order_placed`، `order_paid`، `order_shipped`، `order_delivered`، `order_cancelled`، `order_refunded`، `abandoned_cart`، `new_member`، `form_submitted`.

> **ملاحظة:** إذا لم تسمح أداة Wix بإضافة ترويسات، فما زال إرسال المفتاح في الرابط `?api_key=` مقبولًا للتوافق مع الإعدادات القديمة، لكنه **مُهمَل** وقد يُعطَّل لاحقًا. راجع [المصادقة](/docs/api/authentication).

تفاصيل الطلب والاستجابة في [مرجع Wix Automations](/docs/api/wix-automations).

## نافذة الـ 24 ساعة

على أرقام **Cloud API**، إذا كان العميل خارج نافذة الـ 24 ساعة، فقد يصله قالب الإشعار الافتراضي للمنصة بدل نص الحدث. راجع [نافذة الـ 24 ساعة](/docs/getting-started/messaging-window).
