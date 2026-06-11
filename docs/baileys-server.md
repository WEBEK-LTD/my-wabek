# WABEK — Baileys Server Setup Guide
# For WhatsApp Web instances (unofficial method)

## Overview

WhatsApp Web (WA Web) sessions require a persistent Node.js server because:
- Sessions need to stay alive 24/7
- Netlify Functions are stateless/ephemeral
- QR code scanning needs a running process

This guide shows how to set up a Baileys server on a VPS.

---

## Requirements

- A VPS (Ubuntu 20.04+) — DigitalOcean, Hetzner, Contabo, etc.
- Node.js 18+
- At least 512MB RAM

---

## Install

```bash
# On your VPS
git clone https://github.com/your-org/wabek-baileys-server
cd wabek-baileys-server
npm install
cp .env.example .env
```

## .env for Baileys Server

```env
PORT=3001
SERVER_SECRET=your-random-secret-key
WABEK_APP_URL=https://wabek.netlify.app
WABEK_WA_EVENTS_URL=https://wabek.netlify.app/api/whatsapp/wa-web-events
WABEK_WA_EVENTS_SECRET=same-as-WA_WEB_SERVER_SECRET
```

## Baileys Server Code (server.js)

```javascript
const express = require('express')
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const QRCode = require('qrcode')
const fs = require('fs')
const app = express()

app.use(express.json())

const SECRET = process.env.SERVER_SECRET
const WABEK_EVENTS_URL = process.env.WABEK_WA_EVENTS_URL
const WABEK_SECRET = process.env.WABEK_WA_EVENTS_SECRET

const sessions = new Map() // instanceId -> socket

function auth(req, res, next) {
  if (req.headers['x-secret'] !== SECRET) return res.status(403).json({ error: 'Forbidden' })
  next()
}

async function notifyWabek(event, instanceId, data) {
  try {
    await fetch(WABEK_EVENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Secret': WABEK_SECRET },
      body: JSON.stringify({ event, instanceId, data }),
    })
  } catch (e) { console.error('Notify error:', e.message) }
}

async function createSession(instanceId) {
  const authDir = `./sessions/${instanceId}`
  fs.mkdirSync(authDir, { recursive: true })
  const { state, saveCreds } = await useMultiFileAuthState(authDir)

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['WABEK', 'Chrome', '3.0'],
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr)
      sessions.get(instanceId).qr = qrDataUrl
      await notifyWabek('qr_updated', instanceId, { qrCode: qrDataUrl })
    }

    if (connection === 'open') {
      const phoneNumber = sock.user?.id?.split(':')[0]
      const displayName = sock.user?.name
      sessions.get(instanceId).connected = true
      await notifyWabek('connected', instanceId, { phoneNumber, displayName })
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error instanceof Boom &&
        lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
      await notifyWabek('disconnected', instanceId, { shouldReconnect })
      if (shouldReconnect) setTimeout(() => createSession(instanceId), 5000)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (msg.key.fromMe) continue
      const from = msg.key.remoteJid.replace('@s.whatsapp.net', '')
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
      await notifyWabek('message_received', instanceId, {
        messageId: msg.key.id,
        from,
        pushName: msg.pushName,
        type: 'text',
        text,
      })
    }
  })

  sock.ev.on('message-receipt.update', async (updates) => {
    for (const { key, receipt } of updates) {
      let status = 'sent'
      if (receipt?.receiptTimestamp) status = 'delivered'
      if (receipt?.readTimestamp) status = 'read'
      await notifyWabek('message_status', instanceId, { messageId: key.id, status })
    }
  })

  sessions.set(instanceId, { sock, qr: null, connected: false })
  return sock
}

// Routes
app.post('/instance/:id/qr', auth, async (req, res) => {
  const { id } = req.params
  if (!sessions.has(id)) await createSession(id)
  const session = sessions.get(id)
  res.json({ qrCode: session.qr, status: session.connected ? 'connected' : 'qr_pending' })
})

app.post('/instance/:id/send', auth, async (req, res) => {
  const { id } = req.params
  const { to, text } = req.body
  if (!sessions.has(id)) return res.status(404).json({ error: 'Instance not found' })
  const { sock } = sessions.get(id)
  const result = await sock.sendMessage(`${to}@s.whatsapp.net`, { text })
  res.json({ messageId: result.key.id })
})

app.post('/instance/:id/disconnect', auth, async (req, res) => {
  const { id } = req.params
  if (sessions.has(id)) {
    sessions.get(id).sock.end()
    sessions.delete(id)
    fs.rmSync(`./sessions/${id}`, { recursive: true, force: true })
  }
  res.json({ success: true })
})

app.get('/health', (req, res) => res.json({ ok: true, sessions: sessions.size }))

app.listen(process.env.PORT || 3001, () => {
  console.log(`Baileys server running on port ${process.env.PORT || 3001}`)
})
```

## Run with PM2

```bash
npm install -g pm2
pm2 start server.js --name wabek-baileys
pm2 startup
pm2 save
```

## Netlify Environment Variables

Add these to your Netlify site:

```
WA_WEB_SERVER_URL=https://YOUR_VPS_IP:3001
WA_WEB_SERVER_SECRET=your-random-secret-key
```

---

## ⚠️ Important Notes

1. Use a **dedicated phone number** for WA Web — not your personal number
2. Keep the phone connected to internet (for backup auth)
3. Don't send too many messages too fast — triggers spam detection
4. For high volume, use Meta Cloud API instead

---

## Alternative: Self-hosted with Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

```bash
docker build -t wabek-baileys .
docker run -d -p 3001:3001 --env-file .env -v ./sessions:/app/sessions wabek-baileys
```
