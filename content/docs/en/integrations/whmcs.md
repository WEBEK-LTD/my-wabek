---
title: "WHMCS"
description: "Install the WABEK addon for WHMCS to send invoice, ticket and service notifications over WhatsApp."
section: integrations
order: 2
slug: integrations/whmcs
---

# WHMCS

The WABEK addon for WHMCS sends WhatsApp notifications to your clients on billing, support and service events.

## Requirements

- Admin access to WHMCS and access to the server files.
- A connected WhatsApp number in WABEK.
- An API key from your account (the API Keys page requires a plan that includes **API Access**).

## 1. Install

1. Download the addon from:

   ```
   https://waabek.com/downloads/wabek-whmcs-addon.zip
   ```

   or from **Integrations** → **Modules** tab in the dashboard.
2. Unzip it and upload the folder to `modules/addons/` in your WHMCS directory. <!-- verify against plugin -->
3. In WHMCS, open **System Settings → Addon Modules**, find WABEK and click **Activate**. <!-- verify against plugin -->
4. Click **Configure**, grant access to the admin role groups that need it, then save.

## 2. Connect your account

1. In WABEK, open **API Keys**, click **New Key**, and name it, for example `WHMCS Production`.
2. Copy the key right away; it is not shown again.
3. In the addon settings inside WHMCS, paste the key into the **API Key** field. <!-- verify against plugin -->
4. Click **Test Connection** and check that a success message appears. <!-- verify against plugin -->

> **Note:** The addon sends the key in a request header. Do not use old URLs that contain `?api_key=`.

## 3. Choose the number

Pick the sending number in the settings if you have more than one. <!-- verify against plugin -->

## 4. Enable events

Turn on the events you need, for example: <!-- verify against plugin -->

| Event | Example |
|---|---|
| Invoice created | Tell the client about a new invoice and the payment link |
| Invoice paid | Confirm the payment was received |
| Invoice overdue / payment reminder | Remind before or after the due date |
| Ticket opened / ticket reply | Keep the client updated on support |
| Service activated / service suspended | Tell the client about the service status |

## 5. Message templates

Each event has editable text that supports merge fields, such as: <!-- verify against plugin -->

| Merge field | Value |
|---|---|
| `{client_name}` | Client name |
| `{invoice_id}` | Invoice number |
| `{invoice_total}` | Invoice amount |
| `{due_date}` | Due date |
| `{ticket_id}` | Ticket number |
| `{service_name}` | Service name |

Example:

```
Hi {client_name}, invoice #{invoice_id} for {invoice_total} has been issued and is due on {due_date}.
```

## Client phone number

The notification goes to the phone number on the client's WHMCS profile. Make sure numbers are saved in international format with the country code.

## The 24-hour window

Invoice notifications usually go to clients who have not messaged you recently. On **Cloud API** numbers, a Meta-approved template is required in these cases. See [24-hour window](/docs/getting-started/messaging-window).

## The legacy method (webhook)

If you use an old webhook URL of the form `/api/v1/whmcs-webhook?api_key=...`, move to the new addon. Sending the key in the URL is **deprecated** and may be disabled. See [WHMCS webhook](/docs/api/whmcs-webhook).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| 401 on test | The key is wrong or revoked |
| 404 | No connected number on your account |
| 403 | Message limit reached, or the client is blocked or opted out |
| 422 | The client is outside the 24-hour window and no valid template is available |
