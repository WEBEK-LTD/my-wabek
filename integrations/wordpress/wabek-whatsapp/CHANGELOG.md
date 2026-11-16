# Changelog

All notable changes to the WABEK WhatsApp for WooCommerce plugin.

## 1.0.0 — 2026-11-16

First release of the rewritten plugin (slug `wabek-whatsapp`), replacing "WAABEK for WooCommerce".

### Added
- Customer WhatsApp notifications for new order, processing, completed, cancelled, refunded, on-hold, failed and notes to customer, each with its own switch, message editor and optional approved template + named variables for messages outside the 24-hour window.
- Store owner alert for new orders.
- Background sending through Action Scheduler (WP-Cron fallback) with retries after 1, 5 and 15 minutes for timeouts and 5xx responses; 4xx responses are never retried.
- Send log (latest 200 messages, masked phone numbers) with "Resend" and "Clear log".
- WhatsApp consent checkbox for the classic and block checkout, optional "consent required" mode and My Account opt-out.
- Optional abandoned cart reminder (one reminder, configurable delay, cart restore link).
- Optional WhatsApp OTP login and registration number verification with local rate limits.
- E.164 phone normalization (billing country → default country → store base country), including Arabic-Indic digits.
- Connection test that validates the API key and lists WhatsApp numbers when the server supports it.
- One-time import of the old plugin's API key, API URL, number and admin phone; warning while the old plugin is still active.
- HPOS and Cart & Checkout blocks compatibility declarations.
- English source strings, Arabic (Modern Standard Arabic) translation, RTL admin styles.

### Security
- API key sent only in the `X-API-Key` header over verified HTTPS, redirects disabled, key masked in the UI and never logged.
- Capability checks and nonces on every form and AJAX handler; sanitized input, escaped output, prepared SQL.
