---
title: "Authentication"
description: "Create an API key and send it in a request header; base URL and the authentication methods each endpoint supports."
section: api
order: 1
slug: api/authentication
---

# Authentication

Every API request is authenticated with an API key tied to your account. Each key grants full access to your account's API endpoints, so treat it like a password.

## Base URL

```
https://waabek.com
```

> **Note:** If you use [white label](/docs/guides/white-label) with a custom domain, check the correct address on the **API Keys** page; the command examples there are built from the domain you opened the dashboard on.

## Getting a key

The **API Keys** page is available to the account owner only and requires a plan that includes **API Access**.

| Key type | Description |
|---|---|
| **Default API Key** | Generated automatically with the account. You can reveal and copy it on the page. |
| **Named API Keys** | Keys you create per integration; they start with `wbk_`. The key is shown **only once**, when created. |

To create a named key:

1. Open **API Keys** and click **New Key**.
2. Enter a name that describes its use, for example `WooCommerce Production`.
3. Click **Create Key**, then copy the key immediately and store it somewhere safe.

> **Warning:** Use a separate named key for each integration. That way you can revoke one leaked key without breaking your other integrations. Each key shows when it was last used.

To revoke a key, click the delete icon next to it. The key stops working immediately.

## Sending the key

Send the key in a request **header**, in either form:

```
X-API-Key: YOUR_API_KEY
```

```
Authorization: Bearer YOUR_API_KEY
```

Example:

```bash
curl https://waabek.com/api/v1/contacts \
  -H "X-API-Key: $WABEK_API_KEY"
```

## Key in the URL (deprecated)

For compatibility with older installs, some endpoints still accept the key in the URL (`?api_key=` or `?key=`), and the gateway endpoint also accepts `api_key` in the request body.

> **Warning:** This method is **deprecated** and may be disabled without prior notice. URLs end up in server logs, browser history and monitoring tools, which makes keys easy to leak. Move your integrations to the header. The platform logs a warning whenever a key arrives in the URL.

## Support per endpoint

| Endpoint | `X-API-Key` | `Authorization: Bearer` | `?api_key=` (deprecated) |
|---|---|---|---|
| `/api/v1/*` | ✅ | ✅ | ✅ |
| `/api/gateway/whatsapp` | ✅ | ✅ | ✅ (and `api_key` in the body) |
| `/api/webhooks/wix` | ✅ | ✅ | ✅ |
| `/api/webhooks/trigger` | ✅ | ❌ | ❌ |

## Response when authentication fails

```json
{ "error": "Invalid API key" }
```

HTTP status: `401`. Check that the key was copied in full with no spaces, that it has not been revoked, and that the account is active.

## CORS

`/api/v1/*` and `/api/gateway/whatsapp` accept requests from any origin, but **do not call them from your users' browsers**: your key would be visible to every visitor. Call the API from your server. See [API key security](/docs/security/api-keys).
