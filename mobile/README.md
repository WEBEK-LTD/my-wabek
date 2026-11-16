# WABEK mobile app (iOS & Android)

Expo (React Native) app for WABEK customers and admins. English is the primary
language, Arabic the second one (full right-to-left layout).

## What's inside

| Area | Screens |
|---|---|
| Opening | animated splash, welcome, introduction, sign in, create account, 2-step code, forgot password, app lock (Face ID / fingerprint) |
| Home | live numbers, disconnected-number alert with one-tap reconnect, quick actions, chats waiting for a reply |
| Chats | filters (open / mine / pending / resolved / all), search, conversation with text, photos, documents, AI-suggested reply, approved templates when the 24-hour window is closed (Cloud API), resolve / assign |
| Analytics | 7 / 30 days, animated chart, delivery & read rates, AI vs team replies, campaigns, top links, export |
| Numbers | link a WhatsApp number **with an 8-character code** (from the same phone), **QR code**, or **Meta Cloud API**; reconnect, default number, remove |
| Account | profile, plan & usage, contact support (tickets), team, language, password, two-step verification, app lock, signed-in devices, notification switches, help, privacy, terms, sign out, delete account |
| Admin (admins only) | service status, users / subscriptions / revenue / messages, sign-ups, support tickets with replies, users search, suspend / activate, account-deletion requests. Opens with Face ID; every admin request is also checked on the server. |

Push notifications: new message, number disconnected / connected, campaign
finished, support answered; for admins: new ticket, customer reply, deletion
request — in the language of the app.

## Run it

```bash
cd mobile
npm install
npx expo start            # scan the QR with a development build
npm run typecheck         # TypeScript
npm run i18n:check        # English has no Arabic, both languages have every key
```

The API address is `expo.extra.apiUrl` in `app.json` (default
`https://waabek.com`); `EXPO_PUBLIC_API_URL` overrides it.

## Publish to the stores

1. Accounts: Apple Developer (company account, D-U-N-S) and Google Play
   Console (organization account).
2. `npx eas-cli@latest login`, then `npx eas-cli@latest init` — this writes
   `expo.extra.eas.projectId` in `app.json` (push notifications need it).
3. Push keys: `npx eas-cli@latest credentials` (Apple push key; Firebase
   `google-services.json` for Android, then add `"googleServicesFile"` under
   `android` in `app.json`).
4. Build: `npx eas-cli@latest build --platform all --profile production`.
5. Submit: `npx eas-cli@latest submit --platform ios` and `--platform android`.

Store checklist: app name **WABEK — Business Inbox** (no "WhatsApp" in the
name or icon), privacy policy `https://waabek.com/privacy`, a demo account for
the reviewers, Data safety / Privacy labels (email, name, phone, messages,
device id for push), in-app account deletion (Account → Delete account).
No purchases happen in the app: plans are managed on the website.

## Server side

The app uses the existing web API plus:

- `POST/PUT/DELETE /api/mobile/push-token` — Expo push tokens (table `mobile_push_tokens`, migration 036)
- `POST /api/mobile/session` — refresh the 7-day session token
- `POST /api/mobile/delete-account` — in-app account deletion
- `POST /api/whatsapp/wa-web {action:"pair", phone}` — WhatsApp pairing code (QR server route `POST /instance/:id/pair`)
