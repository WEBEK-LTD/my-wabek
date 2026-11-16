---
title: "Connect a WhatsApp number"
description: "Choose the right connection: the official Meta Cloud API or WhatsApp Web via QR code, with the trade-offs of each."
section: getting-started
order: 3
slug: getting-started/connect-number
---

# Connect a WhatsApp number

WABEK supports two ways to connect a number. Choose before you start, because the choice decides how messages are sent and which rules apply.

## Comparison

| | Official Cloud API (Meta) | WhatsApp Web (QR) |
|---|---|---|
| **Operated by** | Meta's official business API | A WhatsApp Web session linked to your phone |
| **Requirements** | A Meta Business account and a WhatsApp Business Account (WABA) | A phone with WhatsApp or WhatsApp Business |
| **24-hour window** | Applies: outside it an approved template is required | Template rules do not apply |
| **Campaigns** | Always sent as an approved template | Sent as plain text |
| **Verification codes (OTP)** | Through an Authentication-category template | Plain text |
| **Ban risk** | Low, as long as you follow Meta's policies | **High** for bulk sending or messaging unsaved numbers |
| **Stability** | Does not depend on your phone | The session must stay connected; it can drop and need a rescan |
| **Meta charges** | Meta charges its own fees for some message categories | No Meta fees |

> **Warning:** WhatsApp Web is not an official business channel. Bulk or repetitive sending through it breaks WhatsApp's terms and can get the number **permanently banned**. Use it for one-to-one chats with customers who know you, and use the Cloud API for campaigns and notifications.

## Option 1: Cloud API through Meta (recommended)

### Automatic connection (Embedded Signup)

1. In the dashboard, open **WhatsApp**, then the **Cloud API** tab.
2. Click **Connect with Meta**.
3. Sign in to Facebook, then pick (or create) a Meta Business account and a WhatsApp Business Account.
4. Pick the phone number, or add a new one and confirm it by SMS or voice call.
5. Finish the dialog. On success you see **WhatsApp connected** and the number appears in the list with status **connected**.

### Manual setup (advanced)

Use this if you already have a Meta app and the number's details.

1. Click **Manual Setup**.
2. Fill in the fields:

| Field | Where to find it |
|---|---|
| Phone Number (E.164) | Your number in international format, for example `+9665XXXXXXXX` |
| Phone Number ID | Meta Developer Portal → WhatsApp → API Setup |
| WABA ID | Your WhatsApp Business Account ID |
| Access Token | A permanent **System User** token with the `whatsapp_business_messaging` and `whatsapp_business_management` permissions |

3. Click **Connect**.

> **Warning:** Do not use the Temporary Token from the Meta Developer Portal. It expires within hours, after which incoming and outgoing messages stop.

Once connected, each number shows its **Instance ID**, **Phone Number ID** and **Webhook URL**. Copy the **Instance ID** if you need to target the number in API requests.

### Before sending through the Cloud API

- Create your templates in Meta Business Manager and wait for approval (status `APPROVED`).
- Approved templates appear automatically when you create a campaign.
- Read [24-hour window and templates](/docs/getting-started/messaging-window).

## Option 2: WhatsApp Web via QR code

1. Open **WhatsApp**, then the **WhatsApp Web** tab.
2. Click **Connect via QR Code**. A QR code appears within seconds.
3. On your phone open WhatsApp → **Linked devices** → **Link a device**, and scan the code.
4. The page refreshes automatically. On success the status changes to **connected** and your number appears.

> **Note:** The QR code is valid for a short time. If it expires, click **Show QR Code** or **Reconnect** to generate a new one.

### Keeping the session alive

- Keep the phone online and do not log out of linked devices.
- If the status becomes **disconnected**, click **Reconnect** and scan the code again.

## Number of numbers

How many numbers you can connect depends on your plan. When you reach the limit you see a message asking you to upgrade; numbers already connected are not affected. See [Plans and limits](/docs/getting-started/plans-limits).

## Remove a number

Click the trash icon next to the number. Sending and receiving through it inside WABEK stops immediately.
