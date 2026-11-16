---
title: "Errors"
description: "The error response format, what each HTTP status means, and the error codes each endpoint returns."
section: api
order: 3
slug: api/errors
---

# Errors

## Error format

Endpoints return errors as JSON. The `error` field is always present; other fields depend on the case:

```json
{
  "error": "Recipient has opted out",
  "code": "opted_out"
}
```

| Field | Type | Description |
|---|---|---|
| `error` | string | Short description of the error |
| `code` | string | A code you can rely on programmatically (on some errors) |
| `detail` | string | Extra detail, often the original error message from Meta |
| `attempts` | array | The template attempts that were tried (on `422` errors) |
| `retryAfter` | number | Seconds to wait before retrying (on `429` errors) |

> **Note:** Base your logic on the HTTP status and the `code` field, not on the `error` text; the text may change.

## HTTP statuses

| Status | Meaning | What to do |
|---|---|---|
| `200` | Success | — |
| `400` | A required field is missing or invalid | Fix the request |
| `401` | Missing or invalid key | Check the key |
| `403` | Sending is not allowed (plan limit, or the recipient opted out or is blocked) | Check `code` |
| `404` | No connected number, or unknown endpoint | Connect a number or fix the path |
| `405` | HTTP method not supported | Use the right method |
| `422` | Could not deliver outside the 24-hour window | Send a valid approved template |
| `429` | Request limit exceeded | Wait `retryAfter` |
| `500` | Internal error | Retry later |
| `502` | The WhatsApp provider rejected the message | Read `detail` |

## Send-blocking codes

All send endpoints return these with status `403`:

| `code` on `/api/v1` | `code` on `/api/gateway/whatsapp` | Meaning |
|---|---|---|
| `plan_limit` | `PLAN_LIMIT` | You reached your plan's monthly message limit |
| `opted_out` | `OPTED_OUT` | The recipient opted out in your account |
| `blocked` | `BLOCKED` | The recipient is blocked in your account |

## Error messages by endpoint

### `/api/v1/*`

| Status | `error` |
|---|---|
| 400 | `to and message required` |
| 400 | `phone required` |
| 400 | `otp_id and otp required` |
| 401 | `Invalid API key` |
| 403 | `Monthly message limit reached for your plan` / `Recipient has opted out` / `Recipient is blocked` |
| 404 | `No connected WhatsApp instance` |
| 404 | `Unknown action` |
| 422 | `Recipient is outside the 24-hour messaging window` |
| 422 | `Failed to deliver message outside the 24h window` |
| 422 | `Failed to deliver the verification code` |
| 500 | `Failed to send message` / `Failed to save contact` |
| 502 | `Failed to send message` (with `detail`) |

### `/api/gateway/whatsapp`

| Status | `code` | `error` |
|---|---|---|
| 400 | `MISSING_TO` | `Phone number required (to)` |
| 400 | `MISSING_MESSAGE` | `Message required (message)` |
| 401 | `UNAUTHORIZED` | `Invalid API key` |
| 403 | `PLAN_LIMIT` / `OPTED_OUT` / `BLOCKED` | The blocking reason |
| 404 | `NO_INSTANCE` | `No connected WhatsApp instance found` |
| 502 | `SEND_FAILED` | The failure reason |

### `/api/webhooks/trigger`

| Status | `error` |
|---|---|
| 400 | `to and message required` |
| 401 | `API key required` / `Invalid API key` |
| 403 | The blocking reason |
| 404 | `No connected WhatsApp instance` |
| 405 | `Method not allowed` |
| 502 | The failure reason |

### `/api/webhooks/wix`

| Status | `error` |
|---|---|
| 400 | `event field required. ...` |
| 401 | `Invalid or missing API key` |
| 403 | `Failed to send` with `code` |
| 404 | `No connected WhatsApp instance found` |
| 405 | `Method not allowed` |
| 502 | `Failed to send` |

## Common Meta errors

When Meta rejects a Cloud API message, its message appears in `detail`. The most common codes:

| Code | Meaning |
|---|---|
| `131047` | More than 24 hours since the customer's last message; a template is required |
| `132001` | No template with that name or language |
| `132000` | Template parameter count mismatch |
| `131026` | The message could not be delivered to this number |
| `130429` | Meta's sending rate limit was exceeded |
| `190` | The access token is expired or invalid |

See [Troubleshooting](/docs/faq/troubleshooting) for detailed fixes.
