#!/usr/bin/env node
// Deploy readiness check for the security-redesign branch.
//
//   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service role key> \
//   node scripts/check-deploy.mjs
//
// READ-ONLY. It never writes to the database and never calls a function:
//   * tables / columns: GET /rest/v1/<table>?select=<col>&limit=0
//   * functions: the PostgREST OpenAPI document (GET /rest/v1/), or, if that
//     is disabled, POST /rest/v1/rpc/<fn> with a parameter name no function
//     has — PostgREST then answers "function not found" (PGRST202) without
//     executing anything, and its hint tells whether the function exists.
//   * storage bucket: GET /storage/v1/bucket/<id>
// Then prints which env vars from docs/DEPLOY_CHECKLIST.md are set in the
// CURRENT environment (names only, never values).
//
// No dependencies beyond Node 18+ (global fetch). Exit code 0 always; this
// is a report, not a gate.

const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  ''
).replace(/\/+$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''

// ── Objects created or changed by migrations 026–032 ────────────────────────
// kind: 'table' | 'column' | 'rpc' | 'bucket' | 'sql' (cannot be checked over
// PostgREST — shown with the SQL to run in the Supabase SQL editor).
const OBJECTS = [
  // 026
  { m: '026', kind: 'rpc', name: 'increment_ai_usage', fallback: 'read-modify-write AI counter' },
  { m: '026', kind: 'table', name: 'ai_usage_daily', fallback: 'daily AI cap not enforced' },
  { m: '026', kind: 'rpc', name: 'consume_ai_quota', fallback: 'daily AI cap not enforced' },
  { m: '026', kind: 'rpc', name: 'increment_link_clicks', fallback: 'non-atomic click counter' },
  { m: '026', kind: 'rpc', name: 'next_support_ticket_number', fallback: 'max(ticket_number)+1' },
  { m: '026', kind: 'column', table: 'status_messages', name: 'ip_address', fallback: 'contact form: no per-IP limit' },
  { m: '026', kind: 'rpc', name: 'dashboard_daily_messages', fallback: 'bounded row scan for the chart' },
  { m: '026', kind: 'sql', name: 'RLS lockdown (anon/authenticated revoked)', sql: "SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity;" },
  // 027
  { m: '027', kind: 'column', table: 'users', name: 'token_version', fallback: 'tv=0, no session revocation' },
  { m: '027', kind: 'column', table: 'otp_pending', name: 'attempts', fallback: 'OTP attempt counting skipped' },
  { m: '027', kind: 'column', table: 'otp_pending', name: 'is_used' },
  { m: '027', kind: 'column', table: 'otp_codes', name: 'attempts', fallback: 'OTP attempt counting skipped' },
  { m: '027', kind: 'column', table: 'team_members', name: 'invite_token' },
  { m: '027', kind: 'column', table: 'team_members', name: 'invite_expires_at', fallback: 'invited_at + 7 days' },
  { m: '027', kind: 'table', name: 'rate_limits', fallback: 'in-memory rate limiter' },
  { m: '027', kind: 'rpc', name: 'rate_limit_hit', fallback: 'in-memory rate limiter' },
  { m: '027', kind: 'table', name: 'processed_stripe_events', fallback: 'Stripe events processed without dedupe' },
  { m: '027', kind: 'rpc', name: 'bump_token_version', fallback: 'read-modify-write (needs token_version)' },
  { m: '027', kind: 'sql', name: 'uq_white_label_custom_domain_ci', sql: "SELECT indexname FROM pg_indexes WHERE indexname='uq_white_label_custom_domain_ci';" },
  // 028
  { m: '028', kind: 'column', table: 'reseller_payouts', name: 'idempotency_key', fallback: 'payout without idempotency key' },
  { m: '028', kind: 'rpc', name: 'reseller_add_earning', fallback: 'non-atomic balance update' },
  { m: '028', kind: 'rpc', name: 'reseller_record_payout', fallback: 'balance-checked legacy payout' },
  { m: '028', kind: 'bucket', name: 'brand-assets', fallback: 'created on first logo upload' },
  { m: '028', kind: 'sql', name: "subscriptions status CHECK incl. 'paused' / unique user_id", sql: "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.subscriptions'::regclass; SELECT indexname FROM pg_indexes WHERE tablename='subscriptions';" },
  { m: '028', kind: 'sql', name: 'reseller_earnings_payment_ref_uidx', sql: "SELECT indexname FROM pg_indexes WHERE indexname IN ('reseller_earnings_payment_ref_uidx','reseller_payouts_idempotency_uidx');" },
  // 029
  { m: '029', kind: 'sql', name: 'messages_inbound_instance_wa_id_uniq / wix_user_links_instance_uniq', sql: "SELECT indexname FROM pg_indexes WHERE indexname IN ('messages_inbound_instance_wa_id_uniq','wix_user_links_instance_uniq','idx_messages_instance_wa_message_id');" },
  // 031
  { m: '031', kind: 'table', name: 'api_idempotency_keys', fallback: 'Idempotency-Key ignored' },
  // 032
  { m: '032', kind: 'column', table: 'campaigns', name: 'template_name', fallback: 'stored in campaigns.meta' },
  { m: '032', kind: 'column', table: 'campaigns', name: 'template_language', fallback: 'stored in campaigns.meta' },
  { m: '032', kind: 'column', table: 'campaigns', name: 'template_variables', fallback: 'stored in campaigns.meta' },
  { m: '032', kind: 'column', table: 'zapier_hooks', name: 'secret', fallback: 'outgoing webhooks unsigned' },
  { m: '032', kind: 'column', table: 'zapier_hooks', name: 'last_status' },
  { m: '032', kind: 'column', table: 'zapier_hooks', name: 'last_error' },
  { m: '032', kind: 'column', table: 'zapier_hooks', name: 'failure_count' },
  { m: '032', kind: 'table', name: 'webhook_deliveries', fallback: 'failed webhooks not retried' },
]

// ── Env vars from docs/DEPLOY_CHECKLIST.md (Netlify) ────────────────────────
const ENV = [
  // [name | [alternatives], level, note when missing]
  [['JWT_SECRET', 'SUPABASE_JWT_SECRET', 'SUPABASE_JWT_SECRET_KEY'], 'required', 'auth fails closed (500)'],
  ['NEXT_PUBLIC_APP_URL', 'required', 'links default to https://waabek.com'],
  [['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_DATABASE_URL', 'SUPABASE_DATABASE_URL'], 'required', 'no database'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'required', 'OAuth sign-in unavailable'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'required', 'no database'],
  ['CRON_SECRET', 'recommended', 'derived from the JWT secret (HMAC wabek-cron-v1)'],
  ['WA_WEB_SERVER_URL', 'required', 'QR (Baileys) sending unavailable'],
  ['WA_WEB_SERVER_SECRET', 'required', 'wa-web-events accepts unauthenticated; QR sending fails'],
  ['WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'recommended', 'Meta webhook GET verification 403 (POST unaffected)'],
  [['META_APP_SECRET', 'META_APP_SECRETS'], 'recommended', 'Meta webhooks accepted unsigned'],
  ['STRIPE_SECRET_KEY', 'required', 'billing unavailable'],
  ['STRIPE_WEBHOOK_SECRET', 'required', 'billing webhook 500'],
  ['STRIPE_CONNECT_WEBHOOK_SECRET', 'recommended', 'falls back to STRIPE_WEBHOOK_SECRET'],
  ['WIX_APP_ID', 'required', 'Wix flows 503 (Wix app not configured)'],
  ['WIX_APP_SECRET', 'required', 'Wix flows 503 (Wix app not configured)'],
  ['WIX_PUBLIC_KEY', 'recommended', 'Wix order webhooks unverified; Wix billing webhook 503'],
  ['API_ACCESS_MODE', 'rollout', "log-only unless 'enforce'"],
  ['MESSAGE_LIMIT_MODE', 'rollout', "log-only unless 'enforce'"],
  ['PLAN_LIMIT_ZERO', 'rollout', "0 = unlimited unless 'none'"],
  [['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'], 'optional', 'rate_limit_hit() / in-memory limiter'],
  ['OAUTH_STATE_SECRET', 'optional', 'JWT secret signs OAuth state'],
  ['AI_USER_DAILY_LIMIT', 'optional', '100 per user per day'],
  ['ALLOW_QUERY_API_KEY', 'optional', 'query-string API keys accepted (deprecated)'],
]
// Values that should be reported (the rollout switches are not secrets).
const SHOW_VALUE = new Set(['API_ACCESS_MODE', 'MESSAGE_LIMIT_MODE', 'PLAN_LIMIT_ZERO', 'ALLOW_QUERY_API_KEY', 'AI_USER_DAILY_LIMIT'])

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function headers(extra = {}) {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra }
}

async function request(path, init = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: headers(init.headers), signal: ctrl.signal })
    const text = await r.text()
    let body = null
    try { body = text ? JSON.parse(text) : null } catch { body = text }
    return { status: r.status, body }
  } finally {
    clearTimeout(t)
  }
}

const MISSING_CODES = new Set(['42703', '42P01', '42883', 'PGRST204', 'PGRST205', 'PGRST202'])
function isMissing(body) {
  if (!body || typeof body !== 'object') return false
  if (MISSING_CODES.has(String(body.code || ''))) return true
  return /does not exist|could not find the .*schema cache/i.test(`${body.message || ''} ${body.details || ''}`)
}

let openapi = null
async function loadOpenApi() {
  try {
    const r = await request('/rest/v1/', { headers: { Accept: 'application/openapi+json' } })
    if (r.status === 200 && r.body && typeof r.body === 'object' && r.body.paths) openapi = r.body
  } catch { /* fall back to per-object probes */ }
}

async function checkTable(table) {
  const r = await request(`/rest/v1/${encodeURIComponent(table)}?select=*&limit=0`)
  if (r.status >= 200 && r.status < 300) return 'present'
  if (isMissing(r.body)) return 'missing'
  return `unknown (HTTP ${r.status}${r.body?.code ? ' ' + r.body.code : ''})`
}

async function checkColumn(table, column) {
  const r = await request(`/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(column)}&limit=0`)
  if (r.status >= 200 && r.status < 300) return 'present'
  if (isMissing(r.body)) {
    const text = `${r.body?.message || ''}`
    return /relation|table/i.test(text) && !/column/i.test(text) ? 'missing (table)' : 'missing'
  }
  return `unknown (HTTP ${r.status}${r.body?.code ? ' ' + r.body.code : ''})`
}

async function checkRpc(fn) {
  if (openapi) return openapi.paths[`/rpc/${fn}`] ? 'present' : 'missing'
  // A parameter name no function has: PostgREST resolves nothing and
  // executes nothing. Its hint names the function when it exists.
  const r = await request(`/rest/v1/rpc/${encodeURIComponent(fn)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ __wabek_deploy_probe__: null }),
  })
  if (r.status === 404 || r.body?.code === 'PGRST202') {
    return new RegExp(`\\b${fn}\\s*\\(`, 'i').test(String(r.body?.hint || '')) ? 'present' : 'missing (or not exposed)'
  }
  if (r.status >= 200 && r.status < 300) return 'present'
  return `unknown (HTTP ${r.status}${r.body?.code ? ' ' + r.body.code : ''})`
}

async function checkBucket(id) {
  const r = await request(`/storage/v1/bucket/${encodeURIComponent(id)}`)
  if (r.status === 200) return 'present'
  if (r.status === 404 || r.status === 400) return 'missing'
  return `unknown (HTTP ${r.status})`
}

// ── Output ───────────────────────────────────────────────────────────────────
function table(rows, cols) {
  const widths = cols.map((c, i) => Math.min(60, Math.max(c.length, ...rows.map(r => String(r[i] ?? '').length))))
  const line = (vals) => vals.map((v, i) => String(v ?? '').slice(0, 60).padEnd(widths[i])).join('  ')
  console.log(line(cols))
  console.log(widths.map(w => '-'.repeat(w)).join('  '))
  for (const r of rows) console.log(line(r))
}

async function main() {
  console.log('WABEK deploy check (read-only)\n')

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.log('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the database check — skipping it.\n')
  } else {
    let host = SUPABASE_URL
    try { host = new URL(SUPABASE_URL).host } catch { /* keep as is */ }
    console.log(`Database: ${host}`)
    await loadOpenApi()
    console.log(`Function lookup: ${openapi ? 'OpenAPI document' : 'PGRST202 probe (OpenAPI not available)'}\n`)

    const rows = []
    const sqlChecks = []
    for (const o of OBJECTS) {
      let label = o.kind === 'column' ? `${o.table}.${o.name}` : o.kind === 'rpc' ? `${o.name}()` : o.name
      let state
      try {
        if (o.kind === 'table') state = await checkTable(o.name)
        else if (o.kind === 'column') state = await checkColumn(o.table, o.name)
        else if (o.kind === 'rpc') state = await checkRpc(o.name)
        else if (o.kind === 'bucket') { label = `storage bucket ${o.name}`; state = await checkBucket(o.name) }
        else { state = 'check with SQL'; sqlChecks.push(o) }
      } catch (e) {
        state = `error: ${e?.name === 'AbortError' ? 'timeout' : e?.message || e}`
      }
      rows.push([o.m, o.kind, label, state, state.startsWith('missing') ? (o.fallback || '') : ''])
    }
    table(rows, ['mig', 'kind', 'object', 'state', 'fallback while missing'])

    const missing = rows.filter(r => String(r[3]).startsWith('missing'))
    const byMig = [...new Set(missing.map(r => r[0]))]
    console.log(`\n${missing.length} missing object(s)${byMig.length ? ` — apply migration(s): ${byMig.join(', ')}` : ''}.`)
    if (sqlChecks.length) {
      console.log('\nNot visible over PostgREST — run in the Supabase SQL editor:')
      for (const o of sqlChecks) console.log(`  -- ${o.m} ${o.name}\n  ${o.sql}`)
    }
    console.log('')
  }

  console.log('Environment variables in THIS environment (names only):\n')
  const envRows = ENV.map(([name, level, note]) => {
    const names = Array.isArray(name) ? name : [name]
    const set = names.filter(n => !!process.env[n])
    const label = names.join(' | ')
    let state = set.length ? `set (${set.join(', ')})` : 'missing'
    if (set.length && !Array.isArray(name) && SHOW_VALUE.has(name)) state = `set = ${process.env[name]}`
    return [level, label, state, set.length ? '' : note]
  })
  table(envRows, ['level', 'variable', 'state', 'behaviour while missing'])
  console.log('\nRailway (wabek-baileys) needs SERVER_SECRET (= WA_WEB_SERVER_SECRET), CRON_SECRET (= Netlify), SUPABASE_URL, SUPABASE_SERVICE_KEY, WABEK_EVENTS_URL — check them there.')
}

main().catch(e => {
  console.error('check-deploy failed:', e?.message || e)
  process.exitCode = 0
})
