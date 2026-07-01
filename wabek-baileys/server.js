/**
 * WABEK Baileys Server v6 — Supabase Session Storage
 *
 * Sessions are stored in Supabase (wa_sessions table) instead of
 * Railway's ephemeral disk. This means sessions survive Railway
 * restarts and deploys without needing a Persistent Volume.
 *
 * Required environment variables:
 *   SERVER_SECRET         — shared secret for API auth
 *   WABEK_EVENTS_URL      — WABEK webhook endpoint
 *   WABEK_EVENTS_SECRET   — secret for WABEK webhook
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_KEY  — Supabase service role key
 */

const express  = require('express')
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  initAuthCreds,
  BufferJSON,
} = require('@whiskeysockets/baileys')
const { Boom }  = require('@hapi/boom')
const QRCode    = require('qrcode')
const pino      = require('pino')

const app = express()
app.use(express.json({ limit: '50mb' }))

const PORT                = process.env.PORT              || 3001
const SERVER_SECRET       = process.env.SERVER_SECRET     || 'change-this-secret'
const WABEK_EVENTS_URL    = process.env.WABEK_EVENTS_URL
const WABEK_EVENTS_SECRET = process.env.WABEK_EVENTS_SECRET || SERVER_SECRET
const SUPABASE_URL        = process.env.SUPABASE_URL
const SUPABASE_KEY        = process.env.SUPABASE_SERVICE_KEY

const logger   = pino({ level: 'silent' })
const sessions = new Map()

// ─── Supabase helper ──────────────────────────────────────
async function sbFetch(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const res  = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': opts.prefer || '',
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase ${path} ${res.status}: ${body}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// ─── Supabase Auth State ───────────────────────────────────
// Replaces useMultiFileAuthState — stores creds + keys in Supabase
async function useSupabaseAuthState(instanceId) {
  // Load existing session
  let row = null
  try {
    const rows = await sbFetch(`/wa_sessions?instance_id=eq.${encodeURIComponent(instanceId)}&select=creds,keys`)
    row = rows?.[0] || null
  } catch (e) {
    console.error(`[${instanceId}] load session error:`, e.message)
  }

  let creds = row?.creds ? JSON.parse(JSON.stringify(row.creds), BufferJSON.reviver) : initAuthCreds()
  let keys  = row?.keys  ? JSON.parse(JSON.stringify(row.keys),  BufferJSON.reviver) : {}

  const saveState = async () => {
    try {
      await sbFetch('/wa_sessions', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          instance_id: instanceId,
          creds:       JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
          keys:        JSON.parse(JSON.stringify(keys,  BufferJSON.replacer)),
          updated_at:  new Date().toISOString(),
        }),
      })
    } catch (e) {
      console.error(`[${instanceId}] save session error:`, e.message)
    }
  }

  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => {
          const data = {}
          for (const id of ids) {
            const val = keys[`${type}-${id}`]
            if (val) data[id] = val
          }
          return data
        },
        set: async (data) => {
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const val = data[category][id]
              if (val) keys[`${category}-${id}`] = val
              else delete keys[`${category}-${id}`]
            }
          }
          await saveState()
        },
      },
    },
    saveCreds: saveState,
    deleteSession: async () => {
      try {
        await sbFetch(`/wa_sessions?instance_id=eq.${encodeURIComponent(instanceId)}`, { method: 'DELETE' })
      } catch {}
    },
  }
}

// ─── Auth middleware ───────────────────────────────────────
function auth(req, res, next) {
  const secret = req.headers['x-secret'] || req.query.secret
  if (secret !== SERVER_SECRET) return res.status(403).json({ error: 'Forbidden' })
  next()
}

// ─── Notify WABEK ─────────────────────────────────────────
async function notifyWabek(event, instanceId, data) {
  if (!WABEK_EVENTS_URL) {
    console.log(`[${instanceId}] ${event} (no URL):`, JSON.stringify(data).slice(0, 150))
    return
  }
  try {
    const r = await fetch(WABEK_EVENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Secret': WABEK_EVENTS_SECRET },
      body: JSON.stringify({ event, instanceId, data }),
    })
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      console.error(`[${instanceId}] notify ${event} failed: ${r.status} ${body.slice(0, 150)}`)
    } else {
      console.log(`[${instanceId}] notify ${event} → ${r.status}`)
    }
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

// ─── Media payload builder ─────────────────────────────────
function buildMediaPayload(mediaType, mediaUrl, caption, filename, mimetype) {
  switch (mediaType) {
    case 'image':    return { image:    { url: mediaUrl }, caption: caption || '', mimetype: mimetype || 'image/jpeg' }
    case 'video':    return { video:    { url: mediaUrl }, caption: caption || '', mimetype: mimetype || 'video/mp4' }
    case 'audio':    return { audio:    { url: mediaUrl }, mimetype: mimetype || 'audio/mpeg', ptt: false }
    case 'ptt':      return { audio:    { url: mediaUrl }, mimetype: mimetype || 'audio/ogg; codecs=opus', ptt: true }
    case 'sticker':  return { sticker:  { url: mediaUrl }, mimetype: mimetype || 'image/webp' }
    case 'document':
    default:
      return { document: { url: mediaUrl }, mimetype: mimetype || 'application/octet-stream', fileName: filename || 'file', caption: caption || '' }
  }
}

// ─── Download inbound media ────────────────────────────────
async function downloadInboundMedia(msg, msgType) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {})
    if (!buffer?.length) return null
    const m = msg.message || {}
    const mimes = {
      image: m.imageMessage?.mimetype || 'image/jpeg', video: m.videoMessage?.mimetype || 'video/mp4',
      audio: m.audioMessage?.mimetype || 'audio/ogg', ptt: m.audioMessage?.mimetype || 'audio/ogg; codecs=opus',
      document: m.documentMessage?.mimetype || 'application/octet-stream', sticker: m.stickerMessage?.mimetype || 'image/webp',
    }
    return { base64: buffer.toString('base64'), mimeType: mimes[msgType] || 'application/octet-stream', filename: m.documentMessage?.fileName || null }
  } catch (e) {
    console.error('[downloadInboundMedia] failed:', e.message)
    return null
  }
}

// ─── Create session ────────────────────────────────────────
async function createSession(instanceId) {
  console.log(`[${instanceId}] Starting session (Supabase storage)...`)

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required for session storage')
  }

  const { state, saveCreds, deleteSession } = await useSupabaseAuthState(instanceId)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version, auth: state, logger,
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
      const s = sessions.get(instanceId)
      if (s) { s.connected = true; s.phoneNumber = phoneNumber; s.qr = null }
      console.log(`[${instanceId}] ✅ Connected! Phone: ${phoneNumber}`)
      await notifyWabek('connected', instanceId, { phoneNumber, displayName: sock.user?.name || '' })
    }

    if (connection === 'close') {
      const statusCode      = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output?.statusCode : 0
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      const s = sessions.get(instanceId)
      if (s) s.connected = false
      console.log(`[${instanceId}] Disconnected. Code: ${statusCode}, Reconnect: ${shouldReconnect}`)
      await notifyWabek('disconnected', instanceId, { shouldReconnect, statusCode, loggedOut: !shouldReconnect })
      if (shouldReconnect) {
        setTimeout(() => createSession(instanceId).catch(e => console.error(`[${instanceId}] reconnect failed:`, e.message)), 5000)
      } else {
        sessions.delete(instanceId)
        await deleteSession()
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (msg.key.fromMe) continue
      const rawJid = msg.key.remoteJid || ''
      if (!rawJid) continue
      const from = rawJid.endsWith('@s.whatsapp.net') ? rawJid.replace('@s.whatsapp.net', '') : rawJid

      const m = msg.message || {}, isPtt = !!m.audioMessage?.ptt
      const msgType = m.imageMessage ? 'image' : m.videoMessage ? 'video'
        : m.audioMessage && isPtt ? 'ptt' : m.audioMessage ? 'audio'
        : m.documentMessage ? 'document' : m.stickerMessage ? 'sticker' : 'text'

      const text = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption
        || m.videoMessage?.caption || m.documentMessage?.caption || ''

      let mediaUrl = null, mimeType = null, filename = null
      if (msgType !== 'text') {
        try {
          const media = await downloadInboundMedia(msg, msgType)
          if (media) { mediaUrl = `data:${media.mimeType};base64,${media.base64}`; mimeType = media.mimeType; filename = media.filename }
        } catch (e) { console.error(`[${instanceId}] media error:`, e.message) }
      }

      await notifyWabek('message_received', instanceId, {
        messageId: msg.key.id, from, pushName: msg.pushName || '',
        type: msgType, text, mediaUrl, mimeType, filename,
        timestamp: msg.messageTimestamp,
      })
    }
  })

  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      if (!update.update?.status) continue
      const statusMap = { 1: 'sent', 2: 'delivered', 3: 'read', 4: 'played' }
      await notifyWabek('message_status', instanceId, { messageId: update.key.id, status: statusMap[update.update.status] || 'sent' })
    }
  })

  return session
}

// ─── Restore all sessions from Supabase on startup ────────
async function restoreSessions() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[startup] ⚠️  SUPABASE_URL/SUPABASE_SERVICE_KEY not set — cannot restore sessions')
    return
  }
  try {
    const rows = await sbFetch('/wa_sessions?select=instance_id&order=updated_at.desc')
    console.log(`[startup] Found ${rows?.length || 0} session(s) in Supabase: ${(rows || []).map(r => r.instance_id).join(', ')}`)
    for (const row of rows || []) {
      try {
        await createSession(row.instance_id)
        console.log(`[startup] ✅ Restored: ${row.instance_id}`)
        await new Promise(r => setTimeout(r, 1000))
      } catch (e) {
        console.error(`[startup] ❌ Failed to restore ${row.instance_id}:`, e.message)
      }
    }
  } catch (e) {
    console.error('[startup] restore error:', e.message)
  }
}

// ─── Routes ───────────────────────────────────────────────

app.get('/health', (req, res) => {
  const list = [...sessions.entries()].map(([id, s]) => ({ id, connected: s.connected, phoneNumber: s.phoneNumber, hasQR: !!s.qr }))
  res.json({
    ok: true, sessions: sessions.size, instances: list,
    storage: SUPABASE_URL ? '✅ Supabase' : '❌ NOT CONFIGURED',
    env: {
      WABEK_EVENTS_URL:   WABEK_EVENTS_URL   || '⚠️  NOT SET',
      SUPABASE_URL:       SUPABASE_URL        ? '✅ set' : '⚠️  NOT SET',
      SUPABASE_KEY:       SUPABASE_KEY        ? '✅ set' : '⚠️  NOT SET',
    },
  })
})

app.post('/instance/:id/qr', auth, async (req, res) => {
  const { id } = req.params
  if (!sessions.has(id)) {
    await createSession(id)
    await new Promise(r => setTimeout(r, 3000))
  }
  const s = sessions.get(id)
  if (!s) return res.status(500).json({ error: 'Failed to create session' })
  res.json({ instanceId: id, qrCode: s.qr || null, connected: s.connected, phoneNumber: s.phoneNumber, status: s.connected ? 'connected' : s.qr ? 'qr_pending' : 'initializing' })
})

app.post('/instance/:id/send', auth, async (req, res) => {
  const { id } = req.params
  const { to, text, mediaUrl, mediaType, caption, filename, mimetype } = req.body
  if (!to || (!text && !mediaUrl)) return res.status(400).json({ error: 'to and (text or mediaUrl) required' })

  const s = sessions.get(id)
  console.log(`[${id}] /send to=${to} type=${mediaType || 'text'} loaded_sessions=[${[...sessions.keys()].join(',')}]`)
  if (!s) return res.status(404).json({ error: 'Instance not found', loaded: sessions.size })
  if (!s.connected) return res.status(400).json({ error: 'Instance not connected' })

  try {
    const jid = toJid(to)
    const result = mediaUrl && mediaType
      ? await s.sock.sendMessage(jid, buildMediaPayload(mediaType, mediaUrl, caption || text || '', filename, mimetype))
      : await s.sock.sendMessage(jid, { text })
    res.json({ success: true, messageId: result?.key?.id })
  } catch (e) {
    console.error(`[${id}] send error:`, e.message)
    res.status(500).json({ error: e.message })
  }
})

app.post('/instance/:id/send-media', auth, async (req, res) => {
  const { id } = req.params
  const { to, mediaUrl, mediaType, caption, filename, mimetype } = req.body
  if (!to || !mediaUrl || !mediaType) return res.status(400).json({ error: 'to, mediaUrl, mediaType required' })

  const s = sessions.get(id)
  if (!s) return res.status(404).json({ error: 'Instance not found' })
  if (!s.connected) return res.status(400).json({ error: 'Instance not connected' })

  try {
    const result = await s.sock.sendMessage(toJid(to), buildMediaPayload(mediaType, mediaUrl, caption || '', filename, mimetype))
    res.json({ success: true, messageId: result?.key?.id })
  } catch (e) {
    console.error(`[${id}] send-media error:`, e.message)
    res.status(500).json({ error: e.message })
  }
})

app.post('/instance/:id/restore', auth, async (req, res) => {
  const { id } = req.params
  if (sessions.has(id) && sessions.get(id).connected) {
    return res.json({ ok: true, status: 'already_connected', phoneNumber: sessions.get(id).phoneNumber })
  }
  try {
    const rows = await sbFetch(`/wa_sessions?instance_id=eq.${encodeURIComponent(id)}&select=instance_id`)
    if (!rows?.length) return res.status(404).json({ error: 'No saved credentials', needsQR: true })
    await createSession(id)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500))
      const s = sessions.get(id)
      if (s?.connected) return res.json({ ok: true, status: 'restored', phoneNumber: s.phoneNumber })
    }
    const s = sessions.get(id)
    return res.json({ ok: true, status: s?.qr ? 'qr_pending' : 'connecting' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/instance/:id/status', auth, (req, res) => {
  const s = sessions.get(req.params.id)
  if (!s) return res.json({ instanceId: req.params.id, status: 'not_found', connected: false })
  res.json({ instanceId: req.params.id, connected: s.connected, phoneNumber: s.phoneNumber, hasQR: !!s.qr, status: s.connected ? 'connected' : s.qr ? 'qr_pending' : 'initializing' })
})

app.post('/instance/:id/disconnect', auth, async (req, res) => {
  const { id } = req.params
  const s = sessions.get(id)
  if (s?.sock) { try { await s.sock.logout() } catch {} try { s.sock.end() } catch {} }
  sessions.delete(id)
  try { await sbFetch(`/wa_sessions?instance_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }) } catch {}
  res.json({ success: true })
})

app.delete('/instance/:id', auth, async (req, res) => {
  const { id } = req.params
  const s = sessions.get(id)
  if (s?.sock) { try { await s.sock.logout() } catch {} try { s.sock.end() } catch {} }
  sessions.delete(id)
  try { await sbFetch(`/wa_sessions?instance_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }) } catch {}
  res.json({ success: true })
})

app.get('/instances', auth, (req, res) => {
  res.json({ instances: [...sessions.entries()].map(([id, s]) => ({ id, connected: s.connected, phoneNumber: s.phoneNumber, status: s.connected ? 'connected' : s.qr ? 'qr_pending' : 'initializing' })) })
})

// ─── Start ─────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`WABEK Baileys Server v6 — port ${PORT} — Supabase session storage`)
  if (!SUPABASE_URL || !SUPABASE_KEY) console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY must be set!')
  if (!WABEK_EVENTS_URL) console.warn('⚠️  WABEK_EVENTS_URL not set')
  await restoreSessions()
  console.log(`[startup] Complete. ${sessions.size} session(s) loaded.`)
})
