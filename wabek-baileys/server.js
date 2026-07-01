const express = require('express')
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const QRCode = require('qrcode')
const fs = require('fs')
const path = require('path')
const pino = require('pino')

const app = express()
app.use(express.json({ limit: '50mb' }))

const PORT = process.env.PORT || 3001
const SERVER_SECRET = process.env.SERVER_SECRET || 'change-this-secret'
const WABEK_EVENTS_URL = process.env.WABEK_EVENTS_URL
const WABEK_EVENTS_SECRET = process.env.WABEK_EVENTS_SECRET || SERVER_SECRET

const logger = pino({ level: 'silent' })
const sessions = new Map()
const SESSIONS_DIR = path.join(__dirname, 'sessions')
fs.mkdirSync(SESSIONS_DIR, { recursive: true })

// ─── Auth Middleware ───────────────────────────────────────
function auth(req, res, next) {
  const secret = req.headers['x-secret'] || req.query.secret
  if (secret !== SERVER_SECRET) return res.status(403).json({ error: 'Forbidden' })
  next()
}

// ─── Notify WABEK ─────────────────────────────────────────
async function notifyWabek(event, instanceId, data) {
  if (!WABEK_EVENTS_URL) {
    console.log(`[${instanceId}] Event: ${event}`, JSON.stringify(data).slice(0, 200))
    return
  }
  try {
    const res = await fetch(WABEK_EVENTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': WABEK_EVENTS_SECRET,
      },
      body: JSON.stringify({ event, instanceId, data }),
    })
    if (!res.ok) console.error(`[${instanceId}] Notify failed: ${res.status}`)
  } catch (e) {
    console.error(`[${instanceId}] Notify error:`, e.message)
  }
}

// ─── JID Helper ───────────────────────────────────────────
function toJid(to) {
  if (to.includes('@')) return to
  return `${to.replace(/\D/g, '')}@s.whatsapp.net`
}

// ─── Build Baileys payload per media type ─────────────────
// Matches WhatsApp Web's native send-message format.
// Each type has specific fields — do NOT mix caption/filename
// between types (e.g. audio has no caption, filename is only for document).
function buildMediaPayload(mediaType, mediaUrl, caption, filename, mimetype) {
  switch (mediaType) {
    case 'image':
      return {
        image: { url: mediaUrl },
        caption: caption || '',
        mimetype: mimetype || 'image/jpeg',
      }
    case 'video':
      return {
        video: { url: mediaUrl },
        caption: caption || '',
        mimetype: mimetype || 'video/mp4',
      }
    case 'audio':
      // Regular audio file — no caption, no filename
      return {
        audio: { url: mediaUrl },
        mimetype: mimetype || 'audio/mpeg',
        ptt: false,
      }
    case 'ptt':
      // Voice Note (Push-To-Talk) — ptt:true shows waveform UI in WhatsApp
      return {
        audio: { url: mediaUrl },
        mimetype: mimetype || 'audio/ogg; codecs=opus',
        ptt: true,
      }
    case 'document':
      // Documents: filename is shown in chat, caption appears below file
      return {
        document: { url: mediaUrl },
        mimetype: mimetype || 'application/octet-stream',
        fileName: filename || 'file',
        caption: caption || '',
      }
    case 'sticker':
      // Static webp sticker (must be 512x512, ≤100KB)
      return {
        sticker: { url: mediaUrl },
        mimetype: mimetype || 'image/webp',
      }
    default:
      // Unknown type → send as downloadable document (safe fallback)
      console.log(`[buildMediaPayload] unknown type "${mediaType}", sending as document`)
      return {
        document: { url: mediaUrl },
        mimetype: mimetype || 'application/octet-stream',
        fileName: filename || 'file',
      }
  }
}

// ─── Download inbound media from Baileys ──────────────────
// Returns { base64, mimeType, filename } or null on failure.
// WABEK receives this in the wa-web-events payload and re-hosts it
// on Supabase Storage so it has a permanent public URL.
async function downloadInboundMedia(msg, msgType) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {})
    if (!buffer || !buffer.length) return null

    const m = msg.message || {}
    const mimeMap = {
      image:    m.imageMessage?.mimetype    || 'image/jpeg',
      video:    m.videoMessage?.mimetype    || 'video/mp4',
      audio:    m.audioMessage?.mimetype    || 'audio/ogg',
      ptt:      m.audioMessage?.mimetype    || 'audio/ogg; codecs=opus',
      document: m.documentMessage?.mimetype || 'application/octet-stream',
      sticker:  m.stickerMessage?.mimetype  || 'image/webp',
    }

    return {
      base64:   buffer.toString('base64'),
      mimeType: mimeMap[msgType] || 'application/octet-stream',
      filename: m.documentMessage?.fileName || null,
    }
  } catch (e) {
    console.error('[downloadInboundMedia] failed:', e.message)
    return null
  }
}

// ─── Create/Restore Session ────────────────────────────────
async function createSession(instanceId) {
  console.log(`[${instanceId}] Creating session...`)

  const authDir = path.join(SESSIONS_DIR, instanceId)
  fs.mkdirSync(authDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['WABEK', 'Chrome', '126.0'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 2000,
  })

  const session = { sock, qr: null, connected: false, phoneNumber: null }
  sessions.set(instanceId, session)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 })
        sessions.get(instanceId).qr = qrDataUrl
        console.log(`[${instanceId}] New QR code generated`)
        await notifyWabek('qr_updated', instanceId, { qrCode: qrDataUrl })
      } catch (e) { console.error('QR generation error:', e.message) }
    }

    if (connection === 'open') {
      const phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0]
      const displayName = sock.user?.name || sock.user?.notify
      sessions.get(instanceId).connected = true
      sessions.get(instanceId).phoneNumber = phoneNumber
      sessions.get(instanceId).qr = null
      console.log(`[${instanceId}] Connected! Phone: ${phoneNumber}`)
      await notifyWabek('connected', instanceId, { phoneNumber, displayName })
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode : 0
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      console.log(`[${instanceId}] Disconnected. Reconnect: ${shouldReconnect}, Code: ${statusCode}`)
      if (sessions.has(instanceId)) sessions.get(instanceId).connected = false
      await notifyWabek('disconnected', instanceId, {
        shouldReconnect, statusCode,
        loggedOut: statusCode === DisconnectReason.loggedOut,
      })
      if (shouldReconnect) {
        console.log(`[${instanceId}] Reconnecting in 5s...`)
        setTimeout(() => createSession(instanceId), 5000)
      } else {
        sessions.delete(instanceId)
        try { fs.rmSync(path.join(SESSIONS_DIR, instanceId), { recursive: true, force: true }) } catch {}
      }
    }
  })

  // ── Inbound messages — text + ALL media types ─────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (msg.key.fromMe) continue
      const from = msg.key.remoteJid || ''
      if (!from) continue

      const m = msg.message || {}
      const isPtt = !!m.audioMessage?.ptt

      // Determine exact message type (PTT vs regular audio matters for display)
      const msgType =
        m.imageMessage                  ? 'image'
        : m.videoMessage                ? 'video'
        : m.audioMessage && isPtt       ? 'ptt'
        : m.audioMessage                ? 'audio'
        : m.documentMessage             ? 'document'
        : m.stickerMessage              ? 'sticker'
        : 'text'

      // Text content (caption for media messages)
      const text =
        m.conversation                  ||
        m.extendedTextMessage?.text     ||
        m.imageMessage?.caption         ||
        m.videoMessage?.caption         ||
        m.documentMessage?.caption      ||
        ''

      // Download and attach media as base64
      // WABEK's wa-web-events handler will re-host on Supabase Storage
      let mediaUrl  = null
      let mimeType  = null
      let filename  = null

      if (msgType !== 'text') {
        const media = await downloadInboundMedia(msg, msgType)
        if (media) {
          // Data URI lets WABEK display inline immediately;
          // wa-web-events will also re-upload to Supabase if configured
          mediaUrl = `data:${media.mimeType};base64,${media.base64}`
          mimeType = media.mimeType
          filename = media.filename
        }
      }

      await notifyWabek('message_received', instanceId, {
        messageId:  msg.key.id,
        from,
        pushName:   msg.pushName || '',
        type:       msgType,
        text,
        mediaUrl,
        mimeType,
        filename,
        timestamp:  msg.messageTimestamp,
      })
    }
  })

  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      if (!update.update?.status) continue
      const statusMap = { 1: 'sent', 2: 'delivered', 3: 'read', 4: 'played' }
      const status = statusMap[update.update.status] || 'sent'
      await notifyWabek('message_status', instanceId, { messageId: update.key.id, status })
    }
  })

  return session
}

// ─── Restore existing sessions on startup ─────────────────
async function restoreSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return
  const dirs = fs.readdirSync(SESSIONS_DIR)
  console.log(`Restoring ${dirs.length} session(s)...`)
  for (const instanceId of dirs) {
    const credsFile = path.join(SESSIONS_DIR, instanceId, 'creds.json')
    if (fs.existsSync(credsFile)) {
      try {
        await createSession(instanceId)
        console.log(`Restored: ${instanceId}`)
      } catch (e) {
        console.error(`Failed to restore ${instanceId}:`, e.message)
      }
    }
  }
}

// ─── API Routes ────────────────────────────────────────────

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    sessions: sessions.size,
    instances: [...sessions.entries()].map(([id, s]) => ({
      id, connected: s.connected, phoneNumber: s.phoneNumber, hasQR: !!s.qr,
    })),
  })
})

// Create/start instance and get QR
app.post('/instance/:id/qr', auth, async (req, res) => {
  const { id } = req.params
  if (!sessions.has(id)) {
    await createSession(id)
    await new Promise(r => setTimeout(r, 3000))
  }
  const session = sessions.get(id)
  if (!session) return res.status(500).json({ error: 'Failed to create session' })
  res.json({
    instanceId: id,
    qrCode:     session.qr || null,
    connected:  session.connected,
    phoneNumber: session.phoneNumber,
    status:     session.connected ? 'connected' : session.qr ? 'qr_pending' : 'initializing',
  })
})

// ── Send message (text OR any media type) ──────────────────
// Params:
//   to        - phone number or JID (required)
//   text      - message text (required for text messages)
//   mediaUrl  - public URL or data URI (required for media)
//   mediaType - 'image'|'video'|'audio'|'ptt'|'document'|'sticker'
//   caption   - optional caption (image/video/document only)
//   filename  - optional filename (document only)
//   mimetype  - optional mime type (helps WhatsApp render correctly)
//
// Backward compatible: existing {to, text} calls continue to work.
app.post('/instance/:id/send', auth, async (req, res) => {
  const { id } = req.params
  const { to, text, mediaUrl, mediaType, caption, filename, mimetype } = req.body

  if (!to) return res.status(400).json({ error: 'to required' })
  if (!text && !mediaUrl) return res.status(400).json({ error: 'text or mediaUrl required' })

  const session = sessions.get(id)
  if (!session) return res.status(404).json({ error: 'Instance not found' })
  if (!session.connected) return res.status(400).json({ error: 'Instance not connected' })

  try {
    const jid = toJid(to)
    let result

    if (mediaUrl && mediaType) {
      const payload = buildMediaPayload(mediaType, mediaUrl, caption || text || '', filename, mimetype)
      console.log(`[${id}] Sending media type=${mediaType} to=${jid}`)
      result = await session.sock.sendMessage(jid, payload)
    } else {
      result = await session.sock.sendMessage(jid, { text })
    }

    res.json({ success: true, messageId: result?.key?.id })
  } catch (e) {
    console.error(`[${id}] Send error:`, e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── Send media (explicit route for WABEK's sendWAWebMedia) ─
// Same logic as /send with mediaUrl, provided as a separate
// route so the intent is unambiguous.
app.post('/instance/:id/send-media', auth, async (req, res) => {
  const { id } = req.params
  const { to, mediaUrl, mediaType, caption, filename, mimetype } = req.body

  if (!to || !mediaUrl) return res.status(400).json({ error: 'to and mediaUrl required' })
  if (!mediaType) return res.status(400).json({ error: 'mediaType required (image|video|audio|ptt|document|sticker)' })

  const session = sessions.get(id)
  if (!session) return res.status(404).json({ error: 'Instance not found' })
  if (!session.connected) return res.status(400).json({ error: 'Instance not connected' })

  try {
    const jid = toJid(to)
    const payload = buildMediaPayload(mediaType, mediaUrl, caption || '', filename, mimetype)
    console.log(`[${id}] send-media type=${mediaType} to=${jid}`)
    const result = await session.sock.sendMessage(jid, payload)
    res.json({ success: true, messageId: result?.key?.id })
  } catch (e) {
    console.error(`[${id}] send-media error:`, e.message)
    res.status(500).json({ error: e.message })
  }
})

// Get instance status
app.get('/instance/:id/status', auth, async (req, res) => {
  const { id } = req.params
  const session = sessions.get(id)
  if (!session) return res.json({ instanceId: id, status: 'not_found' })
  res.json({
    instanceId:  id,
    connected:   session.connected,
    phoneNumber: session.phoneNumber,
    hasQR:       !!session.qr,
    qrCode:      session.qr,
    status:      session.connected ? 'connected' : session.qr ? 'qr_pending' : 'initializing',
  })
})

// Disconnect instance
app.post('/instance/:id/disconnect', auth, async (req, res) => {
  const { id } = req.params
  const session = sessions.get(id)
  if (session?.sock) {
    try { await session.sock.logout() } catch {}
    try { session.sock.end() } catch {}
  }
  sessions.delete(id)
  try { fs.rmSync(path.join(SESSIONS_DIR, id), { recursive: true, force: true }) } catch {}
  res.json({ success: true })
})

// Delete instance completely
app.delete('/instance/:id', auth, async (req, res) => {
  const { id } = req.params
  const session = sessions.get(id)
  if (session?.sock) {
    try { await session.sock.logout() } catch {}
    try { session.sock.end() } catch {}
  }
  sessions.delete(id)
  try { fs.rmSync(path.join(SESSIONS_DIR, id), { recursive: true, force: true }) } catch {}
  res.json({ success: true })
})

// List all instances
app.get('/instances', auth, (req, res) => {
  const list = [...sessions.entries()].map(([id, s]) => ({
    id, connected: s.connected, phoneNumber: s.phoneNumber,
    status: s.connected ? 'connected' : s.qr ? 'qr_pending' : 'initializing',
  }))
  res.json({ instances: list })
})

// ─── Start Server ──────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`WABEK Baileys Server running on port ${PORT}`)
  console.log(`Health: http://localhost:${PORT}/health`)
  console.log(`Routes: /instance/:id/qr | /send | /send-media | /status | /disconnect`)
  if (!WABEK_EVENTS_URL) {
    console.warn('⚠️  WABEK_EVENTS_URL not set — events will only be logged locally')
  }
  await restoreSessions()
})
