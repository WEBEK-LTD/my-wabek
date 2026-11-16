---
title: "Webhooks الصادرة"
description: "الأحداث التي ترسلها WABEK إلى رابطك، وصيغتها، وترويسة التوقيع وكيفية التحقق منها."
section: api
order: 13
slug: api/outgoing-webhooks
---

# Webhooks الصادرة

ترسل WABEK طلب `POST` موقّعًا إلى رابط HTTPS تسجّله عند وقوع حدث في حسابك. تُدار الروابط من **Integrations ← Webhooks ← Outgoing Webhooks** في لوحة التحكم، ويشترك كل رابط في حدث واحد.

## الأحداث

| الحدث | متى يُرسل |
|---|---|
| `message_received` | عندما يرسل إليك جهة اتصال رسالة (رقم Cloud API أو واتساب ويب) |
| `message_sent` | عند إرسال أي رسالة صادرة: عبر API أو صندوق الوارد أو الحملات أو روبوت المحادثة أو الأتمتة أو الذكاء الاصطناعي (لا تُضمَّن رموز التحقق أبدًا) |
| `message_status` | عندما تصبح رسالة صادرة `delivered` أو `read` أو `failed` |
| `contact_created` | عند إنشاء جهة اتصال جديدة (من لوحة التحكم أو API أو أول رسالة من رقم غير معروف) |
| `campaign_completed` | عند انتهاء حملة من الإرسال |
| `opt_out` | عندما يلغي جهة اتصال اشتراكه (الكلمة `STOP` أو زر لوحة التحكم أو API) |
| `opt_in` | عندما يعيد جهة اتصال اشتراكه (الكلمة `START` أو زر لوحة التحكم أو API) |
| `chatbot_triggered` | عند بدء مسار روبوت محادثة لجهة اتصال |
| `link_clicked` | عند فتح رابط مختصر مُتتبَّع |

## الطلب

```
POST <your target_url>
Content-Type: application/json
User-Agent: WABEK-Webhooks/1.0
X-WABEK-Event: message_received
X-WABEK-Delivery: 5d1c0c3e-8f0a-4d5e-9b62-0f6f3b1e9a11
X-WABEK-Timestamp: 1763287200
X-WABEK-Signature: sha256=3f6c…e91b
```

لكل الطلبات الغلاف نفسه:

```json
{
  "event": "message_received",
  "created_at": "2026-11-16T10:00:00.000Z",
  "data": {
    "message_id": "wamid.HBgMOTY2NTAwMDAwMDAwFQIAEhggQ0Y…",
    "id": "8b0e4c4a-1f7e-4d0c-9c1e-2a7f7d1f3c55",
    "from": "966500000000",
    "name": "Sara",
    "message": "Hello!",
    "type": "text",
    "media_url": null,
    "contact_id": "2f1a…",
    "instance_id": "a71c…",
    "provider": "cloud_api"
  }
}
```

| الحقل | الوصف |
|---|---|
| `event` | اسم الحدث (وهو أيضًا في `X-WABEK-Event`) |
| `created_at` | وقت وقوع الحدث (ISO 8601) |
| `data` | حقول الحدث (أدناه) |

### حقول `data` لكل حدث

| الحدث | الحقول |
|---|---|
| `message_received` | `message_id`، `id`، `from`، `name`، `message`، `type`، `media_url`، `contact_id`، `instance_id`، `provider` (`cloud_api` / `wa_web`) |
| `message_sent` | `message_id`، `id`، `to`، `message`، `type`، `method` (`text` / `template` / `wa_web` / `media`)، `source` (`api`، `campaign`، `chatbot`، `automation`، `live_chat`، …)، `template`، `contact_id`، `campaign_id`، `instance_id` |
| `message_status` | `message_id`، `id`، `status` (`delivered` / `read` / `failed`)، `to`، `contact_id`، `campaign_id`، `instance_id`، `error` (`{code, message}` عند الفشل فقط) |
| `contact_created` | `contact_id`، `phone`، `name`، `email`، `tags`، `source` (`dashboard` / `api` / `inbound_message`) |
| `campaign_completed` | `campaign_id`، `name`، `status`، `total`، `sent`، `failed`، `completed_at` |
| `opt_out` / `opt_in` | `phone`، `contact_id`، `opted_out`، `source` (`keyword` / `dashboard` / `api`)، `instance_id` |
| `chatbot_triggered` | `flow_id`، `flow_name`، `trigger_type`، `from`، `message`، `instance_id` |
| `link_clicked` | `link_id`، `short_code`، `url`، `clicked_at` |

للإرسال التجريبي (زر **Test**) الترويسات والغلاف نفسها مع الحقل `"test": true`.

## التحقق من التوقيع

لكل اشتراك سرّ خاص به (`whsec_…`) يُعرض **مرة واحدة** عند إنشاء الـ webhook. استخدم زر **🔑 Secret** في صفحة Integrations لتوليد سرّ جديد (يتوقف السرّ القديم فورًا). للـ webhooks التي أُنشئت قبل إضافة التوقيع سرّ أيضًا؛ ولّد سرًّا جديدًا لتطّلع عليه.

التوقيع هو HMAC-SHA256 بالترميز الست عشري للطابع الزمني، ثم نقطة، ثم جسم الطلب **الخام**:

```
X-WABEK-Signature: sha256=hex( HMAC_SHA256(secret, X-WABEK-Timestamp + "." + raw_body) )
```

1. اقرأ الجسم الخام قبل تحليل JSON.
2. أعد حساب التوقيع وقارنه بمقارنة ثابتة الزمن.
3. ارفض الطلبات التي يبعد `X-WABEK-Timestamp` فيها أكثر من 5 دقائق عن ساعتك (حماية من إعادة الإرسال).
4. استخدم `X-WABEK-Delivery` لتجاهل تسليم عالجته من قبل (إعادة المحاولة تستخدم المعرّف نفسه).

```javascript
// Node.js / Express
import crypto from "node:crypto";
import express from "express";

const app = express();

app.post("/hooks/wabek", express.raw({ type: "application/json" }), (req, res) => {
  const ts = req.get("X-WABEK-Timestamp") || "";
  const sig = req.get("X-WABEK-Signature") || "";
  const expected = "sha256=" + crypto
    .createHmac("sha256", process.env.WABEK_WEBHOOK_SECRET)
    .update(`${ts}.${req.body}`)
    .digest("hex");
  const ok = sig.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return res.sendStatus(401);

  const event = JSON.parse(req.body.toString("utf8"));
  res.sendStatus(204);               // answer fast, process afterwards
  console.log(event.event, event.data);
});

app.listen(3000);
```

```php
<?php
$raw    = file_get_contents('php://input');
$ts     = $_SERVER['HTTP_X_WABEK_TIMESTAMP'] ?? '';
$sig    = $_SERVER['HTTP_X_WABEK_SIGNATURE'] ?? '';
$secret = getenv('WABEK_WEBHOOK_SECRET');

$expected = 'sha256=' . hash_hmac('sha256', $ts . '.' . $raw, $secret);
if (!hash_equals($expected, $sig) || abs(time() - (int) $ts) > 300) {
    http_response_code(401);
    exit;
}
$event = json_decode($raw, true);
http_response_code(204);
error_log('WABEK ' . $event['event']);
```

```python
import hashlib, hmac, json, os, time
from flask import Flask, abort, request

app = Flask(__name__)

@app.post("/hooks/wabek")
def wabek_hook():
    raw = request.get_data()                       # raw bytes
    ts = request.headers.get("X-WABEK-Timestamp", "")
    sig = request.headers.get("X-WABEK-Signature", "")
    mac = hmac.new(os.environ["WABEK_WEBHOOK_SECRET"].encode(), f"{ts}.".encode() + raw, hashlib.sha256)
    if not hmac.compare_digest("sha256=" + mac.hexdigest(), sig) or abs(time.time() - int(ts or 0)) > 300:
        abort(401)
    event = json.loads(raw)
    print(event["event"], event["data"])
    return "", 204
```

## سلوك التسليم

| الخاصية | القيمة |
|---|---|
| البروتوكول | `https://` فقط، إلى عنوان عام (يُتحقق منه في كل تسليم وكل إعادة توجيه) |
| المهلة | 5 ثوانٍ |
| النجاح | أي استجابة `2xx` |
| إعادة المحاولة | يُعاد التسليم الفاشل بفواصل متزايدة — نحو 1 و5 و15 و60 و180 دقيقة — حتى 6 محاولات إجمالًا، بمعرّف `X-WABEK-Delivery` نفسه |
| الحد الأقصى | 20 رابطًا لكل حدث |
| حجم الاستجابة المقروءة | حتى 64 كيلوبايت |

أعد استجابة `2xx` بسرعة، ونفّذ المعالجة الثقيلة في الخلفية. قد يصل التسليم أكثر من مرة أو بغير ترتيب، فاجعل معالجتك متساوية الأثر (idempotent).

## اختبار الرابط

اضغط **🧪 Test** بجوار الـ webhook: ترسل WABEK حمولة تجريبية موقّعة من خوادمها وتُظهر هل أجاب رابطك بـ `2xx`. والأمر نفسه متاح عبر الواجهة التي تستخدمها لوحة التحكم:

```bash
# يتطلب جلسة لوحة التحكم
curl -X POST https://waabek.com/api/webhooks/zapier \
  -H "Authorization: Bearer $WABEK_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "action": "test", "id": "<webhook id>" }'
```
