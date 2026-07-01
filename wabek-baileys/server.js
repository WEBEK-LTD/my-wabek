/**
 * WABEK Baileys Server v5
 * 
 * Architecture:
 * - sessions Map (in-memory): instanceId → { sock, qr, connected, phoneNumber }
 * - sessions/ directory (disk): persistent auth credentials for each instance
 * - getOrRestoreSession(id): ALL routes use this — never sessions.get() directly.
 *   It restores from disk if not in memory (survives Railway deploys + restarts).
 * - restoreSessions(): runs at startup to pre-load all known instances.
 * 
 * Routes:
 *   POST /instance/:id/qr          → start/get QR
 *   POST /instance/:id/send        → send text OR any media (backward-compatible)
 *   POST /instance/:id/send-media  → send media (explicit alias, same logic)
 *   GET  /instance/:id/status      → get status
 *   POST /instance/:id/disconnect  → disconnect + logout
 *   DELETE /instance/:id           → delete completely
 *   GET  /instances                → list all
 *   GET  /health                   → health check
 */

const express = require('express')
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const QRCode   = require('qrcode')
const fs       = require('fs')
const path     = require('path')
const pino     = require('pino')

const app = express()
app.use(express.json({ limit: '50mb' }))

const PORT                = process.env.PORT              || 3001
const SERVER_SECRET       = process.env.SERVER_SECRET     || 'change-this-secret'
const WABEK_EVENTS_URL    = process.env.WABEK_EVENTS_URL
const WABEK_EVENTS_SECRET = process.env.WABEK_EVENTS_SECRET || SERVER_SECRET

const logger      = pino({ level: 'silent' })
const sessions    = new Map()   // instanceId → { sock, qr, connected, phoneNumber }
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
    console.log(`[${instanceId}] ${event}:`, JSON.stringify(data).slice(0, 200))
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
    if (!res.ok) console.error(`[${instanceId}] notify ${event} failed: ${res.status}`)
  } catch (e) {
    console.error(`[${instanceId}] notify error:`, e.message)
  }
}

// ─── JID Helper ───────────────────────────────────────────
function toJid(to) {
  if (!to) return null
  if (to.includes('@')) return to
  return `${to.replace(/\D/g, '')}@s.whatsapp.net`
}

// ─── Media payload builder ─────────────────────────────────
// Each type has specific fields per Baileys/WhatsApp Web protocol.
// caption: image/video/document only   filename: document only
function buildMediaPayload(mediaType, mediaUrl, caption, filename, mimetype) {
  switch (mediaType) {
    case 'image':
      return { image: { url: mediaUrl }, caption: caption || '', mimetype: mimetype || 'image/jpeg' }
    case 'video':
      return { video: { url: mediaUrl }, caption: caption || '', mimetype: mimetype || 'video/mp4' }
    case 'audio':
      return { audio: { url: mediaUrl }, mimetype: mimetype || 'audio/mpeg', ptt: false }
    case 'ptt':
      return { audio: { url: mediaUrl }, mimetype: mimetype || 'audio/ogg; codecs=opus', ptt: true }
    case 'document':
      return { document: { url: mediaUrl }, mimetype: mimetype || 'application/octet-stream', fileName: filename || 'file', caption: caption || '' }
    case 'sticker':
      return { sticker: { url: mediaUrl }, mimetype: mimetype || 'image/webp' }
    default:
      console.log(`[buildMediaPayload] unknown type "${mediaType}", using document`)
      return { document: { url: mediaUrl }, mimetype: mimetype || 'application/octet-stream', fileName: filename || 'file' }
  }
}

// ─── Download inbound media ────────────────────────────────
async function downloadInboundMedia(msg, msgType) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {})
    if (!buffer || !buffer.length) return null
    const m = msg.message || {}
    const mimes = {
      image:    m.imageMessage?.mimetype    || 'image/jpeg',
      video:    m.videoMessage?.mimetype    || 'video/mp4',
      audio:    m.audioMessage?.mimetype    || 'audio/ogg',
      ptt:      m.audioMessage?.mimetype    || 'audio/ogg; codecs=opus',
      document: m.documentMessage?.mimetype || 'application/octet-stream',
      sticker:  m.stickerMessage?.mimetype  || 'image/webp',
    }
    return {
      base64:   buffer.toString('base64'),
      mimeType: mimes[msgType] || 'application/octet-stream',
      filename: m.documentMessage?.fileName || null,
    }
  } catch (e) {
    console.error('[downloadInboundMedia] failed:', e.message)
    return null
  }
}

// ─── Create session ────────────────────────────────────────
async function createSession(instanceId) {
  console.log(`[${instanceId}] Starting session...`)

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
        console.log(`[${instanceId}] QR generated`)
        await notifyWabek('qr_updated', instanceId, { qrCode: qrDataUrl })
      } catch (e) { console.error(`[${instanceId}] QR error:`, e.message) }
    }

    if (connection === 'open') {
      const phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0]
      const displayName = sock.user?.name || sock.user?.notify
      const s = sessions.get(instanceId)
      if (s) { s.connected = true; s.phoneNumber = phoneNumber; s.qr = null }
      console.log(`[${instanceId}] Connected! Phone: ${phoneNumber}`)
      await notifyWabek('connected', instanceId, { phoneNumber, displayName })
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode : 0
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      console.log(`[${instanceId}] Disconnected. Code: ${statusCode}, Reconnect: ${shouldReconnect}`)
      const s = sessions.get(instanceId)
      if (s) s.connected = false
      await notifyWabek('disconnected', instanceId, { shouldReconnect, statusCode, loggedOut: statusCode === DisconnectReason.loggedOut })
      if (shouldReconnect) {
        setTimeout(() => createSession(instanceId).catch(e => console.error(`[${instanceId}] reconnect failed:`, e.message)), 5000)
      } else {
        // Logged out — clean up everything
        sessions.delete(instanceId)
        try { fs.rmSync(path.join(SESSIONS_DIR, instanceId), { recursive: true, force: true }) } catch {}
      }
    }
  })

  // ── Inbound messages ──────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (msg.key.fromMe) continue
      const from = msg.key.remoteJid || ''
      if (!from) continue

      const m = msg.message || {}
      const isPtt = !!m.audioMessage?.ptt

      const msgType =
        m.imageMessage              ? 'image'
        : m.videoMessage            ? 'video'
        : m.audioMessage && isPtt   ? 'ptt'
        : m.audioMessage            ? 'audio'
        : m.documentMessage         ? 'document'
        : m.stickerMessage          ? 'sticker'
        : 'text'

      const text =
        m.conversation              ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption     ||
        m.videoMessage?.caption     ||
        m.documentMessage?.caption  ||
        ''

      let mediaUrl = null, mimeType = null, filename = null
      if (msgType !== 'text') {
        const media = await downloadInboundMedia(msg, msgType)
        if (media) {
          mediaUrl = `data:${media.mimeType};base64,${media.base64}`
          mimeType = media.mimeType
          filename = media.filename
        }
      }

      await notifyWabek('message_received', instanceId, {
        messageId: msg.key.id,
        from,
        pushName:  msg.pushName || '',
        type:      msgType,
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
      await notifyWabek('message_status', instanceId, {
        messageId: update.key.id,
        status: statusMap[update.update.status] || 'sent',
      })
    }
  })

  return session
}

// ─── KEY FIX: getOrRestoreSession ─────────────────────────
// ALL routes call this instead of sessions.get() directly.
// If the instance isn't in memory (Railway restart / new Deploy),
// we check if credentials exist on disk and restore the session.
// This is what prevents "Instance not found" after Railway deploys.
async function getOrRestoreSession(instanceId) {
  // 1. Already in memory and connected/connecting → return immediately
  if (sessions.has(instanceId)) return sessions.get(instanceId)

  // 2. Check if credentials exist on disk (previous session)
  const credsFile = path.join(SESSIONS_DIR, instanceId, 'creds.json')
  if (!fs.existsSync(credsFile)) {
    console.log(`[${instanceId}] No credentials on disk — never connected`)
    return null
  }

  // 3. Credentials found → restore session
  console.log(`[${instanceId}] Not in memory but creds found on disk — restoring...`)
  try {
    await createSession(instanceId)
    // Wait up to 10s for connection to establish
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500))
      const s = sessions.get(instanceId)
      if (s?.connected) { console.log(`[${instanceId}] Restored and connected`); return s }
    }
    // Return even if not connected yet (sock is valid, send will work if credentials are fresh)
    return sessions.get(instanceId) || null
  } catch (e) {
    console.error(`[${instanceId}] restore failed:`, e.message)
    return null
  }
}

// ─── Restore all sessions on startup ──────────────────────
async function restoreSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return
  const dirs = fs.readdirSync(SESSIONS_DIR).filter(d =>
    fs.existsSync(path.join(SESSIONS_DIR, d, 'creds.json'))
  )
  if (!dirs.length) { console.log('No sessions to restore'); return }
  console.log(`Restoring ${dirs.length} session(s): ${dirs.join(', ')}`)
  // Restore concurrently with a small stagger to avoid overloading the WA servers
  for (const instanceId of dirs) {
    try {
      await createSession(instanceId)
      console.log(`Restored: ${instanceId}`)
      await new Promise(r => setTimeout(r, 1000)) // 1s stagger between sessions
    } catch (e) {
      console.error(`Failed to restore ${instanceId}:`, e.message)
    }
  }
}

// ─── Routes ───────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    sessions: sessions.size,
    instances: [...sessions.entries()].map(([id, s]) => ({
      id, connected: s.connected, phoneNumber: s.phoneNumber, hasQR: !!s.qr,
    })),
  })
})

app.post('/instance/:id/qr', auth, async (req, res) => {
  const { id } = req.params
  // Auto-create if not present
  if (!sessions.has(id)) {
    await createSession(id)
    await new Promise(r => setTimeout(r, 3000))
  }
  const session = sessions.get(id)
  if (!session) return res.status(500).json({ error: 'Failed to create session' })
  res.json({
    instanceId:  id,
    qrCode:      session.qr || null,
    connected:   session.connected,
    phoneNumber: session.phoneNumber,
    status:      session.connected ? 'connected' : session.qr ? 'qr_pending' : 'initializing',
  })
})

// ── /send: text OR any media type ─────────────────────────
// Backward-compatible: existing { to, text } calls are unaffected.
// New media calls: { to, mediaUrl, mediaType, caption?, filename?, mimetype? }
app.post('/instance/:id/send', auth, async (req, res) => {
  const { id } = req.params
  const { to, text, mediaUrl, mediaType, caption, filename, mimetype } = req.body

  if (!to) return res.status(400).json({ error: 'to required' })
  if (!text && !mediaUrl) return res.status(400).json({ error: 'text or mediaUrl required' })

  // KEY: use getOrRestoreSession, not sessions.get()
  const session = await getOrRestoreSession(id)
  if (!session) return res.status(404).json({ error: 'Instance not found — create it first via /qr' })
  if (!session.connected) return res.status(400).json({ error: 'Instance not connected — waiting for reconnect' })

  try {
    const jid = toJid(to)
    let result
    if (mediaUrl && mediaType) {
      const payload = buildMediaPayload(mediaType, mediaUrl, caption || text || '', filename, mimetype)
      console.log(`[${id}] send media type=${mediaType} to=${jid}`)
      result = await session.sock.sendMessage(jid, payload)
    } else {
      console.log(`[${id}] send text to=${jid}`)
      result = await session.sock.sendMessage(jid, { text })
    }
    res.json({ success: true, messageId: result?.key?.id })
  } catch (e) {
    console.error(`[${id}] send error:`, e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── /send-media: explicit media route ─────────────────────
app.post('/instance/:id/send-media', auth, async (req, res) => {
  const { id } = req.params
  const { to, mediaUrl, mediaType, caption, filename, mimetype } = req.body

  if (!to || !mediaUrl) return res.status(400).json({ error: 'to and mediaUrl required' })
  if (!mediaType) return res.status(400).json({ error: 'mediaType required' })

  const session = await getOrRestoreSession(id)
  if (!session) return res.status(404).json({ error: 'Instance not found — create it first via /qr' })
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

app.get('/instance/:id/status', auth, async (req, res) => {
  const { id } = req.params
  const session = await getOrRestoreSession(id)
  if (!session) return res.json({ instanceId: id, status: 'not_found', connected: false })
  res.json({
    instanceId:  id,
    connected:   session.connected,
    phoneNumber: session.phoneNumber,
    hasQR:       !!session.qr,
    qrCode:      session.qr,
    status:      session.connected ? 'connected' : session.qr ? 'qr_pending' : 'initializing',
  })
})

app.post('/instance/:id/disconnect', auth, async (req, res) => {
  const { id } = req.params
  const session = sessions.get(id) // intentional: if not in memory, nothing to disconnect
  if (session?.sock) {
    try { await session.sock.logout() } catch {}
    try { session.sock.end() } catch {}
  }
  sessions.delete(id)
  try { fs.rmSync(path.join(SESSIONS_DIR, id), { recursive: true, force: true }) } catch {}
  res.json({ success: true })
})

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

app.get('/instances', auth, (req, res) => {
  res.json({
    instances: [...sessions.entries()].map(([id, s]) => ({
      id, connected: s.connected, phoneNumber: s.phoneNumber,
      status: s.connected ? 'connected' : s.qr ? 'qr_pending' : 'initializing',
    })),
  })
})

// ─── Start ─────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`WABEK Baileys Server v5 — port ${PORT}`)
  console.log(`Routes: /health | /instance/:id/(qr|send|send-media|status|disconnect)`)
  if (!WABEK_EVENTS_URL) console.warn('⚠️  WABEK_EVENTS_URL not set')
  await restoreSessions()
})
