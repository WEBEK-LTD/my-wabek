import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { api, ApiError, loadToken, saveToken, setUnauthorizedHandler } from './api'
import { getItem, KEYS } from './storage'
import { registerPush, unregisterPush } from './push'

export interface Me {
  id: string
  email: string
  name: string | null
  role: 'user' | 'admin' | string
  phone: string | null
  otp_mode: string | null
  avatar_url?: string | null
  sub_account_of?: string | null
  plan_id?: string | null
  trial_ends_at?: string | null
  plan_expires_at?: string | null
  is_team_member?: boolean
  team_role?: string | null
}

type Status = 'loading' | 'signedOut' | 'signedIn'

interface AuthValue {
  status: Status
  me: Me | null
  isAdmin: boolean
  /** Store a token from login / verify / register and load the profile. */
  completeSignIn: (token: string) => Promise<void>
  refreshMe: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

const DAY = 24 * 60 * 60 * 1000

async function fetchMe(): Promise<Me> {
  const data = await api<{ user?: Me } & Partial<Me>>('/api/auth/me')
  const u = (data.user || data) as Me
  return u
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [me, setMe] = useState<Me | null>(null)
  const signingOut = useRef(false)

  const signOut = useCallback(async () => {
    if (signingOut.current) return
    signingOut.current = true
    try {
      await unregisterPush()
    } catch {
      /* best effort */
    }
    await saveToken(null)
    setMe(null)
    setStatus('signedOut')
    signingOut.current = false
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut()
    })
    return () => setUnauthorizedHandler(null)
  }, [signOut])

  /** Keep active users signed in: swap the token for a fresh one once a day. */
  const maybeRefreshToken = useCallback(async () => {
    const at = Number((await getItem(KEYS.tokenAt)) || 0)
    if (Date.now() - at < DAY) return
    try {
      const r = await api<{ token?: string }>('/api/mobile/session', { method: 'POST' })
      if (r.token) await saveToken(r.token)
    } catch {
      /* a 401 signs out through the handler; network errors are retried next time */
    }
  }, [])

  const refreshMe = useCallback(async () => {
    const u = await fetchMe()
    setMe(u)
  }, [])

  useEffect(() => {
    ;(async () => {
      const token = await loadToken()
      if (!token) {
        setStatus('signedOut')
        return
      }
      try {
        await maybeRefreshToken()
        setMe(await fetchMe())
        setStatus('signedIn')
        void registerPush()
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          await saveToken(null)
          setStatus('signedOut')
        } else {
          // Offline start: keep the session, screens show their own errors.
          setStatus('signedIn')
        }
      }
    })()
  }, [maybeRefreshToken])

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && status === 'signedIn') void maybeRefreshToken()
    })
    return () => sub.remove()
  }, [status, maybeRefreshToken])

  const completeSignIn = useCallback(async (token: string) => {
    await saveToken(token)
    const u = await fetchMe()
    setMe(u)
    setStatus('signedIn')
    void registerPush()
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ status, me, isAdmin: me?.role === 'admin', completeSignIn, refreshMe, signOut }),
    [status, me, completeSignIn, refreshMe, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
