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

Builds run on Expo's servers (EAS) — no Mac needed. GitHub starts them; the
signing keys stay with EAS, never in this repository.

**One-time setup**

1. **Expo** — create an account on expo.dev, then from `mobile/`:
   `npx eas-cli@latest login` and `npx eas-cli@latest init`. Copy the project id
   it prints into `expo.extra.eas.projectId` in `app.json` (or set
   `EAS_PROJECT_ID`). Push notifications need it.
2. **GitHub** — expo.dev → Account settings → Access tokens → create one, then
   GitHub → Settings → Secrets and variables → Actions → new secret
   `EXPO_TOKEN`.
3. **Apple** (company account, needs a D-U-N-S number):
   - App Store Connect → Apps → new app, bundle id `com.webek.wabek`.
   - Users and Access → Integrations → App Store Connect API → new key
     (role *App Manager*). Then `npx eas-cli@latest credentials -p ios` →
     add the API key (.p8, Key ID, Issuer ID). EAS creates the signing
     certificate and the **push notification key (APNs)** with it.
4. **Google** (organization account):
   - Play Console → create app, package `com.webek.wabek`. The very first
     upload must be done by hand: run the build (step below, Android,
     *production*), download the `.aab` from expo.dev and upload it to an
     internal-testing release.
   - Google Cloud → service account with access to the Play Console app →
     JSON key → `npx eas-cli@latest credentials -p android` → *Google Service
     Account Key for Play Store submissions*.
   - **Push on Android**: Firebase → add an Android app `com.webek.wabek` →
     download `google-services.json` → on expo.dev → Project → Environment
     variables → new **file** variable `GOOGLE_SERVICES_JSON` (production).
     Firebase → Project settings → Service accounts → new private key →
     `npx eas-cli@latest credentials -p android` → *FCM V1 service account key*.
5. **Netlify** (optional) — Expo → Project → Push notifications → *Enhanced
   security for push*; put the access token in Netlify as `EXPO_ACCESS_TOKEN`.
   Without it pushes still work. Netlify already skips site builds when a push
   only changes `mobile/`.

**Every release**

GitHub → Actions → *Mobile app — build & publish* → Run workflow → platform,
`production`, tick *submit*. The build appears on expo.dev; with *submit* it
goes to TestFlight / Play internal testing, from where you release it.
Pull requests that touch `mobile/` are checked automatically (*Mobile app —
checks*).

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
