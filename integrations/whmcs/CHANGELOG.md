# Changelog — WABEK WhatsApp for WHMCS

## 4.0.0 — 2026-11-16

Complete rewrite of the addon (no code from 3.x).

### Added
- PSR-4 `WABEK\` library under `lib/`, Capsule schema created on activate and versioned migrations on upgrade.
- Client notifications for 18 events (accounts, billing, orders, services, support, domains) and 3 admin alerts, each with English and Modern Standard Arabic texts, merge fields, a per-event "critical" flag and an optional approved template for outside the 24-hour window.
- Daily reminders: X days before due, on the due date, X days after due, domain renewals — de-duplicated per invoice/domain and day offset.
- Queue + send log (`mod_wabek_outbox`) processed by `AfterCronJob` with a cron lock, exponential backoff on 5xx / 429 / network errors, no retry on other 4xx, immediate send for critical messages with fallback to the queue.
- Admin area: overview, settings with connection test, notification editor with sample sends, filtered send log with resend/cancel, manual send, bulk messages by product / service status / client status, consent management. Branded, RTL-aware UI.
- Client area: WhatsApp preferences page (POST + CSRF) and WhatsApp verification page; optional WhatsApp code after login.
- E.164 normalisation from the WHMCS phone number and client country, with an optional custom-field override.
- Import of 3.x API settings (re-encrypted) and opt-outs.
- Platform API integration: every message is sent with `type: "notification"` and an `Idempotency-Key` per outbox row (`409 idempotency_in_progress` is retried); approved templates take a language and named or positional parameters; instances are listed by `GET /api/v1/instances`; opt-ins/opt-outs are mirrored with `POST /api/v1/contacts-opt-out`; delivery status can be checked from the send log (`GET /api/v1/message-status`); OTP codes are sent from the default instance with the WHMCS company name as `brand_name`.

### Security
- API key encrypted with WHMCS `encrypt()`, masked in the UI, sent only in the `X-API-Key` header, redacted from `logModuleCall`.
- CSRF token on every POST; all state changes are POST-only; output escaped; inputs validated against allow-lists.
- cURL with HTTPS-only, TLS verification, no redirects and connect/total timeouts.

### Fixed (compared with 3.x)
- Client opt-in/opt-out was a GET request without CSRF protection.
- OTP verification was routed to the wrong handler and never succeeded.
