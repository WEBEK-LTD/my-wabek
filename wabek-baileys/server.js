const express = require('express')
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys')
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
      headers: { 'Content-Type': 'application/json', 'X-Secret': WABEK_EVENTS_SECRET },
      body: JSON.stringify({ event, instanceId, data }),
    })
    if (!res.ok) console.error(`Notify failed: ${res.status}`)
  } catch (e) {
    console.error('Notify error:', e.message)
  }
}

// ─── Media Upload Helper ───────────────────────────────────
// Upload a media buffer from an inbound message to WABEK's storage
// (via the wa-web-events endpoint which handles re-hosting).
async function uploadMediaToWabek(sock, msg, msgType, instanceId) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {})
    if (!buffer) return null

    // We send raw base64 to WABEK — the events endpoint will re-upload to Supabase Storage
    const b64 = buffer.toString('base64')
    const mimeMap = {
      image: msg.message?.imageMessage?.mimetype || 'image/jpeg',
      video: msg.message?.videoMessage?.mimetype || 'video/mp4',
      audio: msg.message?.audioMessage?.mimetype || 'audio/ogg',
      document: msg.message?.documentMessage?.mimetype || 'application/octet-stream',
      sticker: msg.message?.stickerMessage?.mimetype || 'image/webp',
      ptt: msg.message?.audioMessage?.mimetype || 'audio/ogg',
    }
    const mime = mimeMap[msgType] || 'application/octet-stream'
    const filename = msg.message?.documentMessage?.fileName || null

    // Notify WABEK with base64 media (WABEK will store and return permanent URL)
    // For now, return a data URI so WABEK can at least display it inline for images
    // (WABEK's wa-web-events handles re-upload if needed)
    return { base64: b64, mimeType: mime, filename }
  } catch (e) {
    console.error(`[${instanceId}] Media download failed:`, e.message)
    return null
  }
}

// ─── JID Helper ───────────────────────────────────────────
function toJid(to) {
  if (to.includes('@')) return to
  const digits = to.replace(/\D/g, '')
  return `${digits}@s.whatsapp.net`
}

// ─── Mime → Baileys message type ──────────────────────────
function mediaTypeToPayload(mediaType, mediaUrl, caption, filename, mimetype) {
  switch (mediaType) {
    case 'image':
      return { image: { url: mediaUrl }, caption: caption || '', mimetype: mimetype || 'image/jpeg' }
    case 'video':
      return { video: { url: mediaUrl }, caption: caption || '', mimetype: mimetype || 'video/mp4' }
    case 'audio':
      return { audio: { url: mediaUrl }, mimetype: mimetype || 'audio/ogg; codecs=opus', ptt: false }
    case 'ptt':
      // PTT (voice note) — ptt:true tells WhatsApp to show as voice note waveform
      return { audio: { url: mediaUrl }, mimetype: mimetype || 'audio/ogg; codecs=opus', ptt: true }
    case 'document':
      return { document: { url: mediaUrl }, mimetype: mimetype || 'application/octet-stream', fileName: filename || 'file' }
    case 'sticker':
      return { sticker: { url: mediaUrl }, mimetype: mimetype || 'image/webp' }
    default:
      // Unknown type — send as document so it's always downloadable
      return { document: { url: mediaUrl }, mimetype: mimetype || 'application/octet-stream', fileName: filename || 'file' }
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
      await notifyWabek('disconnected', instanceId, { shouldReconnect, statusCode, loggedOut: statusCode === DisconnectReason.loggedOut })
      if (shouldReconnect) {
        console.log(`[${instanceId}] Reconnecting in 5s...`)
        setTimeout(() => createSession(instanceId), 5000)
      } else {
        sessions.delete(instanceId)
        try { fs.rmSync(path.join(SESSIONS_DIR, instanceId), { recursive: true, force: true }) } catch {}
      }
    }
  })

  // ── Inbound messages (text + all media types) ──────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (msg.key.fromMe) continue
      const from = msg.key.remoteJid || ''
      if (!from) continue

      const m = msg.message || {}
      const isPtt = !!m.audioMessage?.ptt

      // Determine message type
      const msgType = m.imageMessage    ? 'image'
        : m.videoMessage                ? 'video'
        : m.audioMessage && isPtt       ? 'ptt'
        : m.audioMessage                ? 'audio'
        : m.documentMessage             ? 'document'
        : m.stickerMessage              ? 'sticker'
        : 'text'

      const text =
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        ''

      // Media metadata (URL will be set by WABEK after re-hosting)
      let mediaUrl = null
      let mimeType = null
      let filename = null

      if (msgType !== 'text') {
        const mediaMeta = await uploadMediaToWabek(sock, msg, msgType, instanceId)
        if (mediaMeta) {
          // Send as data URI for now — WABEK's wa-web-events will re-host if needed
          mediaUrl = `data:${mediaMeta.mimeType};base64,${mediaMeta.base64}`
          mimeType = mediaMeta.mimeType
          filename = mediaMeta.filename
        }
      }

      await notifyWabek('message_received', instanceId, {
        messageId: msg.key.id,
        from,
        pushName: msg.pushName || '',
        type: msgType,
        text,
        mediaUrl,
        mimeType,
        filename,
        timestamp: msg.messageTimestamp,
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
      try { await createSession(instanceId); console.log(`Restored: ${instanceId}`) }
      catch (e) { console.error(`Failed to restore ${instanceId}:`, e.message) }
    }
  }
}

// ─── API Routes ────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    ok: true, sessions: sessions.size,
    instances: [...sessions.entries()].map(([id, s]) => ({ id, connected: s.connected, phoneNumber: s.phoneNumber, hasQR: !!s.qr })),
  })
})

app.post('/instance/:id/qr', auth, async (req, res) => {
  const { id } = req.params
  if (!sessions.has(id)) {
    await createSession(id)
    await new Promise(r => setTimeout(r, 3000))
  }
  const session = sessions.get(id)
  if (!session) return res.status(500).json({ error: 'Failed to create session' })
  res.json({ instanceId: id, qrCode: session.qr || null, connected: session.connected, phoneNumber: session.phoneNumber, status: session.connected ? 'connected' : session.qr ? 'qr_pending' : 'initializing' })
})

// ── Send message (text + ALL media types) ──────────────────
// Supports: text, image, video, audio, ptt, document, sticker
// The WABEK side calls this for everything (text AND media) since the
// /send endpoint already existed and now handles all types.
// Also keeps backward compatibility: `text` param alone → text message.
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
      // Media message — build correct Baileys payload per type
      const payload = mediaTypeToPayload(mediaType, mediaUrl, caption || text || '', filename, mimetype)
      console.log(`[${id}] Sending media type=${mediaType} to=${jid}`)
      result = await session.sock.sendMessage(jid, payload)
    } else {
      // Plain text
      result = await session.sock.sendMessage(jid, { text })
    }

    res.json({ success: true, messageId: result?.key?.id })
  } catch (e) {
    console.error(`[${id}] Send error:`, e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── /send-media alias (for future compatibility) ────────────
// WABEK's sendWAWebMedia() calls /send-media — forward to /send
app.post('/instance/:id/send-media', auth, async (req, res) => {
  req.url = req.url.replace('/send-media', '/send')
  req.params.id = req.params.id
  // Re-map param names from WABEK's convention to /send convention
  req.body.mediaType = req.body.mediaType
  // Forward to the /send handler by re-calling the route
  const { id } = req.params
  const { to, mediaUrl, mediaType, caption, filename, mimetype } = req.body

  if (!to || !mediaUrl) return res.status(400).json({ error: 'to and mediaUrl required' })

  const session = sessions.get(id)
  if (!session) return res.status(404).json({ error: 'Instance not found' })
  if (!session.connected) return res.status(400).json({ error: 'Instance not connected' })

  try {
    const jid = toJid(to)
    const payload = mediaTypeToPayload(mediaType || 'document', mediaUrl, caption || '', filename, mimetype)
    console.log(`[${id}] send-media type=${mediaType} to=${jid}`)
    const result = await session.sock.sendMessage(jid, payload)
    res.json({ success: true, messageId: result?.key?.id })
  } catch (e) {
    console.error(`[${id}] send-media error:`, e.message)
    res.status(500).json({ error: e.message })
  }
})

app.get('/instance/:id/status', auth, async (req, res) => {
  const { id } = req.params
  const session = sessions.get(id)
  if (!session) return res.json({ instanceId: id, status: 'not_found' })
  res.json({ instanceId: id, connected: session.connected, phoneNumber: session.phoneNumber, hasQR: !!session.qr, qrCode: session.qr, status: session.connected ? 'connected' : session.qr ? 'qr_pending' : 'initializing' })
})

app.post('/instance/:id/disconnect', auth, async (req, res) => {
  const { id } = req.params
  const session = sessions.get(id)
  if (session?.sock) { try { await session.sock.logout() } catch {} try { session.sock.end() } catch {} }
  sessions.delete(id)
  try { fs.rmSync(path.join(SESSIONS_DIR, id), { recursive: true, force: true }) } catch {}
  res.json({ success: true })
})

app.delete('/instance/:id', auth, async (req, res) => {
  const { id } = req.params
  const session = sessions.get(id)
  if (session?.sock) { try { await session.sock.logout() } catch {} try { session.sock.end() } catch {} }
  sessions.delete(id)
  try { fs.rmSync(path.join(SESSIONS_DIR, id), { recursive: true, force: true }) } catch {}
  res.json({ success: true })
})

app.get('/instances', auth, (req, res) => {
  const list = [...sessions.entries()].map(([id, s]) => ({ id, connected: s.connected, phoneNumber: s.phoneNumber, status: s.connected ? 'connected' : s.qr ? 'qr_pending' : 'initializing' }))
  res.json({ instances: list })
})

app.listen(PORT, async () => {
  console.log(`WABEK Baileys Server running on port ${PORT}`)
  if (!WABEK_EVENTS_URL) console.warn('⚠️  WABEK_EVENTS_URL not set')
  await restoreSessions()
})
