---
title: "إنشاء جهة اتصال أو تحديثها"
description: "POST /api/v1/contacts — إضافة جهة اتصال جديدة، أو تحديث جهة موجودة بالرقم نفسه."
section: api
order: 6
slug: api/create-contact
---

# إنشاء جهة اتصال أو تحديثها

```
POST /api/v1/contacts
```

ينشئ جهة اتصال، أو يحدّثها إذا كان الرقم نفسه موجودًا في حسابك (Upsert).

## الترويسات

| الترويسة | القيمة |
|---|---|
| `X-API-Key` | مفتاحك (أو `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` |

## جسم الطلب

| الحقل | النوع | إلزامي | الوصف |
|---|---|---|---|
| `phone` | string | نعم | رقم الهاتف. يُقبل `to` بديلًا. |
| `name` | string | لا | الاسم |
| `email` | string | لا | البريد الإلكتروني |
| `tags` | string[] | لا | الوسوم |

> **تحذير:** عند تحديث جهة موجودة، تُستبدل الوسوم بالقائمة التي ترسلها. إذا لم ترسل `tags` تُفرَّغ وسوم الجهة. أرسل دائمًا القائمة الكاملة للوسوم.

> **ملاحظة:** يُخزَّن الرقم كما ترسله دون تنسيق. أرسل الأرقام بصيغة موحّدة (أرقام فقط مع رمز الدولة، بلا `+` أو مسافات)، وإلا قد تنشأ جهتان للعميل نفسه.

## الاستجابة

`200 OK`

```json
{
  "contact": {
    "id": "b6d8f0c2-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
    "phone": "966500000000",
    "name": "Sara",
    "email": "sara@example.com",
    "tags": ["vip"],
    "is_blocked": false,
    "opted_out": false,
    "created_at": "2026-11-16T10:00:00.000Z",
    "updated_at": "2026-11-16T10:00:00.000Z"
  }
}
```

## الأخطاء

| الحالة | `error` | السبب |
|---|---|---|
| `400` | `phone required` | الرقم مفقود |
| `401` | `Invalid API key` | مفتاح غير صالح |
| `429` | `Too many requests` | تجاوزت حد الطلبات |
| `500` | `Failed to save contact` | تعذّر الحفظ |

## أمثلة

```bash
curl -X POST https://waabek.com/api/v1/contacts \
  -H "X-API-Key: $WABEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "966500000000",
    "name": "Sara",
    "email": "sara@example.com",
    "tags": ["vip"]
  }'
```

```javascript
const res = await fetch("https://waabek.com/api/v1/contacts", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.WABEK_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    phone: "966500000000",
    name: "Sara",
    email: "sara@example.com",
    tags: ["vip"],
  }),
});
const { contact, error } = await res.json();
console.log(res.ok ? contact.id : error);
```

```php
<?php
$ch = curl_init('https://waabek.com/api/v1/contacts');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'X-API-Key: ' . getenv('WABEK_API_KEY'),
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS     => json_encode([
        'phone' => '966500000000',
        'name'  => 'Sara',
        'email' => 'sara@example.com',
        'tags'  => ['vip'],
    ]),
]);
$data = json_decode(curl_exec($ch), true);
curl_close($ch);

echo $data['contact']['id'] ?? $data['error'];
```

```python
import os
import requests

resp = requests.post(
    "https://waabek.com/api/v1/contacts",
    headers={"X-API-Key": os.environ["WABEK_API_KEY"]},
    json={
        "phone": "966500000000",
        "name": "Sara",
        "email": "sara@example.com",
        "tags": ["vip"],
    },
    timeout=30,
)
data = resp.json()
print(data["contact"]["id"] if resp.ok else data["error"])
```
