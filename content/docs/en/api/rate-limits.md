---
title: "Rate limits"
description: "How many requests each endpoint allows, how to handle 429 errors, and the other limits that affect sending."
section: api
order: 2
slug: api/rate-limits
---

# Rate limits

## Request limit on `/api/v1/*`

| Scope | Limit |
|---|---|
| Per IP address, per path | **100 requests** per **60 seconds** |

- Each path is counted separately: requests to `/api/v1/send` do not count against `/api/v1/contacts`.
- The limit is applied **before** authentication, so requests rejected with 401 count too.
- Treat 100 as an upper bound and design your integration to stay comfortably below it.

When you exceed the limit:

```json
{ "error": "Too many requests", "retryAfter": 42 }
```

HTTP status: `429`. `retryAfter` is in seconds.

> **Note:** Do not rely on a `Retry-After` header being present; use the `retryAfter` field in the response body.

## Retrying

1. On `429`, wait for `retryAfter` seconds, then retry.
2. On `502` or `500`, retry with increasing delays (for example 2, then 4, then 8 seconds) and a maximum number of attempts.
3. **Do not retry** on `400`, `401`, `403`, `404` or `422`; fix the request first.

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
      await new Promise(r => setTimeout(r, (data.retryAfter || 60) * 1000));
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

## Other endpoints

No separate request limit currently applies to `/api/gateway/whatsapp`, `/api/webhooks/trigger` or `/api/webhooks/wix`. The limits below still apply to every endpoint.

## Limits that affect sending

| Limit | Source | Effect |
|---|---|---|
| Monthly message limit | Your plan | `403` with code `plan_limit` |
| Meta limits for the number | Meta (based on the number's quality and tier) | Meta rejection shown in `detail` (for example `130429`) |
| WhatsApp Web protections | WhatsApp | Fast or heavy sending can get the number banned |

> **Warning:** On WhatsApp Web numbers, do not send large batches quickly through the API. Spread messages over time, or use [campaigns](/docs/guides/campaigns) with a delay between messages.
