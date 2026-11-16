---
title: "Troubleshooting"
description: "Fixes for common problems: messages not arriving, error 131047, rejected templates, disconnected numbers and expired QR codes."
section: faq
order: 1
slug: faq/troubleshooting
---

# Troubleshooting

## Messages are not arriving

Work through these steps in order:

1. **Number status:** open **WhatsApp** and check that the status is **connected**.
2. **Number format:** digits only with the country code, no `+`, leading zeros or spaces (for example `966500000000`).
3. **24-hour window:** on the Cloud API, has the customer messaged you in the last 24 hours? If not, an approved template is required. See [24-hour window](/docs/getting-started/messaging-window).
4. **Contact state:** is the contact blocked or opted out?
5. **Plan limit:** have you reached the monthly message limit? Check **Billing**.
6. **Message log:** open the conversation or the campaign details to read the failure reason.
7. **API response:** read the `code` and `detail` fields. See [Errors](/docs/api/errors).

## Error 131047 (outside the window)

**Meaning:** more than 24 hours have passed since the customer's last message to this number, and Meta does not accept free text.

**Fix:**

- In the inbox: wait for the customer to message you.
- In the API: send `template` and `template_params` with [Send a message](/docs/api/send-message).
- In campaigns: campaigns always use templates; make sure you chose an approved one.

> **Note:** The window is per number. A customer's message to your other number does not open the window on this one.

## Error 422 from `/api/v1/send`

The customer is outside the window and every template attempt failed. Read `attempts` in the response for the reason behind each attempt. Common causes:

| Error in `attempts` | Fix |
|---|---|
| `132001` template does not exist | Check the exact name, and pass the template's approved language in `template_language` (otherwise `ar`, `en`, `en_US` are tried) |
| `132000` parameter count mismatch | Match the `template_params` keys to the template's variables |
| Template not approved | Wait for approval, or edit the template and resubmit it |

## Verification codes are not arriving

- On the Cloud API an approved **Authentication** template is required. WABEK looks for the names `wabek_otp`, `digits`, `otp_verification` and `authentication` in `ar`, `en`, `en_US` and `en_GB`, plus the name configured on the platform. If none exists on your account, contact support.
- Check that the code is 4 to 8 digits when using the `code` field.
- Codes are valid for a limited time (10 minutes by default) and for five attempts.

## Meta rejected the template

Common reasons:

- **Wrong category:** promotional content in a Utility or Authentication template.
- **Bad variables:** a variable at the very start or end of the text, consecutive variables with no text between them, or non-sequential numbering (`{{1}}` then `{{3}}`).
- **Prohibited content:** products or services banned by the Commerce Policy.
- **Vagueness:** text too generic to show its purpose.

Edit the template in Meta Business Manager and resubmit it. See [Meta policies](/docs/security/meta-policies).

## The number is disconnected

### WhatsApp Web

1. Check that the phone is online and WhatsApp is running on it.
2. In WhatsApp on the phone, open **Linked devices** and check that the session is still there.
3. In WABEK, click **Reconnect** and scan the new QR code.

If the number disconnected after heavy sending and the phone shows a ban message, WhatsApp has most likely banned the number. WABEK cannot lift a ban. See [WhatsApp Web risks](/docs/getting-started/connect-number).

### Cloud API

- **Error `190`:** the access token expired or was revoked. Reconnect with **Connect with Meta**, or update the permanent token in the manual setup.
- In Meta Business Manager, check that the number is still registered and the WhatsApp Business Account is not restricted.

## The QR code expired or does not appear

- QR codes are valid for a short time. Click **Show QR Code** or **Reconnect** to generate a new one, and scan it right away.
- If "Generating QR code…" stays for a long time, reload the page and try again after a minute.
- Use WhatsApp's own scanner (Linked devices → Link a device), not the phone's regular camera.

## Error 401 "Invalid API key"

- Make sure the whole key was copied, with no spaces or line breaks.
- Check on the **API Keys** page that the key has not been revoked.
- On `/api/webhooks/trigger`, use the `X-API-Key` header specifically.
- If you send the key in the URL, move it to the header; the old method may be disabled.

## Error 404 "No connected WhatsApp instance"

There is no connected number on your account, or the `instance_id` you sent is not connected or does not belong to your account. Copy the **Instance ID** from the **WhatsApp** page.

## Error 403 with code `plan_limit`

You reached the monthly message limit. The counter resets at the start of the calendar month, or you can upgrade from **Billing**.

## A campaign is stuck on "scheduled"

Large campaigns are sent in batches; between batches the status briefly returns to `scheduled` and resumes within about a minute. If it stays that way for long, check that the number is connected, then click **Start**.
