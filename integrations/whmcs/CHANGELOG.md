# Changelog — WABEK WhatsApp for WHMCS

## 4.2.0 — 2026-11-16

The per-client "receive WhatsApp notifications" choice is now visible and editable natively in the admin area and on the client's own pages, in every theme (six, twenty-one, Nexus, Lagom 1, Lagom 2), without theme edits.

### Added
- **Native client custom field "Receive WhatsApp notifications"** (tickbox; name from the lang files, e.g. `استقبال إشعارات واتساب / Receive WhatsApp notifications`, plus per-language translations for WHMCS *Enable Translations*). Created once on activate / upgrade / settings save (setting *Show a native "Receive WhatsApp notifications" field to clients*, default on), shown on the registration form, the checkout of new accounts, *Account details* and the admin client profile — themes print client custom fields themselves. Kept in **two-way sync** with `mod_wabek_consent`:
  - field → consent: `ClientAdd` and `ClientEdit` read the submitted value (or the stored one, e.g. API `UpdateClient`) and record a changed choice through the same path as the preferences page (queue clean-up + `contacts-opt-out` sync);
  - consent → field: every change elsewhere (preferences page, homepage panel, admin toggle, profile tab, consent tab, checkout box) writes the field.
  - Values are backfilled when the field is created and rewritten when the consent mode changes. In opt-out mode the box starts ticked on the registration / checkout forms (WHMCS tickboxes have no default), never on a re-displayed form.
  - An opt-out field configured in 4.0 / 4.1 (*ticked = no WhatsApp*) is reused with that meaning — no second field is created. New setting *A ticked box means* (receive / opt-out).
- **Admin client summary:** the `AdminAreaClientSummaryPage` box is now a compact Bootstrap 3 admin panel with the WhatsApp number (and where it comes from), on/off with the recorded state, the verified badge, the last message (time, status / delivery status, event) and buttons *Turn off / Turn on WhatsApp notifications* (POST + CSRF token to the addon, back to `clientssummary.php?userid=…` with a confirmation), *Send message* and *Log*.
- **Admin action links** (`AdminAreaClientSummaryActionLinks`): *Send WhatsApp message*, *WhatsApp log*.
- **Admin profile tab** (`AdminClientProfileTabFields` / `…Save`): *Receive WhatsApp notifications* (Yes/No select when no consent custom field is active; otherwise the status and a pointer to the native field, so two controls never overwrite each other) and an optional *WhatsApp number* override (stored in `mod_wabek_consent.phone_override`, used before the profile phone; not shown when a phone custom field is configured).
- **Client-area homepage panel** (`ClientAreaHomepagePanels`, menu API): on/off state, the number messages go to, a one-click on/off button (POST + token) and *Manage preferences*; markup per theme family, RTL-aware.
- **Account sidebar:** *WhatsApp notifications* with an On/Off badge in the *My Account* panel of the account pages.
- `tests/consent-sync.php` (SQLite through illuminate/database) and homepage-panel / admin-summary checks and screenshots in `tests/render-check.php`.

### Changed
- Preferences page copy: "WhatsApp notifications are on / off for your account — messages are sent to +…" with a single toggle button.
- The checkout consent box is not printed for new accounts when the native field is already on the order form.
- Arabic: "Off" is now «موقوفة».

### Fixed
- The client summary box could disappear silently: any failure returned an empty string. Each part is now guarded and logged (`WABEK: client summary box (…) failed`) and the box always renders (with a minimal fallback).

## 4.1.0 — 2026-11-16

### Added
- **Theme-native client area.** The active client-area theme is detected (template variable, WHMCS `Theme::factory()`, `?systpl=` session, `Template` setting; child themes followed through the `parent:` key of `theme.yaml`; unknown themes sniffed for their Bootstrap version) and the pages are rendered from `templates/bs3/` (six, Lagom 1.x, other Bootstrap 3 themes), `templates/bs4/` (twenty-one, Nexus, other Bootstrap 4/5 themes, and the default) or `templates/lagom2/` (Lagom 2.x and its child themes). Each set uses the theme's own panels / cards / Lagom sections, buttons, alerts, labels / badges and form controls, so it takes the theme's colours, light/dark style and RTL.
- **WhatsApp consent checkbox at checkout** (optional, setting *Show a WhatsApp consent checkbox at checkout*). Printed through `ShoppingCartCheckoutOutput`, so it works in every order form (standard_cart, premium/pure/supreme comparison, universal/cloud slider, boxes, Lagom, Lagom One Step, Nexus) without template edits. A changed choice is recorded with source `checkout` (new clients before the welcome message is queued).
- Sidebar panel on the module pages and a theme-aware WhatsApp icon on the Account menu item (FA4 / v4-shims class on Bootstrap 3 themes, FA5/6 brands elsewhere), both through the WHMCS menu API.
- French, German, Spanish and Turkish texts for the client area and checkout (other strings fall back to English).
- `tests/`: template / theme-detection checks and a Playwright screenshot harness (Bootstrap 3.4.1 and 4.6.2, simulated six, Lagom 1, twenty-one and Lagom 2 light/dark, LTR and RTL, 390px and 1280px).

### Changed
- The client pages no longer carry their own branded header and inline `<style>`; the small stylesheet `assets/client.css` is scoped to `.wabek-ca` / `.wabek-co`, loaded only on `index.php?m=wabek` (and the checkout step when the checkbox is on) and uses Lagom / Bootstrap colour variables.
- `templates/preferences.tpl` and `templates/verify.tpl` (still the `templatefile` WHMCS loads) are now thin shims that include the variant set from the absolute path in `$wabekTplDir`, falling back to `templates/bs4/`.
- The WhatsApp-code-after-login redirect never touches the theme's login, logout or password-reset pages.

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
