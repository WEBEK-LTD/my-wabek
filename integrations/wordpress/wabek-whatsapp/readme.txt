=== WABEK WhatsApp for WooCommerce ===
Contributors: webekorg
Tags: woocommerce, whatsapp, order notifications, abandoned cart, otp
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Requires Plugins: woocommerce
WC requires at least: 7.0
WC tested up to: 10.3
Stable tag: 1.0.0
License: Proprietary
License URI: https://waabek.com/legal/terms

WhatsApp order notifications, abandoned-cart reminders and WhatsApp OTP login for WooCommerce, powered by the WABEK WhatsApp Business platform.

== Description ==

Connect your WooCommerce store to your [WABEK](https://waabek.com) account and keep customers informed on WhatsApp, in Arabic or English.

= Order notifications =

* Customer messages for: new order, processing, completed, cancelled, refunded, on hold, failed, and "note to customer".
* Per-event on/off switch and message editor with variables:
  `{customer_name}`, `{order_id}`, `{order_total}`, `{order_status}`, `{order_items}`, `{shipping_address}`, `{tracking_url}`, `{site_name}`, `{payment_url}`, `{customer_note}`, `{customer_phone}`.
* Per-event approved WhatsApp template (name + named variables) used by WABEK when the customer is outside the 24-hour window.
* WhatsApp alert to the store owner for every new order.

= Reliable, non-blocking delivery =

* Messages are queued with Action Scheduler (bundled with WooCommerce; WP-Cron fallback), so checkout never waits for the API.
* Timeouts, network errors and server errors (5xx) are retried after 1, 5 and 15 minutes. Client errors (4xx) are never retried.
* Send log with the latest 200 messages (time, order, masked phone, event, status, error) and a one-click "Resend".

= Consent and opt-out =

* "I agree to receive order notifications via WhatsApp" checkbox on the classic and block checkout (stored on the order).
* Choose whether consent is required before messaging.
* Customers can opt out from My Account → Account details.

= Abandoned cart reminder (optional, off by default) =

* Captures the billing phone typed at checkout and sends one reminder after a configurable delay, with a link that restores the cart.
* Cancelled automatically when the customer places an order; respects consent and opt-out.

= WhatsApp OTP (optional) =

* "Log in with WhatsApp" on the WooCommerce login form.
* WhatsApp number verification on the WooCommerce registration form.
* Local rate limits per number and per IP address; staff accounts can never log in by code.

= Phone numbers =

Numbers are normalized to the international E.164 format using the billing country, then the default country you choose, then the store base country. Invalid numbers are skipped and logged.

= Security =

* The API key is stored in the WordPress options table, never shown again in full and sent only in the `X-API-Key` header over verified HTTPS (redirects are not followed).
* Capability checks and nonces on every form and AJAX action; all input sanitized and all output escaped.
* HPOS (custom order tables) and Cart & Checkout blocks compatible.

== Installation ==

1. In WordPress go to Plugins → Add New → Upload Plugin and upload `wabek-wordpress-plugin.zip`, then activate it. WooCommerce must be active.
2. If the previous plugin "WAABEK for WooCommerce" is installed, deactivate it (its API key, API URL, number and admin phone are imported automatically on activation).
3. Open WABEK → Settings → Connection, paste the API key from your WABEK dashboard (Dashboard → API Keys) and click "Test connection".
4. Choose the sending number, then review the messages under "Order notifications".

== Frequently Asked Questions ==

= Why was a message not delivered outside the 24-hour window? =

WhatsApp only delivers free-form text within 24 hours of the customer's last message to your business number. Outside that window an approved template is required: set the template name and its named variables for the event. Messages sent through a WhatsApp Web (QR) number are not affected.

= Will the plugin slow down checkout? =

No. Hooks only build the message and queue it; the API is called in the background.

= Which data is sent to WABEK? =

The recipient's phone number, the rendered message and, when configured, the template name and its variables. Nothing is sent for customers who did not consent (when consent is required) or who opted out.

= How do I translate or edit the messages? =

The plugin ships with English and Arabic. Default messages follow the site language; once you save a message it is used as written.

== Changelog ==

= 1.0.0 =
* New plugin, rewritten from scratch (replaces "WAABEK for WooCommerce").

== Upgrade Notice ==

= 1.0.0 =
New plugin slug (wabek-whatsapp). Deactivate the old "WAABEK for WooCommerce" plugin after activating this one.
