/**
 * WABEK Baileys Server — Built on v3 (the last stable version)
 * 
 * Changes from v3:
 * 1. messages.upsert: now downloads and forwards media (image/video/audio/ptt/document/sticker)
 * 2. /instance/:id/send: supports all media types, not just text and image
 * 3. /instance/:id/send-media: new explicit route for WABEK's sendWAWebMedia()
 * 4. Detailed logging throughout
 * 
 * Session management: IDENTICAL to v3 — no changes to createSession,
 * restoreSessions, or the sessions Map. This preserves the exact behavior
 * that was working before.
 */

const express = require('express')
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys')
const { Boom }  = require('@hapi/boom')
const QRCode    = require('qrcode')
const fs        = require('fs')
const path      = require('path')
const pino      = require('pino')

const app = express()
app.use(express.json({ limit: '50mb' }))

const PORT                = process.env.PORT              || 3001
const SERVER_SECRET       = process.env.SERVER_SECRET     || 'change-this-secret'
const WABEK_EVENTS_URL    = process.env.WABEK_EVENTS_URL
const WABEK_EVENTS_SECRET = process.env.WABEK_EVENTS_SECRET || SERVER_SECRET

const logger       = pino({ level: 'silent' })
const sessions     = new Map()
const SESSIONS_DIR = path.join(__dirname, 'sessions')
fs.mkdirSync(SESSIONS_DIR, { recursive: true })

// ─── Auth ──────────────────────────────────────────────────
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
    const r = await fetch(WABEK_EVENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Secret': WABEK_EVENTS_SECRET },
      body: JSON.stringify({ event, instanceId, data }),
    })
    if (!r.ok) console.error(`[${instanceId}] notify ${event} failed: ${r.status}`)
  } catch (e) {
    console.error(`[${instanceId}] notify error:`, e.message)
  }
}

// ─── JID helper ───────────────────────────────────────────
function toJid(to) {
  if (!to) return null
  if (to.includes('@')) return to
  return `${to.replace(/\D/g, '')}@s.whatsapp.net`
}

// ─── Build Baileys media payload ──────────────────────────
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
      console.log(`[buildMediaPayload] unknown type "${mediaType}", falling back to document`)
      return { document: { url: mediaUrl }, mimetype: mimetype || 'application/octet-stream', fileName: filename || 'file' }
  }
}

// ─── Download inbound media ────────────────────────────────
async function downloadInboundMedia(msg, msgType) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {})
    if (!buffer || !buffer.length) return null
    const m     = msg.message || {}
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

// ─── createSession — IDENTICAL TO V3 ──────────────────────
// (Only messages.upsert has additional media handling added)
async function createSession(instanceId) {
  console.log(`[${instanceId}] Creating session...`)

  const authDir = path.join(SESSIONS_DIR, instanceId)
  fs.mkdirSync(authDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version }          = await fetchLatestBaileysVersion()

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
      sessions.get(instanceId).connected    = true
      sessions.get(instanceId).phoneNumber  = phoneNumber
      sessions.get(instanceId).qr          = null
      console.log(`[${instanceId}] Connected! Phone: ${phoneNumber}`)
      await notifyWabek('connected', instanceId, { phoneNumber, displayName })
    }

    if (connection === 'close') {
      const statusCode     = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output?.statusCode : 0
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

  // messages.upsert: v3 logic + media download
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (msg.key.fromMe) continue
      const from = msg.key.remoteJid || ''
      if (!from) continue

      const m      = msg.message || {}
      const isPtt  = !!m.audioMessage?.ptt
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

      // Download media (non-blocking — failure doesn't affect text delivery)
      let mediaUrl = null, mimeType = null, filename = null
      if (msgType !== 'text') {
        try {
          const media = await downloadInboundMedia(msg, msgType)
          if (media) {
            mediaUrl = `data:${media.mimeType};base64,${media.base64}`
            mimeType  = media.mimeType
            filename  = media.filename
          }
        } catch (e) {
          console.error(`[${instanceId}] media download error (non-fatal):`, e.message)
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
      const status    = statusMap[update.update.status] || 'sent'
      await notifyWabek('message_status', instanceId, { messageId: update.key.id, status })
    }
  })

  return session
}

// ─── restoreSessions ──────────────────────────────────────
async function restoreSessions() {
  console.log(`[startup] Sessions dir: ${SESSIONS_DIR}`)
  console.log(`[startup] Dir exists: ${fs.existsSync(SESSIONS_DIR)}`)

  if (!fs.existsSync(SESSIONS_DIR)) {
    console.log('[startup] Sessions dir does not exist — no sessions to restore')
    return
  }

  const allEntries = fs.readdirSync(SESSIONS_DIR)
  console.log(`[startup] Entries in sessions dir: [${allEntries.join(', ')}]`)

  const dirs = allEntries.filter(d => {
    const credsFile = path.join(SESSIONS_DIR, d, 'creds.json')
    const hasCreds  = fs.existsSync(credsFile)
    if (!hasCreds) console.log(`[startup] Skipping ${d} — no creds.json`)
    return hasCreds
  })

  console.log(`[startup] Found ${dirs.length} session(s) with credentials: [${dirs.join(', ')}]`)

  if (dirs.length === 0) {
    console.log('[startup] ⚠️  No sessions found. This usually means:')
    console.log('[startup]    1. First run — no sessions created yet')
    console.log('[startup]    2. Railway redeployed without a Persistent Volume')
    console.log('[startup]    3. Sessions dir was wiped. Solution: add a Railway Volume at /app/sessions')
    return
  }

  for (const instanceId of dirs) {
    try {
      console.log(`[startup] Restoring ${instanceId}...`)
      await createSession(instanceId)
      console.log(`[startup] ✅ Restored: ${instanceId}`)
    } catch (e) {
      console.error(`[startup] ❌ Failed to restore ${instanceId}:`, e.message)
    }
  }
}

// ─── Routes ───────────────────────────────────────────────

app.get('/health', (req, res) => {
  const list = [...sessions.entries()].map(([id, s]) => ({ id, connected: s.connected, phoneNumber: s.phoneNumber, hasQR: !!s.qr }))
  console.log(`[health] sessions=${sessions.size} instances=${list.map(i => i.id).join(',')}`)
  res.json({ ok: true, sessions: sessions.size, instances: list })
})

// QR — IDENTICAL TO V3
app.post('/instance/:id/qr', auth, async (req, res) => {
  const { id } = req.params
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

// ── /send: text + all media (backward-compatible) ──────────
// v3 only handled text and image — now handles all types.
// Session lookup: sessions.get(id), SAME AS V3.
app.post('/instance/:id/send', auth, async (req, res) => {
  const { id } = req.params
  const { to, text, mediaUrl, mediaType, caption, filename, mimetype } = req.body

  // Log for debugging
  const loadedIds = [...sessions.keys()]
  console.log(`[${id}] /send requested. loaded sessions: [${loadedIds.join(', ')}]`)

  if (!to) return res.status(400).json({ error: 'to required' })
  if (!text && !mediaUrl) return res.status(400).json({ error: 'text or mediaUrl required' })

  const session = sessions.get(id)
  if (!session) {
    console.log(`[${id}] NOT FOUND. total loaded: ${sessions.size}. ids: [${loadedIds.join(', ')}]`)
    return res.status(404).json({ error: 'Instance not found', loaded: sessions.size, loadedIds })
  }
  if (!session.connected) {
    console.log(`[${id}] found but not connected`)
    return res.status(400).json({ error: 'Instance not connected' })
  }

  try {
    const jid = toJid(to)
    let result

    if (mediaUrl && mediaType) {
      const payload = buildMediaPayload(mediaType, mediaUrl, caption || text || '', filename, mimetype)
      console.log(`[${id}] sending media type=${mediaType} to=${jid}`)
      result = await session.sock.sendMessage(jid, payload)
    } else {
      console.log(`[${id}] sending text to=${jid}`)
      result = await session.sock.sendMessage(jid, { text })
    }

    res.json({ success: true, messageId: result?.key?.id })
  } catch (e) {
    console.error(`[${id}] send error:`, e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── /send-media: explicit media route ──────────────────────
// Same session lookup as /send (sessions.get).
app.post('/instance/:id/send-media', auth, async (req, res) => {
  const { id } = req.params
  const { to, mediaUrl, mediaType, caption, filename, mimetype } = req.body

  console.log(`[${id}] /send-media type=${mediaType} to=${to}`)

  if (!to || !mediaUrl) return res.status(400).json({ error: 'to and mediaUrl required' })
  if (!mediaType) return res.status(400).json({ error: 'mediaType required' })

  const session = sessions.get(id)
  if (!session) {
    const loadedIds = [...sessions.keys()]
    console.log(`[${id}] NOT FOUND. loaded: [${loadedIds.join(', ')}]`)
    return res.status(404).json({ error: 'Instance not found', loaded: sessions.size, loadedIds })
  }
  if (!session.connected) return res.status(400).json({ error: 'Instance not connected' })

  try {
    const jid     = toJid(to)
    const payload = buildMediaPayload(mediaType, mediaUrl, caption || '', filename, mimetype)
    const result  = await session.sock.sendMessage(jid, payload)
    res.json({ success: true, messageId: result?.key?.id })
  } catch (e) {
    console.error(`[${id}] send-media error:`, e.message)
    res.status(500).json({ error: e.message })
  }
})

// Status — same as v3
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

// Disconnect — same as v3
app.post('/instance/:id/disconnect', auth, async (req, res) => {
  const { id } = req.params
  const session = sessions.get(id)
  if (session?.sock) { try { await session.sock.logout() } catch {} try { session.sock.end() } catch {} }
  sessions.delete(id)
  try { fs.rmSync(path.join(SESSIONS_DIR, id), { recursive: true, force: true }) } catch {}
  res.json({ success: true })
})

// Delete — same as v3
app.delete('/instance/:id', auth, async (req, res) => {
  const { id } = req.params
  const session = sessions.get(id)
  if (session?.sock) { try { await session.sock.logout() } catch {} try { session.sock.end() } catch {} }
  sessions.delete(id)
  try { fs.rmSync(path.join(SESSIONS_DIR, id), { recursive: true, force: true }) } catch {}
  res.json({ success: true })
})

// List — same as v3
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
  console.log(`[startup] WABEK Baileys Server — port ${PORT}`)
  console.log(`[startup] NODE_ENV=${process.env.NODE_ENV || 'not set'}`)
  console.log(`[startup] __dirname=${__dirname}`)
  if (!WABEK_EVENTS_URL) console.warn('[startup] ⚠️  WABEK_EVENTS_URL not set')
  await restoreSessions()
  console.log(`[startup] Complete. ${sessions.size} session(s) loaded: [${[...sessions.keys()].join(', ')}]`)
})
