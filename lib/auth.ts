import { SignJWT, jwtVerify } from 'jose'
import { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'

// Support all JWT secret variable name variants
const jwtSecretValue =
  process.env.JWT_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  process.env.SUPABASE_JWT_SECRET_KEY ||
  'fallback-secret-change-in-production'

const JWT_SECRET = new TextEncoder().encode(jwtSecretValue)

export interface JWTPayload {
  userId: string
  email: string
  role: 'user' | 'admin'
  iat?: number
  exp?: number
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function getTokenFromRequest(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  const cookie = req.cookies?.['wabek_token']
  return cookie || null
}

export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  const payload = await verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return null
  }
  return payload
}

export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<JWTPayload | null> {
  const user = await requireAuth(req, res)
  if (!user) return null
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Admin access required' })
    return null
  }
  return user
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const { randomBytes, createHash } = require('crypto')
  const key = `wbk_${randomBytes(32).toString('hex')}`
  const prefix = key.slice(0, 12)
  const hash = createHash('sha256').update(key).digest('hex')
  return { key, prefix, hash }
}
