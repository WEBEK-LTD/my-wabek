---
title: "API key security"
description: "How WABEK stores API keys, and best practices for protecting and rotating them."
section: security
order: 1
slug: security/api-keys
---

# API key security

## How keys are stored

| | Named keys (`wbk_...`) | Default key |
|---|---|---|
| Storage | Only the **SHA-256 hash** is stored, never the key itself | Stored on the account record; the account owner can reveal it |
| Display | Once, at creation; afterwards only the first 12 characters are shown | Can be revealed and copied on the **API Keys** page |
| Revocation | Immediate, from the **API Keys** page | — |
| Usage tracking | Last-used date is shown | — |

- Keys are compared in constant time.
- Only the account owner can manage and view keys; team members cannot.
- Each sub-account has its own keys, and one account's key never reaches another account's data.

> **Note:** Because the default key can be revealed, we recommend **named keys** for integrations, keeping the default key for testing only.

## Best practices

### Never put the key in front-end code

Any key that reaches a browser or mobile app can be extracted by any user. Call WABEK from your server only:

```
Browser ──► Your server (holds the key) ──► https://waabek.com/api/v1/...
```

| ❌ Don't | ✅ Do |
|---|---|
| Put the key in front-end JavaScript or HTML | Keep it in a server environment variable |
| Commit it to a Git repository | Use a secrets manager, or an `.env` file excluded from Git |
| Send it in the URL as `?api_key=` | Send it in the `X-API-Key` header |
| Share one key across all integrations | Use a separate named key per integration |
| Paste it into support tickets or chat | Share only the first 12 characters when you need to identify it |

### Rotating keys

1. Create a new named key.
2. Update the integration to use the new key, and confirm requests succeed.
3. Revoke the old key on the **API Keys** page.

Rotate keys immediately if someone with access leaves the team, or if you suspect a leak.

### Protect your own receiving endpoints

- Always use HTTPS.
- Secure [outgoing webhook](/docs/api/outgoing-webhooks) URLs with a secret token in the URL.
- Rate-limit verification-code requests on your server, per number and per user.

## Your WABEK account

- Turn on [two-factor authentication](/docs/getting-started/create-account).
- Review **Trusted Devices** regularly and remove unknown devices.
- Give teammates the lowest role they need. See [Team and roles](/docs/guides/team-roles).
