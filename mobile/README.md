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

Everything runs on **GitHub Actions** — no Mac and no third-party build
service. Signing keys live in GitHub secrets; push keys in Netlify.

**One-time setup**

1. **Android upload key** — GitHub → Actions → *Mobile app — create Android
   upload key* → Run. Download the artifact, add each `.txt` as a repository
   secret with the same name, keep `upload.keystore` + password in a password
   manager, delete the artifact.
2. **Google Play** — Play Console → create the app, package `com.webek.wabek`.
   Google Cloud → service account with access to the app → JSON key → secret
   `PLAY_SERVICE_ACCOUNT_JSON`. The very first `.aab` must be uploaded by hand
   (download it from the workflow run) to an internal-testing release.
3. **Firebase (Android push)** — add an Android app `com.webek.wabek`, download
   `google-services.json` → secret `GOOGLE_SERVICES_JSON`. Project settings →
   Service accounts → new private key → Netlify env `FCM_SERVICE_ACCOUNT`.
4. **Apple** — App Store Connect → Apps → new app, bundle id `com.webek.wabek`.
   Users and Access → Integrations → App Store Connect API → new key with role
   **Admin** → secrets `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (the .p8
   contents) and `APPLE_TEAM_ID`. Xcode signs automatically with this key.
5. **Apple push** — Certificates, IDs & Profiles → Keys → new key with *Apple
   Push Notifications service* → Netlify env `APNS_KEY_ID`, `APNS_TEAM_ID`,
   `APNS_KEY` (the .p8 contents). Optional `APNS_BUNDLE_ID` (default
   `com.webek.wabek`).

**Every release**

GitHub → Actions → *Mobile app — build & publish* → Run workflow → platform,
tick *upload*. Android goes to Play internal testing, iOS to TestFlight; the
`.aab` / `.apk` / `.ipa` are also attached to the run. Pull requests that touch
`mobile/` are checked and an Android APK is built automatically.

Store checklist: app name **WABEK — Business Inbox** (no "WhatsApp" in the
name or icon), privacy policy `https://waabek.com/privacy`, a demo account for
the reviewers, Data safety / Privacy labels (email, name, phone, messages,
device id for push), in-app account deletion (Account → Delete account).
No purchases happen in the app: plans are managed on the website.

## Server side

The app uses the existing web API plus:

- `POST/PUT/DELETE /api/mobile/push-token` — APNs / FCM device tokens (table `mobile_push_tokens`, migration 036); `lib/mobile-push.ts` sends to Apple and Google directly
- `POST /api/mobile/session` — refresh the 7-day session token
- `POST /api/mobile/delete-account` — in-app account deletion
- `POST /api/whatsapp/wa-web {action:"pair", phone}` — WhatsApp pairing code (QR server route `POST /instance/:id/pair`)
