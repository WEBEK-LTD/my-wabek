/**
 * WABEK Baileys Server v7
 *
 * Session strategy:
 * - Primary:  useMultiFileAuthState on disk (/app/sessions/) — same as v3
 * - Backup:   After every creds.update, mirror to Supabase wa_sessions table
 * - Restore:  On startup, if disk file missing but Supabase has creds, restore from Supabase first
 *
 * This means:
 * - Railway restart (disk survives): restore from disk instantly ✅
 * - Railway redeploy (disk wiped):   restore from Supabase backup ✅
 * - First QR scan:                   saves to both disk and Supabase ✅
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
const SUPABASE_URL        = process.env.SUPABASE_URL
const SUPABASE_KEY        = process.env.SUPABASE_SERVICE_KEY

const logger       = pino({ level: 'silent' })
const sessions     = new Map()
const SESSIONS_DIR = path.join(__dirname, 'sessions')
fs.mkdirSync(SESSIONS_DIR, { recursive: true })

// ─── Auth middleware ───────────────────────────────────────
function auth(req, res, next) {
  const s = req.headers['x-secret'] || req.query.secret
  if (s !== SERVER_SECRET) return res.status(403).json({ error: 'Forbidden' })
  next()
}

// ─── Notify WABEK ─────────────────────────────────────────
async function notifyWabek(event, instanceId, data) {
  if (!WABEK_EVENTS_URL) {
    console.log(`[${instanceId}] ${event}:`, JSON.stringify(data).slice(0, 150))
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
  } catch (e) { console.error(`[${instanceId}] notify error:`, e.message) }
}

// ─── Supabase session backup (fire-and-forget) ─────────────
async function backupToSupabase(instanceId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return
  try {
    const authDir = path.join(SESSIONS_DIR, instanceId)
    const files = {}
    if (fs.existsSync(authDir)) {
      for (const f of fs.readdirSync(authDir)) {
        files[f] = fs.readFileSync(path.join(authDir, f), 'utf8')
      }
    }
    if (!Object.keys(files).length) return

    await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        instance_id: instanceId,
        creds: files,
        keys: {},
        updated_at: new Date().toISOString(),
      }),
    })
  } catch (e) {
    console.error(`[${instanceId}] Supabase backup error:`, e.message)
  }
}

// ─── Restore from Supabase to disk if disk is empty ────────
async function restoreFromSupabase(instanceId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/wa_sessions?instance_id=eq.${encodeURIComponent(instanceId)}&select=creds`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    )
    if (!res.ok) return false
    const rows = await res.json()
    const files = rows?.[0]?.creds
    if (!files || !Object.keys(files).length) return false

    const authDir = path.join(SESSIONS_DIR, instanceId)
    fs.mkdirSync(authDir, { recursive: true })
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(authDir, name), content, 'utf8')
    }
    console.log(`[${instanceId}] Restored ${Object.keys(files).length} file(s) from Supabase`)
    return true
  } catch (e) {
    console.error(`[${instanceId}] Supabase restore error:`, e.message)
    return false
  }
}

// ─── JID helper ───────────────────────────────────────────
function toJid(to) {
  if (!to) return null
  if (to.includes('@')) return to
  return `${to.replace(/\D/g, '')}@s.whatsapp.net`
}

// ─── Media payload ─────────────────────────────────────────
function buildMediaPayload(mediaType, mediaUrl, caption, filename, mimetype) {
  switch (mediaType) {
    case 'image':   return { image:    { url: mediaUrl }, caption: caption || '', mimetype: mimetype || 'image/jpeg' }
    case 'video':   return { video:    { url: mediaUrl }, caption: caption || '', mimetype: mimetype || 'video/mp4' }
    case 'audio':   return { audio:    { url: mediaUrl }, mimetype: mimetype || 'audio/mpeg', ptt: false }
    case 'ptt':     return { audio:    { url: mediaUrl }, mimetype: mimetype || 'audio/ogg; codecs=opus', ptt: true }
    case 'sticker': return { sticker:  { url: mediaUrl }, mimetype: mimetype || 'image/webp' }
    default:        return { document: { url: mediaUrl }, mimetype: mimetype || 'application/octet-stream', fileName: filename || 'file', caption: caption || '' }
  }
}

// ─── Download inbound media ────────────────────────────────
async function downloadInboundMedia(msg, msgType) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {})
    if (!buffer?.length) return null
    const m = msg.message || {}
    const mimes = {
      image: m.imageMessage?.mimetype || 'image/jpeg',
      video: m.videoMessage?.mimetype || 'video/mp4',
      audio: m.audioMessage?.mimetype || 'audio/ogg',
      ptt:   m.audioMessage?.mimetype || 'audio/ogg; codecs=opus',
      document: m.documentMessage?.mimetype || 'application/octet-stream',
      sticker: m.stickerMessage?.mimetype || 'image/webp',
    }
    return {
      base64: buffer.toString('base64'),
      mimeType: mimes[msgType] || 'application/octet-stream',
      filename: m.documentMessage?.fileName || null,
    }
  } catch (e) {
    console.error('[downloadInboundMedia] failed:', e.message)
    return null
  }
}

// ─── Create session — same as v3 ──────────────────────────
async function createSession(instanceId) {
  console.log(`[${instanceId}] Creating session...`)

  const authDir = path.join(SESSIONS_DIR, instanceId)

  // If no local creds, try to restore from Supabase first
  const credsFile = path.join(authDir, 'creds.json')
  if (!fs.existsSync(credsFile)) {
    console.log(`[${instanceId}] No local creds, trying Supabase restore...`)
    await restoreFromSupabase(instanceId)
  }

  fs.mkdirSync(authDir, { recursive: true })
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version }          = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version, auth: state, logger,
    printQRInTerminal: false,
    // Use the same browser fingerprint every time — prevents WhatsApp from
    // seeing restarts as "new device" and avoids requiring re-auth
    browser: ['WABEK', 'Chrome', '126.0'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,   // more frequent pings = faster reconnect detection
    retryRequestDelayMs: 2000,
    // Provide getMessage so Baileys can retry failed message sends after reconnect
    getMessage: async (key) => {
      return { conversation: '' }
    },
  })

  const session = { sock, qr: null, connected: false, phoneNumber: null }
  sessions.set(instanceId, session)

  // Save to disk AND backup to Supabase on every creds update
  sock.ev.on('creds.update', async () => {
    await saveCreds()
    backupToSupabase(instanceId)  // fire-and-forget, non-blocking
  })

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
      // Priority: name → notify → undefined (don't send empty string — let backend keep existing DB value)
      const displayName = sock.user?.name || sock.user?.notify || undefined
      const s = sessions.get(instanceId)
      if (s) { s.connected = true; s.phoneNumber = phoneNumber; s.qr = null; s._reconnectAttempt = 0 }
      console.log(`[${instanceId}] ✅ Connected! Phone: ${phoneNumber} Name: ${displayName || '(none yet)'}`)
      await notifyWabek('connected', instanceId, { phoneNumber, ...(displayName ? { displayName } : {}) })
    }

    if (connection === 'close') {
      const statusCode      = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output?.statusCode : 0
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      const s = sessions.get(instanceId)
      if (s) s.connected = false
      console.log(`[${instanceId}] Disconnected. Code: ${statusCode}, Reconnect: ${shouldReconnect}`)
      await notifyWabek('disconnected', instanceId, { shouldReconnect, statusCode, loggedOut: !shouldReconnect })
      if (shouldReconnect) {
        // Exponential backoff: 5s, 10s, 20s, 40s, max 60s
        const s = sessions.get(instanceId)
        const attempt = (s?._reconnectAttempt || 0) + 1
        if (s) s._reconnectAttempt = attempt
        const delay = Math.min(5000 * Math.pow(2, attempt - 1), 60000)
        console.log(`[${instanceId}] Reconnecting in ${delay}ms (attempt ${attempt})`)
        setTimeout(() => createSession(instanceId).catch(e => console.error(`[${instanceId}] reconnect error:`, e.message)), delay)
      } else {
        sessions.delete(instanceId)
        try { fs.rmSync(authDir, { recursive: true, force: true }) } catch {}
        // Also delete from Supabase
        if (SUPABASE_URL && SUPABASE_KEY) {
          fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?instance_id=eq.${encodeURIComponent(instanceId)}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
          }).catch(() => {})
        }
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

      const text = m.conversation || m.extendedTextMessage?.text
        || m.imageMessage?.caption || m.videoMessage?.caption || m.documentMessage?.caption || ''

      let mediaUrl = null, mimeType = null, filename = null
      if (msgType !== 'text') {
        try {
          const media = await downloadInboundMedia(msg, msgType)
          if (media) {
            mediaUrl = `data:${media.mimeType};base64,${media.base64}`
            mimeType = media.mimeType
            filename = media.filename
          }
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
    for (const u of updates) {
      if (!u.update?.status) continue
      const statusMap = { 1: 'sent', 2: 'delivered', 3: 'read', 4: 'played' }
      await notifyWabek('message_status', instanceId, { messageId: u.key.id, status: statusMap[u.update.status] || 'sent' })
    }
  })

  // contacts.upsert fires after sync — check if sock.user now has the name
  sock.ev.on('contacts.upsert', async (contacts) => {
    try {
      // After contacts sync, sock.user.name is usually populated
      const name = sock.user?.name || sock.user?.notify
      if (name) {
        console.log(`[${instanceId}] contacts.upsert → displayName from sock.user: ${name}`)
        await notifyWabek('display_name_update', instanceId, { displayName: name })
        return
      }
      // Fallback: look for own number in the contacts list
      const myJid  = sock.user?.id || ''
      const myNum  = myJid.split(':')[0].split('@')[0]
      const me     = contacts.find(c => {
        const cNum = c.id.split(':')[0].split('@')[0]
        return cNum === myNum && myNum.length > 5
      })
      const fromList = me?.name || me?.notify || me?.pushName
      if (fromList) {
        console.log(`[${instanceId}] contacts.upsert → displayName from list: ${fromList}`)
        await notifyWabek('display_name_update', instanceId, { displayName: fromList })
      }
    } catch (e) { /* non-fatal */ }
  })

  // Also try after a short delay — sock.user.name may not be set immediately at connection.open
  sock.ev.on('connection.update', async (update) => {
    if (update.connection === 'open') {
      setTimeout(async () => {
        try {
          const name = sock.user?.name || sock.user?.notify
          if (name) {
            console.log(`[${instanceId}] delayed check → displayName: ${name}`)
            await notifyWabek('display_name_update', instanceId, { displayName: name })
          }
        } catch {}
      }, 5000)  // 5s after connection — usually enough for user info to populate
    }
  })

  return session
}

// ─── Restore sessions on startup ──────────────────────────
async function restoreSessions() {
  // 1. Get IDs from disk
  const diskIds = fs.existsSync(SESSIONS_DIR)
    ? fs.readdirSync(SESSIONS_DIR).filter(d => fs.existsSync(path.join(SESSIONS_DIR, d, 'creds.json')))
    : []

  // 2. Get IDs from Supabase backup
  let supabaseIds = []
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const res  = await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?select=instance_id&order=updated_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      })
      supabaseIds = ((await res.json()) || []).map(r => r.instance_id)
    } catch (e) { console.error('[startup] Supabase session list error:', e.message) }
  }

  // 3. Validate against WABEK DB — skip stale sessions not in whatsapp_instances
  let validIds = [...new Set([...diskIds, ...supabaseIds])]
  if (SUPABASE_URL && SUPABASE_KEY && validIds.length > 0) {
    try {
      const filter = validIds.map(id => `id.eq.${id}`).join(',')
      const res    = await fetch(
        `${SUPABASE_URL}/rest/v1/whatsapp_instances?select=id&or=(${filter})`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      )
      const rows = await res.json()
      const valid = new Set((rows || []).map(r => r.id))
      const before = validIds.length
      validIds = validIds.filter(id => valid.has(id))
      if (before !== validIds.length)
        console.log(`[startup] Skipped ${before - validIds.length} stale session(s) not in WABEK DB`)
    } catch (e) {
      console.error('[startup] WABEK validation error (proceeding with all):', e.message)
    }
  }

  console.log(`[startup] disk=[${diskIds.join(',')}] supabase=[${supabaseIds.join(',')}] restoring=[${validIds.join(',')}]`)

  for (const instanceId of validIds) {
    try {
      await createSession(instanceId)
      console.log(`[startup] ✅ Restored: ${instanceId}`)
      await new Promise(r => setTimeout(r, 1000))
    } catch (e) {
      console.error(`[startup] ❌ Failed ${instanceId}:`, e.message)
    }
  }
}

// ─── Routes ───────────────────────────────────────────────

app.get('/health', (req, res) => {
  const list = [...sessions.entries()].map(([id, s]) => ({ id, connected: s.connected, phoneNumber: s.phoneNumber, hasQR: !!s.qr }))
  res.json({
    ok: true, sessions: sessions.size, instances: list,
    env: {
      WABEK_EVENTS_URL: WABEK_EVENTS_URL || '⚠️ NOT SET',
      // Supabase is optional — used for session backup across deploys
      ...(SUPABASE_URL ? { SUPABASE_BACKUP: '✅ enabled' } : { SUPABASE_BACKUP: 'ℹ️ not configured (optional)' }),
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
  console.log(`[${id}] /send to=${to} sessions=[${[...sessions.keys()].join(',')}]`)
  if (!s) return res.status(404).json({ error: 'Instance not found', loaded: sessions.size })
  if (!s.connected) return res.status(400).json({ error: 'Instance not connected' })
  try {
    const jid    = toJid(to)
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
  if (sessions.has(id) && sessions.get(id).connected)
    return res.json({ ok: true, status: 'already_connected', phoneNumber: sessions.get(id).phoneNumber })
  const credsFile = path.join(SESSIONS_DIR, id, 'creds.json')
  const hasDisk   = fs.existsSync(credsFile)
  const hasSupa   = await restoreFromSupabase(id)
  if (!hasDisk && !hasSupa) return res.status(404).json({ error: 'No saved credentials', needsQR: true })
  try {
    await createSession(id)
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500))
      const s = sessions.get(id)
      if (s?.connected) return res.json({ ok: true, status: 'restored', phoneNumber: s.phoneNumber })
    }
    const s = sessions.get(id)
    return res.json({ ok: true, status: s?.qr ? 'qr_pending' : 'connecting' })
  } catch (e) { res.status(500).json({ error: e.message }) }
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
  try { fs.rmSync(path.join(SESSIONS_DIR, id), { recursive: true, force: true }) } catch {}
  if (SUPABASE_URL && SUPABASE_KEY) {
    fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?instance_id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    }).catch(() => {})
  }
  res.json({ success: true })
})

app.delete('/instance/:id', auth, async (req, res) => {
  const { id } = req.params
  const s = sessions.get(id)
  if (s?.sock) { try { await s.sock.logout() } catch {} try { s.sock.end() } catch {} }
  sessions.delete(id)
  try { fs.rmSync(path.join(SESSIONS_DIR, id), { recursive: true, force: true }) } catch {}
  if (SUPABASE_URL && SUPABASE_KEY) {
    fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?instance_id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    }).catch(() => {})
  }
  res.json({ success: true })
})

app.get('/instances', auth, (req, res) => {
  res.json({ instances: [...sessions.entries()].map(([id, s]) => ({ id, connected: s.connected, phoneNumber: s.phoneNumber, status: s.connected ? 'connected' : s.qr ? 'qr_pending' : 'initializing' })) })
})

app.listen(PORT, async () => {
  console.log(`WABEK Baileys Server v7 — port ${PORT}`)
  console.log(`Sessions: disk=${SESSIONS_DIR} + Supabase backup=${SUPABASE_URL ? '✅' : '⚠️ not configured'}`)
  if (!WABEK_EVENTS_URL) console.warn('⚠️  WABEK_EVENTS_URL not set')
  await restoreSessions()
  console.log(`[startup] Done. ${sessions.size} session(s) loaded.`)
})
