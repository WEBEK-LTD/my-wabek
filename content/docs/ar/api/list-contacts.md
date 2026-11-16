---
title: "عرض جهات الاتصال"
description: "GET /api/v1/contacts — استرجاع جهات الاتصال في حسابك."
section: api
order: 5
slug: api/list-contacts
---

# عرض جهات الاتصال

```
GET /api/v1/contacts
```

يعيد جهات الاتصال في حسابك، بحد أقصى **100 جهة** في الاستجابة.

> **ملاحظة:** لا تدعم هذه النقطة حاليًا الترقيم (Pagination) أو البحث أو الترتيب. إذا كان لديك أكثر من 100 جهة اتصال، فلن تحصل عليها كلها من هذه النقطة؛ استخدم **Export CSV** من لوحة التحكم.

## الترويسات

| الترويسة | القيمة |
|---|---|
| `X-API-Key` | مفتاحك (أو `Authorization: Bearer <key>`) |

## الاستجابة

`200 OK`

```json
{
  "contacts": [
    {
      "id": "b6d8f0c2-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
      "user_id": "0f9e8d7c-6b5a-4f3e-8d2c-1b0a9f8e7d6c",
      "phone": "966500000000",
      "name": "Sara",
      "email": "sara@example.com",
      "tags": ["vip", "riyadh"],
      "variables": {},
      "is_blocked": false,
      "opted_out": false,
      "last_seen": "2026-11-15T09:30:00.000Z",
      "created_at": "2026-10-01T12:00:00.000Z",
      "updated_at": "2026-11-15T09:30:00.000Z"
    }
  ]
}
```

| الحقل | النوع | الوصف |
|---|---|---|
| `id` | string (UUID) | معرّف جهة الاتصال |
| `phone` | string | رقم الهاتف كما خُزّن |
| `name` | string أو null | الاسم |
| `email` | string أو null | البريد |
| `tags` | string[] | الوسوم |
| `variables` | object | حقول مخصّصة تُستخدم في متغيرات الحملات |
| `is_blocked` | boolean | محظور |
| `opted_out` | boolean | ألغى اشتراكه |
| `last_seen` | string أو null | آخر نشاط |
| `created_at` / `updated_at` | string (ISO 8601) | تاريخ الإنشاء والتعديل |

قد تحتوي الاستجابة على حقول إضافية؛ تجاهل ما لا تحتاج إليه.

## الأخطاء

| الحالة | `error` |
|---|---|
| `401` | `Invalid API key` |
| `429` | `Too many requests` |

## أمثلة

```bash
curl https://waabek.com/api/v1/contacts \
  -H "X-API-Key: $WABEK_API_KEY"
```

```javascript
const res = await fetch("https://waabek.com/api/v1/contacts", {
  headers: { "X-API-Key": process.env.WABEK_API_KEY },
});
const { contacts } = await res.json();
console.log(contacts.length, "contacts");
```

```php
<?php
$ch = curl_init('https://waabek.com/api/v1/contacts');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => ['X-API-Key: ' . getenv('WABEK_API_KEY')],
]);
$data = json_decode(curl_exec($ch), true);
curl_close($ch);

foreach ($data['contacts'] ?? [] as $contact) {
    echo $contact['phone'] . ' ' . ($contact['name'] ?? '') . PHP_EOL;
}
```

```python
import os
import requests

resp = requests.get(
    "https://waabek.com/api/v1/contacts",
    headers={"X-API-Key": os.environ["WABEK_API_KEY"]},
    timeout=30,
)
resp.raise_for_status()
for contact in resp.json()["contacts"]:
    print(contact["phone"], contact.get("name"))
```
