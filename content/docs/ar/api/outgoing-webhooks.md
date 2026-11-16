---
title: "Webhooks الصادرة"
description: "الإشعارات التي ترسلها WABEK إلى رابطك، وصيغتها، وكيف تؤمّن نقطة الاستقبال."
section: api
order: 13
slug: api/outgoing-webhooks
---

# Webhooks الصادرة

ترسل WABEK طلب `POST` إلى رابط HTTPS تسجّله عند وقوع حدث. تُدار الروابط من **Integrations ← Webhooks ← Outgoing Webhooks** في لوحة التحكم.

## الأحداث المُرسلة حاليًا

| الحدث | متى يُرسل |
|---|---|
| `message_sent` | بعد نجاح إرسال رسالة عبر [`POST /api/webhooks/trigger`](/docs/api/trigger) |

> **ملاحظة:** تعرض القائمة في لوحة التحكم أحداثًا أخرى (`message_received`، `contact_created`، `campaign_completed`، `chatbot_triggered`، `link_clicked`). يمكن تسجيلها، لكنها **لا تُرسل** في هذا الإصدار. سيُحدَّث هذا المرجع عند تفعيلها.

## الطلب

```
POST <your target_url>
Content-Type: application/json
```

```json
{
  "to": "966500000000",
  "message": "Thanks for filling in our form!",
  "timestamp": "2026-11-16T10:00:00.000Z"
}
```

| الحقل | النوع | الوصف |
|---|---|---|
| `to` | string | الرقم الذي أُرسلت إليه الرسالة، كما ورد في طلب Trigger |
| `message` | string | نص الرسالة |
| `timestamp` | string (ISO 8601) | وقت الإرسال |

## سلوك التسليم

| الخاصية | القيمة |
|---|---|
| البروتوكول | `https://` فقط، إلى عنوان عام |
| المهلة | 5 ثوانٍ |
| إعادة المحاولة | لا توجد؛ يُرسل الإشعار مرة واحدة |
| الحد الأقصى | 20 رابطًا لكل حدث |
| حجم الاستجابة المقروءة | حتى 64 كيلوبايت |

أعد استجابة `2xx` بسرعة، ونفّذ المعالجة الثقيلة لاحقًا في الخلفية.

## التحقق من المصدر

> **تحذير:** لا تحتوي الإشعارات حاليًا على ترويسة توقيع (HMAC). أي وثيقة سابقة تذكر ترويسة `X-WABEK-Signature` لا تنطبق على هذا الإصدار.

لتأمين نقطة الاستقبال:

1. أضف رمزًا سريًا طويلًا وعشوائيًا إلى الرابط عند تسجيله، مثل:

   ```
   https://example.com/hooks/wabek?token=9f3c...e71a
   ```

2. في نقطتك ارفض أي طلب لا يحمل الرمز الصحيح، بمقارنة ثابتة الزمن.
3. تحقّق من أن جسم الطلب JSON يحتوي على الحقول المتوقعة.
4. لا تنفّذ إجراءات حساسة (مثل الدفع) بناءً على الإشعار وحده.

```javascript
// Express example
import crypto from "node:crypto";
import express from "express";

const app = express();
app.use(express.json());

app.post("/hooks/wabek", (req, res) => {
  const expected = Buffer.from(process.env.WABEK_HOOK_TOKEN);
  const given = Buffer.from(String(req.query.token || ""));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.sendStatus(401);
  }
  const { to, message, timestamp } = req.body || {};
  if (typeof to !== "string" || typeof message !== "string") return res.sendStatus(400);
  res.sendStatus(204);
  // Process asynchronously after responding.
  console.log("WABEK message_sent", to, timestamp);
});

app.listen(3000);
```

```php
<?php
$expected = getenv('WABEK_HOOK_TOKEN');
$given    = $_GET['token'] ?? '';
if (!is_string($given) || !hash_equals($expected, $given)) {
    http_response_code(401);
    exit;
}
$event = json_decode(file_get_contents('php://input'), true);
if (!is_array($event) || !isset($event['to'], $event['message'])) {
    http_response_code(400);
    exit;
}
http_response_code(204);
error_log('WABEK message_sent to ' . $event['to']);
```

```python
import hmac
import os
from flask import Flask, abort, request

app = Flask(__name__)

@app.post("/hooks/wabek")
def wabek_hook():
    given = request.args.get("token", "")
    if not hmac.compare_digest(given, os.environ["WABEK_HOOK_TOKEN"]):
        abort(401)
    event = request.get_json(silent=True) or {}
    if not isinstance(event.get("to"), str) or not isinstance(event.get("message"), str):
        abort(400)
    print("WABEK message_sent", event["to"], event.get("timestamp"))
    return "", 204
```

## اختبار الرابط

أرسل رسالة تجريبية عبر [Trigger](/docs/api/trigger) وتحقّق من وصول الإشعار إلى نقطتك:

```bash
curl -X POST https://waabek.com/api/webhooks/trigger \
  -H "X-API-Key: $WABEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "to": "966500000000", "message": "Webhook test" }'
```
