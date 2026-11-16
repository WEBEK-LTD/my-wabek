---
title: "Wix"
description: "Connect a Wix store to WABEK through the Wix app or through Wix Automations to send order notifications."
section: integrations
order: 3
slug: integrations/wix
---

# Wix

There are two ways to connect Wix:

| Method | When to use it |
|---|---|
| **The WABEK app on the Wix App Market** | Recommended for Wix Stores; setup is automatic |
| **Wix Automations** (HTTP request) | For custom events such as forms and members, or if you do not use the app |

## Method 1: The Wix app

1. In WABEK, open **Wix**, then the **My Stores** tab, and click **Install on Wix**.
2. In the Wix App Market, click **Add to Site** and choose your site.
3. In the Wix dashboard, open **Apps → WABEK WhatsApp**. Your account is created and connected automatically.
4. Click **Open Full Dashboard**, then connect a WhatsApp number on the **WhatsApp** page. See [Connect a WhatsApp number](/docs/getting-started/connect-number).
5. In the **Messages** tab, edit the text for each event and turn events on or off.
6. From **My Stores → Test Message**, send a test message.

### Events

| Event | Sent when |
|---|---|
| Order Confirmed | A new order is placed |
| Payment Received | Payment is confirmed |
| Order Shipped | The order is fulfilled with tracking |
| Order Cancelled | The order is cancelled |
| Order Refunded | The order is refunded |
| Abandoned Cart | Checkout is started but not completed |
| Cart Recovered | An abandoned cart is completed |
| Back in Stock | A product is available again |

### Variables

| Variable | Value |
|---|---|
| `{{customer_name}}` | Customer name |
| `{{order_id}}` | Order number |
| `{{total}}` | Total with currency |
| `{{tracking_number}}` | Tracking number or link |
| `{{checkout_url}}` | Link to complete checkout (abandoned cart) |

## Method 2: Wix Automations

Use the **Send HTTP request** action in Wix Automations to send event data to WABEK.

1. Create an API key on the **API Keys** page in WABEK.
2. In Wix, open **Automations**, create a new automation, and choose a trigger (for example a form submission).
3. Choose the **Send HTTP request** action and configure it:
   - **URL:** `https://waabek.com/api/webhooks/wix`
   - **Method:** `POST`
   - **Header:** `X-API-Key: <your key>`
4. Add key–value pairs to the request body:

| Key | Required | Description |
|---|---|---|
| `event` | Yes | Event name (see below) |
| `customer_phone` | Yes | Customer number (`phone`, `billing_phone` and `buyerPhone` are also accepted) |
| `customer_name` | No | Customer name |
| `order_id` | No | Order number |
| `total` | No | Total |
| `tracking_number` | No | Tracking number |
| `cart_url` | No | Cart link |
| `site_name` | No | Site name |

Supported `event` values: `order_placed`, `order_paid`, `order_shipped`, `order_delivered`, `order_cancelled`, `order_refunded`, `abandoned_cart`, `new_member`, `form_submitted`.

> **Note:** If the Wix tool does not let you add headers, sending the key in the URL as `?api_key=` is still accepted for existing setups, but it is **deprecated** and may be disabled later. See [Authentication](/docs/api/authentication).

Request and response details are in the [Wix Automations reference](/docs/api/wix-automations).

## The 24-hour window

On **Cloud API** numbers, if the customer is outside the 24-hour window, the event text cannot be delivered and is not sent (WABEK does not substitute a generic template). See [24-hour window](/docs/getting-started/messaging-window).

Custom texts saved under **Dashboard → Wix → Messages** apply to all your linked stores; texts saved earlier per store in the Wix panel are still used for events you did not customise in the dashboard.
