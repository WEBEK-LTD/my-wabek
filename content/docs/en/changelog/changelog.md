---
title: "Changelog"
description: "User- and developer-visible changes in each WABEK release."
section: changelog
order: 1
slug: changelog/changelog
---

# Changelog

## November 2026

### Behaviour changes in this update

- **API access follows the plan.** `/api/v1/*` and `/api/gateway/whatsapp` require a plan with API access; otherwise `403` `plan_no_api`.
- **API key permissions are enforced:** `send`, `contacts:read`, `contacts:write`, `otp`. Existing keys keep full access. See [API key security](/docs/security/api-keys).
- **Team roles are enforced on the server.** Viewers are read-only; agents can work in the inbox, contacts and quick replies only. See [Team and roles](/docs/guides/team-roles).
- **No substitute template outside the 24-hour window.** Plain-text sends (Trigger, Gateway, Wix, WHMCS webhook, automations) to a Cloud API recipient outside the window now fail with `outside_window` instead of delivering an unrelated generic template.
- **Rate limits per API key** (100 per minute), shared across servers, with a `Retry-After` header on `429`.
- **Plan limits** for contacts (`max_contacts`) and sub-accounts (`max_sub_accounts`) are applied when creating or importing.

### New

- Outgoing webhooks for every listed event, signed with `X-WABEK-Signature` and retried on failure. See [Outgoing webhooks](/docs/api/outgoing-webhooks).
- STOP / START keywords (Arabic and English) handled automatically. See [Consent and opt-out](/docs/security/consent-opt-out).
- Campaigns send to the selected segment, keep the template's real language (Arabic templates work), and map template variables per contact.
- Opt-in automations and First Message chatbot flows now trigger as described.
- The WHMCS webhook sends Arabic or English texts (`lang`) and reports failed sends.

### New design

- A new look for the website and dashboard, with an updated visual identity and logo.
- Completely new documentation in Arabic and English that reflects how the platform actually behaves.

### API keys in headers

- The supported way to send an API key is now a header: `X-API-Key: <key>` or `Authorization: Bearer <key>`.
- Sending the key in the URL (`?api_key=` or `?key=`) or in the request body is **deprecated**. It still works for now for existing installs and may be disabled later. See [Authentication](/docs/api/authentication).
- Named keys are stored hashed and are shown only once, when created.
- The account's default key is no longer loaded into the browser automatically, and is shown to the account owner only on request.

**What you need to do:** if you have an integration that puts the key in the URL (such as older WHMCS, Digits or Wix Automations setups), move it to the header.

### Security improvements

- Hardened sign-in, sessions and team invitations; invitations now expire after 7 days.
- Stronger isolation of each account's data from other accounts.
- Rate limits on API and sign-in endpoints.
- Source verification for incoming notifications from Meta and Wix.
- Safer outgoing webhook URLs: only public `https://` URLs are accepted.
- Monthly message limit, opt-out and block checks before sending from the main channels.

### WordPress plugin and WHMCS addon

- The WordPress/WooCommerce plugin and the WHMCS addon have been rewritten from scratch and send the key in a header.
- Simpler setup: paste the key, test the connection, choose the number, enable events, and customize message texts with merge fields.
- Download from **Integrations → Modules**. See [WordPress](/docs/integrations/wordpress) and [WHMCS](/docs/integrations/whmcs).

### Messages outside the 24-hour window

- `POST /api/v1/send` no longer sends the generic notification template outside the window; it sends the template you specify (or the default marketing template with your message text), or returns `422` with a clear explanation of the failure. See [24-hour window](/docs/getting-started/messaging-window).
- On Cloud API numbers, verification codes are always sent through an Authentication template.
