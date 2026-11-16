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
| Per API key (all `/api/v1/*` actions together) | **100 requests** per **60 seconds** |
| Per IP address, per path, before authentication | **300 requests** per **60 seconds** |

- The per-key limit counts every action of that key together. Two keys of the same account have separate limits; a session (dashboard) call is counted per account.
- The per-IP ceiling is applied **before** authentication, so requests rejected with 401 count too.
- Limits are shared across all WABEK servers.
- Treat 100 as an upper bound and design your integration to stay comfortably below it.

When you exceed a limit:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

```json
{ "error": "Too many requests", "code": "rate_limited", "retryAfter": 60 }
```

`Retry-After` (header) and `retryAfter` (body) are in seconds and always present on `429`.

## Retrying

1. On `429`, wait for the `Retry-After` header (or `retryAfter`) seconds, then retry.
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
      const wait = Number(res.headers.get("Retry-After")) || data.retryAfter || 60;
      await new Promise(r => setTimeout(r, wait * 1000));
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

`/api/gateway/whatsapp` has the same limits as `/api/v1/*` (100 per minute per key, counted separately from `/api/v1`). No separate request limit currently applies to `/api/webhooks/trigger` or `/api/webhooks/wix`. The limits below still apply to every endpoint.

## Limits that affect sending

| Limit | Source | Effect |
|---|---|---|
| Monthly message limit | Your plan | `403` with code `plan_limit` |
| Meta limits for the number | Meta (based on the number's quality and tier) | Meta rejection shown in `detail` (for example `130429`) |
| WhatsApp Web protections | WhatsApp | Fast or heavy sending can get the number banned |

> **Warning:** On WhatsApp Web numbers, do not send large batches quickly through the API. Spread messages over time, or use [campaigns](/docs/guides/campaigns) with a delay between messages.
