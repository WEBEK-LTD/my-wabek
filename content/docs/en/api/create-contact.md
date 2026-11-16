---
title: "Create or update a contact"
description: "POST /api/v1/contacts — add a new contact, or update an existing one with the same number."
section: api
order: 6
slug: api/create-contact
---

# Create or update a contact

```
POST /api/v1/contacts
```

Creates a contact, or updates it if the same number already exists in your account (upsert).

## Headers

| Header | Value |
|---|---|
| `X-API-Key` | Your key (or `Authorization: Bearer <key>`) |
| `Content-Type` | `application/json` |

## Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `phone` | string | Yes | Phone number. `to` is accepted as an alias. |
| `name` | string | No | Name |
| `email` | string | No | Email |
| `tags` | string[] | No | Tags |

> **Warning:** When updating an existing contact, its tags are replaced with the list you send. If you omit `tags`, the contact's tags are cleared. Always send the full list of tags.

> **Note:** The number is stored exactly as you send it, without normalization. Send numbers in one consistent format (digits only with country code, no `+` or spaces), or the same customer may end up as two contacts.

## Response

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

## Errors

| Status | `error` | Cause |
|---|---|---|
| `400` | `phone required` | Missing number |
| `401` | `Invalid API key` | Invalid key |
| `429` | `Too many requests` | Request limit exceeded |
| `500` | `Failed to save contact` | Could not save |

## Examples

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
