import Constants from 'expo-constants'
import { getItem, setItem, removeItem, KEYS } from './storage'

export const API_URL: string = String(
  process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl || 'https://waabek.com',
).replace(/\/+$/, '')

export class ApiError extends Error {
  status: number
  code?: string
  data: Record<string, unknown>
  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.data = data
    this.code = typeof data.code === 'string' ? data.code : undefined
  }
}

let memToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

export async function loadToken(): Promise<string | null> {
  if (memToken) return memToken
  memToken = await getItem(KEYS.token)
  return memToken
}

export async function saveToken(token: string | null): Promise<void> {
  memToken = token
  if (token) {
    await setItem(KEYS.token, token)
    await setItem(KEYS.tokenAt, String(Date.now()))
  } else {
    await removeItem(KEYS.token)
    await removeItem(KEYS.tokenAt)
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export async function api<T = Record<string, unknown>>(
  path: string,
  opts: { method?: Method; body?: unknown; query?: Record<string, string | number | undefined | null>; auth?: boolean; form?: FormData } = {},
): Promise<T> {
  const url = new URL(API_URL + path)
  for (const [k, v] of Object.entries(opts.query || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  const headers: Record<string, string> = { Accept: 'application/json', 'X-WABEK-Client': 'mobile/1.0.0' }
  if (opts.auth !== false) {
    const token = await loadToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }

  let res: Response
  try {
    res = await fetch(url.toString(), { method: opts.method || (body ? 'POST' : 'GET'), headers, body })
  } catch {
    throw new ApiError(0, 'network')
  }
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = {}
  }
  if (!res.ok) {
    if (res.status === 401 && opts.auth !== false && onUnauthorized) onUnauthorized()
    throw new ApiError(res.status, typeof data.error === 'string' ? data.error : `HTTP ${res.status}`, data)
  }
  // The server may rotate the session (X-Session-Token).
  const rotated = res.headers.get('X-Session-Token')
  if (rotated && opts.auth !== false && rotated !== memToken) await saveToken(rotated)
  return data as T
}
