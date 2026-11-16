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
const crypto   = require('crypto')
const dns      = require('dns').promises
const net      = require('net')

const PORT                = process.env.PORT              || 3001
// The API below can read QR codes and send messages from every connected
// number, so SERVER_SECRET must be a long random value. We deliberately do
// NOT refuse to start without one: connected WhatsApp sessions must stay
// online through a deploy. A missing value keeps the previous default
// placeholder (so an existing WABEK deployment using it keeps working) and
// is reported loudly at startup and every hour until it is fixed.
const LEGACY_PLACEHOLDER_SECRET = 'change-this-secret'
const SERVER_SECRET       = process.env.SERVER_SECRET || LEGACY_PLACEHOLDER_SECRET
const SERVER_SECRET_WEAK  = !process.env.SERVER_SECRET || SERVER_SECRET === LEGACY_PLACEHOLDER_SECRET || SERVER_SECRET.length < 16
function warnWeakServerSecret() {
  if (!SERVER_SECRET_WEAK) return
  console.error('⚠️  SECURITY WARNING: SERVER_SECRET is missing, too short, or still "change-this-secret". ' +
    'Anyone who knows it can read QR codes and send messages. Set a long random SERVER_SECRET on Railway ' +
    'and the SAME value as WA_WEB_SERVER_SECRET on Netlify, then redeploy both. (Sessions are not affected by the change.)')
}
warnWeakServerSecret()
if (SERVER_SECRET_WEAK) setInterval(warnWeakServerSecret, 60 * 60 * 1000).unref()

const app = express()
app.disable('x-powered-by')

// CORS: this API is called server-to-server only. No cross-origin browser
// access unless an origin is listed in CORS_ALLOWED_ORIGINS (comma-separated).
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && CORS_ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Secret')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(express.json({ limit: '50mb' }))

const WABEK_EVENTS_URL    = process.env.WABEK_EVENTS_URL
const WABEK_EVENTS_SECRET = process.env.WABEK_EVENTS_SECRET || SERVER_SECRET
const SUPABASE_URL        = process.env.SUPABASE_URL
const SUPABASE_KEY        = process.env.SUPABASE_SERVICE_KEY

const logger       = pino({ level: 'silent' })
const sessions     = new Map()
// Reconnect attempts per instance. Kept outside the session object because
// every reconnect replaces that object (createSession), which used to reset
// the counter and keep the backoff at 5s forever. Reset on 'open'.
const reconnectAttempts = new Map()
// Where QR sessions live on disk. Railway's container disk is wiped on every
// deploy/restart, so a Volume must be attached for sessions to survive:
// set SESSIONS_DIR, or attach a Railway Volume (RAILWAY_VOLUME_MOUNT_PATH is
// set automatically). Without either, the Supabase backup below is the only
// thing that keeps numbers connected across deploys.
const DEFAULT_SESSIONS_DIR = path.join(__dirname, 'sessions')
function resolveSessionsDir() {
  if (process.env.SESSIONS_DIR) return process.env.SESSIONS_DIR
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH
  if (mount) return path.resolve(mount) === path.resolve(DEFAULT_SESSIONS_DIR) ? DEFAULT_SESSIONS_DIR : path.join(mount, 'wa-sessions')
  return DEFAULT_SESSIONS_DIR
}
const SESSIONS_DIR = resolveSessionsDir()
const SESSIONS_PERSISTENT = !!(process.env.SESSIONS_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH)
const STARTED_AT = Date.now()
let RESTORE_DONE = false
fs.mkdirSync(SESSIONS_DIR, { recursive: true })

// ─── Auth middleware ───────────────────────────────────────
// Header only (WABEK always sends X-Secret); never the query string, which
// ends up in access logs. Constant-time comparison.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false
  const ab = Buffer.from(a), bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}
function isAuthed(req) {
  return safeEqual(req.headers['x-secret'], SERVER_SECRET)
}
function auth(req, res, next) {
  if (!isAuthed(req)) return res.status(403).json({ error: 'Forbidden' })
  next()
}

// Instance ids are UUIDs from WABEK; anything else could escape SESSIONS_DIR.
app.param('id', (req, res, next, id) => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return res.status(400).json({ error: 'Invalid instance id' })
  next()
})

// ─── SSRF guard for outbound media URLs ───────────────────
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  }
  const v6 = String(ip).toLowerCase()
  if (v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')) return true
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return mapped ? isPrivateIp(mapped[1]) : false
}

async function assertPublicUrl(raw) {
  let url
  try { url = new URL(raw) } catch { throw new Error('Invalid media URL') }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Media URL scheme not allowed')
  if (url.username || url.password) throw new Error('Media URL not allowed')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) throw new Error('Media host not allowed')
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true })
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('Media host not allowed')
  return url
}

const MAX_MEDIA_DOWNLOAD = 64 * 1024 * 1024

/** Download a media URL with the private-IP check on every redirect hop, a timeout and a size cap. */
async function safeDownload(raw) {
  let current = raw
  for (let hop = 0; hop <= 3; hop++) {
    await assertPublicUrl(current)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 30000)
    try {
      const r = await fetch(current, { redirect: 'manual', signal: ctrl.signal })
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        current = new URL(r.headers.get('location'), current).toString()
        continue
      }
      if (!r.ok) throw new Error(`Media download failed (${r.status})`)
      const len = Number(r.headers.get('content-length') || 0)
      if (len > MAX_MEDIA_DOWNLOAD) throw new Error('Media too large')
      const chunks = []
      let size = 0
      for await (const chunk of r.body) {
        size += chunk.length
        if (size > MAX_MEDIA_DOWNLOAD) { ctrl.abort(); throw new Error('Media too large') }
        chunks.push(Buffer.from(chunk))
      }
      return Buffer.concat(chunks)
    } finally {
      clearTimeout(t)
    }
  }
  throw new Error('Too many redirects')
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

// ─── Supabase session backup ──────────────────────────────
// Mirrors the whole auth folder (creds.json + every key file) to wa_sessions.
// Triggered on creds.update AND on every signal-key write (keys.set), debounced
// so bursts of key updates produce one upload. Failures are logged — the old
// version ignored the response, which is how backups silently never happened.
const backupTimers = new Map()
let lastBackupError = ''
function scheduleBackup(instanceId, delayMs = 2000) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return
  clearTimeout(backupTimers.get(instanceId))
  backupTimers.set(instanceId, setTimeout(() => {
    backupTimers.delete(instanceId)
    backupToSupabase(instanceId)
  }, delayMs))
}

async function backupToSupabase(instanceId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false
  try {
    const authDir = path.join(SESSIONS_DIR, instanceId)
    const files = {}
    if (fs.existsSync(authDir)) {
      for (const f of fs.readdirSync(authDir)) {
        const full = path.join(authDir, f)
        if (fs.statSync(full).isFile()) files[f] = fs.readFileSync(full, 'utf8')
      }
    }
    if (!files['creds.json']) return false

    const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?on_conflict=instance_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        instance_id: instanceId,
        creds: files,
        keys: {},
        updated_at: new Date().toISOString(),
      }),
    })
    if (!r.ok) {
      const detail = (await r.text().catch(() => '')).slice(0, 200)
      const msg = `HTTP ${r.status} ${detail}`
      if (msg !== lastBackupError) console.error(`[${instanceId}] ❌ Supabase session backup FAILED: ${msg} — check SUPABASE_URL / SUPABASE_SERVICE_KEY (must be the service_role key)`)
      lastBackupError = msg
      return false
    }
    lastBackupError = ''
    return true
  } catch (e) {
    console.error(`[${instanceId}] ❌ Supabase session backup error:`, e.message)
    return false
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
// `media` is the downloaded Buffer (never a URL: Baileys would fetch it
// itself, without the private-network check above).
function buildMediaPayload(mediaType, media, caption, filename, mimetype) {
  switch (mediaType) {
    case 'image':   return { image:    media, caption: caption || '', mimetype: mimetype || 'image/jpeg' }
    case 'video':   return { video:    media, caption: caption || '', mimetype: mimetype || 'video/mp4' }
    case 'audio':   return { audio:    media, mimetype: mimetype || 'audio/mpeg', ptt: false }
    case 'ptt':     return { audio:    media, mimetype: mimetype || 'audio/ogg; codecs=opus', ptt: true }
    case 'sticker': return { sticker:  media, mimetype: mimetype || 'image/webp' }
    default:        return { document: media, mimetype: mimetype || 'application/octet-stream', fileName: filename || 'file', caption: caption || '' }
  }
}

// ─── Inbound media → Supabase storage (optional) ──────────
// When SUPABASE_URL/SUPABASE_SERVICE_KEY are set, inbound media is uploaded
// to the same public `wa-media` bucket WABEK uses and only its URL is sent
// to WABEK (large base64 bodies otherwise hit the serverless body limit).
// Falls back to the previous data: URL if the upload fails.
// Set UPLOAD_INBOUND_MEDIA=0 to always send data: URLs.
const MEDIA_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/aac': 'aac', 'audio/mp4': 'm4a', 'audio/amr': 'amr',
  'application/pdf': 'pdf', 'text/plain': 'txt',
  'application/msword': 'doc', 'application/vnd.ms-excel': 'xls', 'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}
async function uploadInboundMedia(instanceId, buffer, mimeType) {
  if (!SUPABASE_URL || !SUPABASE_KEY || process.env.UPLOAD_INBOUND_MEDIA === '0') return null
  try {
    const base = String(mimeType || '').split(';')[0].trim().toLowerCase()
    const contentType = MEDIA_EXT[base] ? base : 'application/octet-stream'
    const objectPath = `inbound/${instanceId}/${crypto.randomUUID()}.${MEDIA_EXT[base] || 'bin'}`
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/wa-media/${objectPath}`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'false' },
      body: buffer,
    })
    if (!r.ok) { console.error(`[${instanceId}] media upload failed: ${r.status}`); return null }
    return `${SUPABASE_URL}/storage/v1/object/public/wa-media/${objectPath}`
  } catch (e) {
    console.error(`[${instanceId}] media upload error:`, e.message)
    return null
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
      buffer,
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
  // Signal keys change without a creds.update; back them up too, otherwise a
  // restored session has stale keys and WhatsApp logs the device out.
  const originalKeysSet = state.keys.set.bind(state.keys)
  state.keys.set = async (data) => {
    await originalKeysSet(data)
    scheduleBackup(instanceId)
  }
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
    scheduleBackup(instanceId)
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
      if (s) { s.connected = true; s.phoneNumber = phoneNumber; s.qr = null }
      reconnectAttempts.delete(instanceId)
      console.log(`[${instanceId}] ✅ Connected! Phone: ${phoneNumber} Name: ${displayName || '(none yet)'}`)
      scheduleBackup(instanceId, 500)
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
        const attempt = (reconnectAttempts.get(instanceId) || 0) + 1
        reconnectAttempts.set(instanceId, attempt)
        const delay = Math.min(5000 * Math.pow(2, attempt - 1), 60000)
        console.log(`[${instanceId}] Reconnecting in ${delay}ms (attempt ${attempt})`)
        setTimeout(() => {
          // Deleted / disconnected meanwhile → don't bring it back.
          if (!sessions.has(instanceId)) { reconnectAttempts.delete(instanceId); return }
          createSession(instanceId).catch(e => console.error(`[${instanceId}] reconnect error:`, e.message))
        }, delay)
      } else {
        reconnectAttempts.delete(instanceId)
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
            mediaUrl = await uploadInboundMedia(instanceId, media.buffer, media.mimeType)
              || `data:${media.mimeType};base64,${media.buffer.toString('base64')}`
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
      // Baileys proto.WebMessageInfo.Status: 0 ERROR, 1 PENDING, 2 SERVER_ACK,
      // 3 DELIVERY_ACK, 4 READ, 5 PLAYED. messages.status only allows
      // pending/sent/delivered/read/failed.
      const code = u.update?.status
      if (code == null) continue
      const statusMap = { 0: 'failed', 1: 'sent', 2: 'sent', 3: 'delivered', 4: 'read', 5: 'read' }
      const status = statusMap[code]
      if (!status) continue
      await notifyWabek('message_status', instanceId, { messageId: u.key.id, status })
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

// Numbers WABEK believes are connected but whose session could not be loaded
// here are reported as logged out, so the dashboard asks for a new QR scan
// instead of showing "connected" while every send fails.
async function reportMissingSessions() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_instances?select=id&instance_type=eq.wa_web&status=eq.connected`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    })
    if (!r.ok) return
    const rows = await r.json()
    for (const { id } of rows || []) {
      if (sessions.has(id)) continue
      console.warn(`[${id}] marked connected in WABEK but no session here — reporting logged out`)
      await notifyWabek('disconnected', id, { shouldReconnect: false, loggedOut: true, reason: 'session_missing' })
    }
  } catch (e) { console.error('[startup] missing-session report error:', e.message) }
}

// ─── Routes ───────────────────────────────────────────────

app.get('/health', (req, res) => {
  // Unauthenticated: just liveness for Railway. Details need X-Secret.
  if (!isAuthed(req)) return res.json({ ok: true })
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
      ? await s.sock.sendMessage(jid, buildMediaPayload(mediaType, await safeDownload(mediaUrl), caption || text || '', filename, mimetype))
      : await s.sock.sendMessage(jid, { text })
    res.json({ success: true, messageId: result?.key?.id })
  } catch (e) {
    console.error(`[${id}] send error:`, e.message)
    res.status(500).json({ error: 'Send failed' })
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
    const media  = await safeDownload(mediaUrl)
    const result = await s.sock.sendMessage(toJid(to), buildMediaPayload(mediaType, media, caption || '', filename, mimetype))
    res.json({ success: true, messageId: result?.key?.id })
  } catch (e) {
    console.error(`[${id}] send-media error:`, e.message)
    res.status(500).json({ error: 'Media send failed' })
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
  } catch (e) {
    console.error(`[${id}] restore error:`, e.message)
    res.status(500).json({ error: 'Restore failed' })
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
  reconnectAttempts.delete(id)
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
  reconnectAttempts.delete(id)
  try { fs.rmSync(path.join(SESSIONS_DIR, id), { recursive: true, force: true }) } catch {}
  if (SUPABASE_URL && SUPABASE_KEY) {
    fetch(`${SUPABASE_URL}/rest/v1/wa_sessions?instance_id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    }).catch(() => {})
  }
  res.json({ success: true })
})

app.get('/instances', auth, (req, res) => {
  res.json({
    startedAt: new Date(STARTED_AT).toISOString(),
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    restoreDone: RESTORE_DONE,
    persistent: SESSIONS_PERSISTENT,
    supabaseBackup: !!(SUPABASE_URL && SUPABASE_KEY),
    instances: [...sessions.entries()].map(([id, s]) => ({ id, connected: s.connected, phoneNumber: s.phoneNumber, status: s.connected ? 'connected' : s.qr ? 'qr_pending' : 'initializing' })),
  })
})

app.listen(PORT, async () => {
  console.log(`WABEK Baileys Server v7 — port ${PORT}`)
  console.log(`Sessions: disk=${SESSIONS_DIR} + Supabase backup=${SUPABASE_URL ? '✅' : '⚠️ not configured'}`)
  if (!WABEK_EVENTS_URL) console.warn('⚠️  WABEK_EVENTS_URL not set')
  if (!SESSIONS_PERSISTENT && !(SUPABASE_URL && SUPABASE_KEY)) {
    console.error('🚨 QR sessions are NOT persistent: no Railway Volume (SESSIONS_DIR / RAILWAY_VOLUME_MOUNT_PATH) and no Supabase backup (SUPABASE_URL + SUPABASE_SERVICE_KEY). Every deploy/restart will log out all QR numbers.')
  } else if (!SESSIONS_PERSISTENT) {
    console.warn('⚠️  No Railway Volume: sessions survive restarts only through the Supabase backup. Attaching a Volume is recommended.')
  }
  await restoreSessions()
  RESTORE_DONE = true
  console.log(`[startup] Done. ${sessions.size} session(s) loaded. sessionsDir=${SESSIONS_DIR} persistent=${SESSIONS_PERSISTENT}`)
  await reportMissingSessions()

  // ── AI Quality Review Scheduler ─────────────────────────
  // Runs every hour to analyze inactive conversations
  const NETLIFY_URL   = process.env.NETLIFY_URL   || process.env.WABEK_EVENTS_URL?.replace('/api/whatsapp/wa-web-events', '')
  // WABEK's cron endpoints check CRON_SECRET; set the same value here.
  // Falls back to SERVER_SECRET (previous behaviour).
  const REVIEW_SECRET = process.env.CRON_SECRET || SERVER_SECRET

  async function runAIReviews() {
    if (!NETLIFY_URL) {
      console.log('[ai-review-cron] NETLIFY_URL not set, skipping')
      return
    }
    try {
      console.log('[ai-review-cron] Starting scheduled review run...')
      const r = await fetch(`${NETLIFY_URL}/api/ai/review-scheduler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': REVIEW_SECRET,
        },
      })
      const data = await r.json().catch(() => ({}))
      console.log(`[ai-review-cron] Done:`, data)
    } catch (err) {
      console.error('[ai-review-cron] Error:', err?.message)
    }
  }

  // Run once on startup after 30s delay, then every hour
  setTimeout(runAIReviews, 30 * 1000)
  setInterval(runAIReviews, 60 * 60 * 1000)
})
