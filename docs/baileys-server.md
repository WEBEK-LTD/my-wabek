# WABEK Baileys Server

WhatsApp Web server for WABEK using Baileys. Deployed on Railway.

## Directory

```
wabek-baileys/
├── server.js       ← Full server code (Railway deploys this)
├── package.json
├── railway.json
└── sessions/       ← Created at runtime, not committed
```

## Railway Setup

Set **Root Directory** to `/wabek-baileys` in Railway settings.

### Environment Variables

| Variable | Description |
|---|---|
| `SERVER_SECRET` | **Required.** Long random shared secret (must match `WA_WEB_SERVER_SECRET` in Netlify). The server refuses to start if it is missing or still `change-this-secret`. |
| `WABEK_EVENTS_URL` | e.g. `https://waabek.com/api/whatsapp/wa-web-events` |
| `WABEK_EVENTS_SECRET` | Same as `SERVER_SECRET` (default) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Optional. Session backup (`wa_sessions`) and inbound media upload to the `wa-media` bucket. |
| `UPLOAD_INBOUND_MEDIA` | Optional. `0` = always send inbound media to WABEK as `data:` URLs instead of uploading. |
| `CRON_SECRET` | Optional. Sent as `x-cron-secret` to the hourly AI review job; set it to WABEK's `CRON_SECRET` (falls back to `SERVER_SECRET`). |
| `CORS_ALLOWED_ORIGINS` | Optional, comma-separated. No browser origin is allowed by default (server-to-server API). |
| `PORT` | Set automatically by Railway |

### Authentication

Every route except `/health` requires the `X-Secret: <SERVER_SECRET>` header
(compared in constant time). The `?secret=` query parameter is no longer
accepted — WABEK has always sent the header.

`GET /health` without the header returns only `{ "ok": true }` (Railway
health check). With the header it also lists sessions.

### Media URLs

Before sending media, the server downloads the URL itself (https/http only,
every redirect hop re-checked, private/loopback/link-local addresses refused,
64MB cap) and passes the bytes to Baileys.

## Routes

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Liveness (no auth); details with `X-Secret` |
| POST | `/instance/:id/qr` | Start instance, get QR |
| POST | `/instance/:id/send` | Send text OR any media |
| POST | `/instance/:id/send-media` | Send media (explicit alias) |
| POST | `/instance/:id/restore` | Restore a saved session |
| GET | `/instance/:id/status` | Instance status |
| POST | `/instance/:id/disconnect` | Disconnect and logout |
| DELETE | `/instance/:id` | Delete instance |
| GET | `/instances` | List all instances |

Session storage (`sessions/<id>/` on disk, mirrored to `wa_sessions.creds`)
is unchanged: existing sessions restore without a new QR scan.

## Media Types

| `mediaType` | caption | filename |
|---|---|---|
| `image` | ✅ | ❌ |
| `video` | ✅ | ❌ |
| `audio` | ❌ | ❌ |
| `ptt` | ❌ | ❌ |
| `document` | ✅ | ✅ |
| `sticker` | ❌ | ❌ |
