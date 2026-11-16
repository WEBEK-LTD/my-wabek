---
title: "WordPress and WooCommerce"
description: "Install the WABEK plugin on WordPress, connect it to your account, and send WooCommerce order notifications over WhatsApp."
section: integrations
order: 1
slug: integrations/wordpress
---

# WordPress and WooCommerce

The WABEK plugin for WordPress sends WhatsApp notifications to your customers on WooCommerce store events, such as a new order or an order status change.

## Requirements

- A WordPress site where you can install plugins.
- WooCommerce active (for order notifications).
- A connected WhatsApp number in WABEK.
- An API key from your account (the API Keys page requires a plan that includes **API Access**).

## 1. Install

1. Download the plugin from:

   ```
   https://waabek.com/downloads/wabek-wordpress-plugin.zip
   ```

   or from **Integrations** → **Modules** tab in the dashboard.
2. In WordPress, open **Plugins → Add New → Upload Plugin**.
3. Choose the zip file, click **Install Now**, then **Activate**.

## 2. Connect your account

1. In WABEK, open **API Keys**, click **New Key**, and name it, for example `WordPress - My Store`.
2. Copy the key right away; it is not shown again.
3. In WordPress, open the WABEK settings page. <!-- verify against plugin -->
4. Paste the key into the **API Key** field. <!-- verify against plugin -->
5. Click **Test Connection**. A success message should appear. <!-- verify against plugin -->

> **Note:** The plugin sends the key in a request header (`X-API-Key`), never in the URL.

## 3. Choose the number

If you have more than one number, pick the sending number from the numbers list in the settings. <!-- verify against plugin --> If you pick none, the first connected number on your account is used.

## 4. Enable events

Turn on the events that should send a notification, for example: <!-- verify against plugin -->

| Event | Example use |
|---|---|
| New order | Confirm the order was received |
| Order status change (processing, completed, cancelled…) | Keep the customer informed |
| Customer note | Send the order note over WhatsApp |

## 5. Message templates

Each event has editable text that supports merge fields, such as: <!-- verify against plugin -->

| Merge field | Value |
|---|---|
| `{customer_name}` | Customer name |
| `{order_id}` | Order number |
| `{order_total}` | Order total |
| `{order_status}` | Order status |
| `{site_name}` | Site name |

Example:

```
Hi {customer_name}, we received your order #{order_id} for {order_total}. Thank you for shopping at {site_name}.
```

## The 24-hour window

If your number is on the **Cloud API** and the customer has not messaged you in the last 24 hours, free text will not reach them. For order notifications outside the window, use a Meta-approved template if the plugin supports it, or a WhatsApp Web number while keeping the ban risk in mind. See [24-hour window](/docs/getting-started/messaging-window). <!-- verify against plugin -->

## Customer phone number

The notification goes to the phone number in the order's billing address. Ask customers to enter their number in international format with the country code, or set a default country code in the settings if available. <!-- verify against plugin -->

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Connection test fails with 401 | The key is wrong or revoked; create a new one |
| Fails with 404 | No connected number on your account |
| Fails with 403 | Monthly message limit reached, or the customer is blocked or opted out |
| Fails with 422 | The customer is outside the 24-hour window and no valid template is available |
| No notifications arrive | Check that the event is enabled and the customer's number is valid |

More in [Errors](/docs/api/errors).
