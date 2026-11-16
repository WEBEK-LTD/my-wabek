---
title: "24-hour window and approved templates"
description: "When you can send free text, when you need a Meta-approved template, and how WABEK handles each case."
section: getting-started
order: 4
slug: getting-started/messaging-window
---

# 24-hour window and approved templates

This rule applies to **Cloud API** numbers only, and it is the most important thing to understand before sending.

## The rule

- When a customer messages your number, a **customer-service window** of **24 hours** opens from the time of that message.
- **Inside the window:** you can send any free text or media.
- **Outside the window:** Meta only accepts an **approved template**. Meta rejects free text with error `131047`.
- Every new message from the customer restarts the clock.

```
Customer sends a message ──► [ 24 hours: free text allowed ] ──► after that: approved templates only
```

> **Note:** The window belongs to the sending number. If the customer messaged number A, that does not open a window on number B. WABEK computes the window from the customer's last inbound message to that same number.

**WhatsApp Web** numbers are not subject to this rule, but they carry a ban risk. See [Connect a WhatsApp number](/docs/getting-started/connect-number).

## How WABEK behaves in each place

| Where | Inside the window | Outside the window |
|---|---|---|
| Inbox | Your text is sent | Sending is refused with a message saying the customer is outside the 24-hour window and must message you first |
| Campaigns | Always sent as the template you choose | Same |
| `POST /api/v1/send` | Your text is sent | Tries to send a template (see below); if that fails, returns `422` |
| `/api/gateway/whatsapp`, `/api/webhooks/trigger`, Wix, WHMCS webhook, automations | Your text is sent | Nothing is sent: `outside_window` (Gateway sends a code it finds in the text through your Authentication template) |
| Verification codes (OTP) | Through an Authentication template | Through an Authentication template |

> **Warning:** WABEK never sends a generic template in place of your text. On `/api/gateway/whatsapp`, `/api/webhooks/trigger`, the Wix and WHMCS webhooks and automations, a customer outside the window does not receive the message and the request reports `outside_window`. For important messages outside the window, use `POST /api/v1/send` with the `template` field.

## Sending a template through the API

With `POST /api/v1/send`, if the recipient is outside the window:

1. If you send `template` (the template name) and `template_params` (an object of named parameters, or an array for `{{1}}`, `{{2}}` …), WABEK sends that template with your parameters.
2. If you do not send `template`, WABEK tries the platform's default marketing template, putting your `message` text into the `offer_details` parameter and the customer name into `customer_name`.
3. If `message` contains a numeric code of 4 to 8 digits, it is treated as a verification code and sent through an Authentication template.

The language in `template_language` is tried first, then `ar`, `en` and `en_US`. See [Send a message](/docs/api/send-message).

## Templates: what you need to know

- Templates are created and approved in **Meta Business Manager**, not inside WABEK.
- Each template has a **category**: Marketing, Utility or Authentication. Pick the right one; a wrong category is a common rejection reason.
- Variables are written as `{{1}}` (positional) or `{{customer_name}}` (named).
- WABEK only lists approved templates (`APPROVED`) when you create a campaign.

### The verification-code template

To send OTP codes through the Cloud API you need an approved **Authentication** template on your account. WABEK looks for the template configured on the platform, then for the common names `wabek_otp`, `digits`, `otp_verification` and `authentication`, in the languages `ar`, `en`, `en_US` and `en_GB`.

> **Note:** If you have no approved Authentication template under one of these names, verification codes will not reach customers outside the window. Contact support to find out the template name configured on the platform.

## Common errors

| Code | Meaning | Fix |
|---|---|---|
| `131047` | The customer is outside the 24-hour window | Send an approved template |
| `132001` | No template with that name or language | Check the name and language in Meta |
| `132000` | Parameter count does not match the template | Match the variables to the template body |

More in [Troubleshooting](/docs/faq/troubleshooting).
