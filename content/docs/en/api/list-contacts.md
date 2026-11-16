---
title: "List contacts"
description: "GET /api/v1/contacts — retrieve the contacts in your account."
section: api
order: 5
slug: api/list-contacts
---

# List contacts

```
GET /api/v1/contacts
```

Returns the contacts in your account, up to **100 contacts** per response.

> **Note:** This endpoint does not currently support pagination, search or sorting. If you have more than 100 contacts, you will not get all of them from this endpoint; use **Export CSV** in the dashboard.

## Headers

| Header | Value |
|---|---|
| `X-API-Key` | Your key (or `Authorization: Bearer <key>`) |

## Response

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

| Field | Type | Description |
|---|---|---|
| `id` | string (UUID) | Contact ID |
| `phone` | string | Phone number as stored |
| `name` | string or null | Name |
| `email` | string or null | Email |
| `tags` | string[] | Tags |
| `variables` | object | Custom fields used as campaign variables |
| `is_blocked` | boolean | Blocked |
| `opted_out` | boolean | Opted out |
| `last_seen` | string or null | Last activity |
| `created_at` / `updated_at` | string (ISO 8601) | Created and updated times |

The response may include additional fields; ignore the ones you do not need.

## Errors

| Status | `error` |
|---|---|
| `401` | `Invalid API key` |
| `429` | `Too many requests` |

## Examples

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
