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
| `SERVER_SECRET` | Shared secret (must match `WA_WEB_SERVER_SECRET` in Netlify) |
| `WABEK_EVENTS_URL` | e.g. `https://waabek.com/api/whatsapp/wa-web-events` |
| `WABEK_EVENTS_SECRET` | Same as `SERVER_SECRET` |
| `PORT` | Set automatically by Railway |

## Routes

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Health check (no auth) |
| POST | `/instance/:id/qr` | Start instance, get QR |
| POST | `/instance/:id/send` | Send text OR any media |
| POST | `/instance/:id/send-media` | Send media (explicit alias) |
| GET | `/instance/:id/status` | Instance status |
| POST | `/instance/:id/disconnect` | Disconnect and logout |
| DELETE | `/instance/:id` | Delete instance |
| GET | `/instances` | List all instances |

## Media Types

| `mediaType` | caption | filename |
|---|---|---|
| `image` | ✅ | ❌ |
| `video` | ✅ | ❌ |
| `audio` | ❌ | ❌ |
| `ptt` | ❌ | ❌ |
| `document` | ✅ | ✅ |
| `sticker` | ❌ | ❌ |
