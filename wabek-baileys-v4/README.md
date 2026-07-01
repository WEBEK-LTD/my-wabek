# WABEK Baileys Server

WhatsApp Web server for WABEK platform. Handles QR code connections and message routing.

---

## 🚀 Deploy on Railway (FREE - Recommended)

1. Go to [railway.app](https://railway.app) and sign up
2. Click **New Project → Deploy from GitHub repo** (or upload this folder)
3. Set environment variables:
   ```
   SERVER_SECRET=any-random-string-keep-secret
   WABEK_EVENTS_URL=https://YOUR-WABEK.netlify.app/api/whatsapp/wa-web-events
   WABEK_EVENTS_SECRET=same-as-SERVER_SECRET
   ```
4. Deploy — Railway gives you a URL like `https://wabek-baileys.railway.app`

5. Add to Netlify environment variables:
   ```
   WA_WEB_SERVER_URL=https://wabek-baileys.railway.app
   WA_WEB_SERVER_SECRET=same-as-SERVER_SECRET
   ```

---

## 🚀 Deploy on Render (FREE tier)

1. Go to [render.com](https://render.com) and sign up
2. New → Web Service → connect GitHub repo
3. Set environment variables (same as above)
4. Deploy

---

## 🚀 Deploy on VPS (Docker)

```bash
git clone your-repo
cd wabek-baileys
cp .env.example .env
# Edit .env with your values
docker build -t wabek-baileys .
docker run -d \
  --name wabek-baileys \
  --restart unless-stopped \
  -p 3001:3001 \
  -v $(pwd)/sessions:/app/sessions \
  --env-file .env \
  wabek-baileys
```

---

## 📡 API Endpoints

All endpoints require header: `X-Secret: YOUR_SERVER_SECRET`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth) |
| POST | `/instance/:id/qr` | Start instance + get QR code |
| GET | `/instance/:id/status` | Get connection status |
| POST | `/instance/:id/send` | Send a message |
| POST | `/instance/:id/disconnect` | Disconnect instance |
| DELETE | `/instance/:id` | Delete instance + session |
| GET | `/instances` | List all instances |

---

## ⚠️ Important Notes

- Sessions are stored in `/sessions` folder — persist this with a volume
- Each WhatsApp number = one instance
- QR code expires in ~60 seconds — refresh if needed
- Don't send too many messages too fast — risk of ban
