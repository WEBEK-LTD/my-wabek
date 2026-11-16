import { SignJWT, jwtVerify } from 'jose'
import { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'crypto'
import { getJwtSecret, requireJwtSecret } from './security'
import { isMissingDbObject, warnMissingOnce } from './db-compat'

// The signing key is resolved lazily so `next build` does not crash when the
// env is not present at build time. Resolution: JWT_SECRET →
// SUPABASE_JWT_SECRET → SUPABASE_JWT_SECRET_KEY (same as the previous code, so
// existing sessions stay valid). There is NO hard-coded fallback: with none of
// them set every sign/verify fails closed.
let _jwtKey: Uint8Array | null = null
function jwtKey(): Uint8Array {
  if (!_jwtKey) _jwtKey = new TextEncoder().encode(requireJwtSecret())
  return _jwtKey
}

export function isJwtConfigured(): boolean {
  return !!getJwtSecret()
}

// Supabase signs its own access/anon/service tokens with SUPABASE_JWT_SECRET,
// which may be our signing key (fallback above). Those tokens must never be
// accepted as a WABEK session.
const SUPABASE_ROLES = new Set(['anon', 'authenticated', 'service_role', 'supabase_admin'])

export type MemberRole = 'admin' | 'agent' | 'viewer'

export interface JWTPayload {
  userId: string
  actualUserId?: string  // set when user is a sub-account (team member)
  email: string
  role: 'user' | 'admin'
  memberRole?: MemberRole // team_members.role when the caller is a team member
  tv?: number             // token_version at issue time (missing = 0)
  iat?: number
  exp?: number
}

const SESSION_MAX_AGE = 7 * 24 * 60 * 60

export async function signToken(payload: JWTPayload): Promise<string> {
  const claims: Record<string, unknown> = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    tv: typeof payload.tv === 'number' ? payload.tv : 0,
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(jwtKey())
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtKey(), { algorithms: ['HS256'] })
    if (typeof payload.userId !== 'string' || !payload.userId) return null
    if (typeof payload.role === 'string' && SUPABASE_ROLES.has(payload.role)) return null
    if (payload.iss === 'supabase' || (typeof payload.iss === 'string' && /supabase/i.test(payload.iss))) return null
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

// A valid cost-12 bcrypt hash of a random throwaway string. Used so that a
// login for a non-existent user (or an OAuth-only user without a password)
// costs the same as a real comparison — no timing oracle.
const DUMMY_HASH = '$2a$12$nN0.JxEmJ8neFHgcfXEpX.wnjpWuRWj0./TttE8E22MH6hMI2CFz.'

export async function comparePassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const usable = typeof hash === 'string' && /^\$2[aby]\$\d{2}\$.{53}$/.test(hash)
  try {
    const ok = await bcrypt.compare(String(password ?? ''), usable ? (hash as string) : DUMMY_HASH)
    return usable && ok
  } catch {
    return false
  }
}

export function getTokenFromRequest(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim()
    // A client with no in-memory token may still send "Bearer null"; fall
    // back to the HttpOnly session cookie in that case.
    if (bearer && bearer !== 'null' && bearer !== 'undefined') return bearer
  }
  const cookie = req.cookies?.['wabek_token']
  return cookie || null
}

// ── Session helpers ───────────────────────────────────────────────────────────
export function sessionCookie(token: string): string {
  return `wabek_token=${token}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

/** Sign a token for a DB user row, set the httpOnly cookie, and return the token. */
export async function issueSession(
  res: NextApiResponse,
  user: { id: string; email: string; role: string; token_version?: number | null }
): Promise<string> {
  const token = await signToken({
    userId: user.id,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'user',
    tv: typeof user.token_version === 'number' ? user.token_version : 0,
  })
  res.setHeader('Set-Cookie', sessionCookie(token))
  // Lets the SPA swap its stored bearer token when a session is rotated.
  res.setHeader('X-Session-Token', token)
  return token
}

/** Invalidate every outstanding token of a user. Returns the new version. */
export async function bumpTokenVersion(userId: string): Promise<number | null> {
  const { supabaseAdmin } = await import('./supabase')
  const db = supabaseAdmin()
  try {
    const { data, error } = await db.rpc('bump_token_version', { p_user_id: userId })
    if (!error && typeof data === 'number') return data
  } catch { /* fall through */ }
  try {
    const { data: u } = await db.from('users').select('token_version').eq('id', userId).maybeSingle()
    const next = ((u as { token_version?: number } | null)?.token_version || 0) + 1
    const { error } = await db.from('users').update({ token_version: next }).eq('id', userId)
    if (error) {
      // Migration 027 not applied: no revocation possible yet (old behaviour).
      if (isMissingDbObject(error)) warnMissingOnce('users.token_version (session revocation)', error)
      else console.error('[auth] bumpTokenVersion failed:', error.message)
      return null
    }
    return next
  } catch (e) {
    console.error('[auth] bumpTokenVersion error:', e)
    return null
  }
}

// ── Per-request authentication ────────────────────────────────────────────────
type AuthResult =
  | { ok: true; payload: JWTPayload }
  | { ok: false; status: number; error: string }

interface UserRow {
  id: string
  email: string
  role: string
  is_active: boolean | null
  sub_account_of: string | null
  token_version?: number | null
}

async function loadUserRow(id: string): Promise<{ row: UserRow | null; failed: boolean }> {
  const { supabaseAdmin } = await import('./supabase')
  const db = supabaseAdmin()
  let { data, error } = await db.from('users')
    .select('id, email, role, is_active, sub_account_of, token_version')
    .eq('id', id).maybeSingle()
  if (error && (isMissingDbObject(error) || /token_version/i.test(error.message || ''))) {
    warnMissingOnce('users.token_version', error)
    // Migration 027 not applied yet → every token is version 0.
    ;({ data, error } = await db.from('users')
      .select('id, email, role, is_active, sub_account_of')
      .eq('id', id).maybeSingle())
  }
  if (error) {
    console.error('[auth] user lookup failed:', error.message)
    return { row: null, failed: true }
  }
  return { row: (data as UserRow | null) || null, failed: false }
}

/**
 * Authenticate a request without writing a response. Loads the user from the
 * DB on every call: deleted/suspended users and revoked tokens are rejected,
 * and `role` always comes from the DB, never from the token.
 */
export async function getAuthUser(req: NextApiRequest): Promise<AuthResult> {
  const token = getTokenFromRequest(req)
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }
  if (!isJwtConfigured()) {
    console.error('[auth] No JWT signing secret configured (JWT_SECRET / SUPABASE_JWT_SECRET / SUPABASE_JWT_SECRET_KEY)')
    return { ok: false, status: 500, error: 'Server authentication is not configured' }
  }
  const claims = await verifyToken(token)
  if (!claims) return { ok: false, status: 401, error: 'Invalid or expired token' }

  let loaded: { row: UserRow | null; failed: boolean }
  try {
    loaded = await loadUserRow(claims.userId)
  } catch (e) {
    console.error('[auth] user lookup error:', e)
    return { ok: false, status: 503, error: 'Service unavailable' }
  }
  if (loaded.failed) return { ok: false, status: 503, error: 'Service unavailable' }
  const u = loaded.row
  if (!u) return { ok: false, status: 401, error: 'Invalid or expired token' }
  if (u.is_active === false) return { ok: false, status: 403, error: 'Account suspended' }

  const tokenTv = typeof claims.tv === 'number' ? claims.tv : 0
  const dbTv = typeof u.token_version === 'number' ? u.token_version : 0
  if (tokenTv < dbTv) return { ok: false, status: 401, error: 'Session expired. Please log in again.' }

  const base: JWTPayload = {
    userId: u.id,
    email: u.email,
    role: u.role === 'admin' ? 'admin' : 'user',
    tv: tokenTv,
    iat: claims.iat,
    exp: claims.exp,
  }

  // Sub-account (team member): all data calls run against the owner's ID,
  // but only while the membership is active.
  if (u.sub_account_of) {
    try {
      const { supabaseAdmin } = await import('./supabase')
      const { data: memberships, error } = await supabaseAdmin().from('team_members')
        .select('role, status')
        .eq('owner_id', u.sub_account_of)
        .eq('user_id', u.id)
        .eq('status', 'active')
        .limit(1)
      if (error) {
        console.error('[auth] membership lookup failed:', error.message)
        return { ok: false, status: 503, error: 'Service unavailable' }
      }
      const m = memberships?.[0]
      if (!m) return { ok: false, status: 403, error: 'Team access revoked' }
      const memberRole: MemberRole = (['admin', 'agent', 'viewer'] as const).includes(m.role) ? m.role : 'viewer'
      return { ok: true, payload: { ...base, userId: u.sub_account_of, actualUserId: u.id, memberRole } }
    } catch (e) {
      console.error('[auth] membership lookup error:', e)
      return { ok: false, status: 503, error: 'Service unavailable' }
    }
  }

  return { ok: true, payload: base }
}

export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<JWTPayload | null> {
  const r = await getAuthUser(req)
  if (!r.ok) {
    res.status(r.status).json({ error: r.error })
    return null
  }
  return r.payload
}

/**
 * Owner-only endpoints. Account owners always pass; team members pass only
 * if their team role is in `allowedMemberRoles` (default: none).
 */
export async function requireOwnerOrRole(
  req: NextApiRequest,
  res: NextApiResponse,
  allowedMemberRoles: readonly MemberRole[] = []
): Promise<JWTPayload | null> {
  const user = await requireAuth(req, res)
  if (!user) return null
  if (user.actualUserId) {
    if (!user.memberRole || !allowedMemberRoles.includes(user.memberRole)) {
      res.status(403).json({ error: 'Only the account owner can do this' })
      return null
    }
  }
  return user
}

// ── Team member permissions (server-side) ────────────────────────────────────
// Account owners and team `admin`s can do everything (unchanged). For the
// other team roles:
//   viewer → read-only: GET/HEAD only on tenant data.
//   agent  → read everything; write only in the inbox (chat, assignments,
//            notes, sending replies), contacts and quick replies.
// Endpoints that only ever touch the caller's own profile / password /
// devices / notifications keep using requireAuth.
export type MemberArea =
  | 'inbox' | 'contacts' | 'quick_replies'           // agent may write
  | 'campaigns' | 'automation' | 'chatbot' | 'ai' | 'segments' | 'links'
  | 'instances' | 'settings' | 'integrations' | 'team' | 'billing'

const AGENT_WRITE_AREAS: ReadonlySet<MemberArea> = new Set<MemberArea>(['inbox', 'contacts', 'quick_replies'])
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Whether a (team) caller may perform `method` in `area`. Owners/admins always may. */
export function memberCan(user: Pick<JWTPayload, 'actualUserId' | 'memberRole'>, area: MemberArea, method: string): boolean {
  if (!user.actualUserId) return true
  const role = user.memberRole || 'viewer'
  if (role === 'admin') return true
  if (READ_METHODS.has(String(method || 'GET').toUpperCase())) return true
  if (role === 'agent') return AGENT_WRITE_AREAS.has(area)
  return false
}

/**
 * requireAuth + team-role check for `area`. Writes (POST/PUT/PATCH/DELETE)
 * by a viewer, or by an agent outside inbox/contacts/quick replies, get 403
 * `{ code: 'member_forbidden' }`. Pass `opts.write` to treat a POST as a
 * write/read explicitly (e.g. a POST that only previews data → write:false).
 */
export async function requireMemberAccess(
  req: NextApiRequest,
  res: NextApiResponse,
  area: MemberArea,
  opts: { write?: boolean } = {}
): Promise<JWTPayload | null> {
  const user = await requireAuth(req, res)
  if (!user) return null
  const method = opts.write === undefined ? String(req.method || 'GET') : (opts.write ? 'POST' : 'GET')
  if (!memberCan(user, area, method)) {
    res.status(403).json({
      error: 'Your team role does not allow this action',
      code: 'member_forbidden',
      role: user.memberRole || 'viewer',
    })
    return null
  }
  return user
}

export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<JWTPayload | null> {
  const user = await requireAuth(req, res)
  if (!user) return null
  if (user.role !== 'admin' || user.actualUserId) {
    res.status(403).json({ error: 'Forbidden: Admin access required' })
    return null
  }
  return user
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `wbk_${randomBytes(32).toString('hex')}`
  const prefix = key.slice(0, 12)
  const hash = createHash('sha256').update(key).digest('hex')
  return { key, prefix, hash }
}

// ── OAuth (Supabase) user linking ─────────────────────────────────────────────
export const ALLOWED_OAUTH_PROVIDERS = ['google', 'github', 'facebook'] as const

export interface SupabaseOAuthUser {
  email?: string | null
  email_confirmed_at?: string | null
  app_metadata?: { provider?: string; providers?: string[] } | null
  user_metadata?: Record<string, any> | null
}

/**
 * Validate a Supabase auth user and find/create the matching local user.
 * Only verified emails from allow-listed OAuth providers are accepted —
 * otherwise anyone could sign up to Supabase with email+password using a
 * victim's address and be linked to the victim's account.
 */
export async function findOrCreateOAuthUser(oauthUser: SupabaseOAuthUser): Promise<
  | { ok: true; user: { id: string; email: string; name: string; role: string; token_version?: number | null }; avatar: string }
  | { ok: false; status: number; error: string; code: string }
> {
  const provider = oauthUser?.app_metadata?.provider
  if (!oauthUser?.email || !oauthUser.email_confirmed_at) {
    return { ok: false, status: 401, error: 'Email not verified by provider', code: 'oauth_unverified' }
  }
  if (!provider || !(ALLOWED_OAUTH_PROVIDERS as readonly string[]).includes(provider)) {
    return { ok: false, status: 401, error: 'Unsupported sign-in provider', code: 'oauth_provider' }
  }

  const email = String(oauthUser.email).toLowerCase().trim()
  const meta = oauthUser.user_metadata || {}
  const name = String(meta.full_name || meta.name || meta.user_name || email.split('@')[0]).slice(0, 100)
  const avatarRaw = meta.avatar_url || meta.picture || ''
  const avatar = typeof avatarRaw === 'string' && /^https:\/\//i.test(avatarRaw) ? avatarRaw.slice(0, 500) : ''

  const { supabaseAdmin } = await import('./supabase')
  const db = supabaseAdmin()
  const { data: existing, error: findErr } = await db.from('users')
    .select('*').eq('email', email).maybeSingle()
  if (findErr) {
    console.error('[oauth] user lookup failed:', findErr.message)
    return { ok: false, status: 500, error: 'Server error', code: 'server_error' }
  }

  if (existing) {
    if (existing.is_active === false) return { ok: false, status: 403, error: 'Account suspended', code: 'account_suspended' }
    await db.from('users').update({ ...(avatar ? { avatar_url: avatar } : {}) }).eq('id', existing.id)
    return { ok: true, user: existing, avatar }
  }

  const { getSetting } = await import('./settings')
  const allowReg = await getSetting('allow_registration', 'true')
  if (allowReg === 'false' || allowReg === false) {
    return { ok: false, status: 403, error: 'Registration is currently disabled', code: 'registration_disabled' }
  }

  const { v4: uuidv4 } = await import('uuid')
  const newUser = {
    id: uuidv4(),
    email,
    name,
    password_hash: '',
    role: 'user',
    is_active: true,
    is_verified: true,
    api_key: generateApiKey().key,
    ...(avatar ? { avatar_url: avatar } : {}),
    created_at: new Date().toISOString(),
  }
  const { error: insertError } = await db.from('users').insert(newUser)
  if (insertError) {
    console.error('[oauth] user insert failed:', insertError.message)
    return { ok: false, status: 500, error: 'Failed to create user', code: 'server_error' }
  }
  return { ok: true, user: { ...newUser, token_version: 0 }, avatar }
}
