import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'

interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  plan_id: string | null
  trial_ends_at: string | null
  phone?: string | null
  otp_mode?: string
  is_verified?: boolean
  last_login_at?: string
  last_login_ip?: string
  last_login_device?: string
  api_key?: string // no longer returned by /api/auth/me (see /api/settings/default-api-key)
  has_api_key?: boolean
  api_key_prefix?: string
  sub_account_of?: string | null
  member_role?: 'admin' | 'agent' | 'viewer' | null
  language?: string
  timezone?: string
}

/**
 * Session model
 * ─────────────
 * The server sets an HttpOnly `wabek_token` cookie on every login path
 * (password, OTP, OAuth, magic link, team invite) and every API route reads
 * it (`getTokenFromRequest`). The browser therefore never needs to store the
 * JWT: it is kept in memory only (`token`, never persisted) so that existing
 * code that reads it keeps working during the session, and page reloads rely
 * on the cookie alone.
 *
 * Only the non-secret profile (`user`) and the device fingerprint are
 * persisted. Legacy copies of the token in localStorage are removed.
 */
const LEGACY_TOKEN_KEY = 'wabek_token'

function dropLegacyToken() {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(LEGACY_TOKEN_KEY) } catch {}
}

interface AuthState {
  user: User | null
  /** In-memory bearer token (never persisted). Optional: the cookie is the session. */
  token: string | null
  deviceFingerprint: string | null
  loading: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => Promise<void>
  /** Load the profile from the session cookie (or the in-memory token). Resolves to the user or null. */
  fetchMe: () => Promise<User | null>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      deviceFingerprint: null,
      loading: false,

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),

      logout: async () => {
        // POST /api/auth/me expires the HttpOnly session cookie.
        try { await axios.post('/api/auth/me') } catch {}
        set({ user: null, token: null })
        dropLegacyToken()
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }
      },

      fetchMe: async () => {
        set({ loading: true })
        try {
          const { data } = await axios.get('/api/auth/me')
          const user = (data?.user as User) || null
          set({ user, loading: false })
          return user
        } catch (err: any) {
          const status = err?.response?.status
          // Only a definite "not signed in" clears the session; network or
          // 5xx errors keep the current profile.
          if (status === 401 || status === 403) set({ user: null, token: null })
          set({ loading: false })
          return status === 401 || status === 403 ? null : get().user
        }
      },
    }),
    {
      name: 'wabek-auth',
      version: 1,
      // v0 persisted the JWT; v1 never does.
      migrate: (persisted: any) => {
        if (persisted && typeof persisted === 'object') delete persisted.token
        dropLegacyToken()
        return persisted
      },
      partialize: (state) => ({
        user: state.user,
        deviceFingerprint: state.deviceFingerprint,
      }),
    }
  )
)

// Axios interceptors
if (typeof window !== 'undefined') {
  dropLegacyToken()

  axios.interceptors.request.use((config) => {
    // Same-origin requests carry the HttpOnly cookie automatically; the
    // in-memory token (if any) is sent as well for code paths that expect it.
    const token = useAuthStore.getState().token
    if (token && config.headers && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  axios.interceptors.response.use(
    (r) => {
      // The server rotates the session (e.g. after a password change): the
      // cookie is replaced server-side, and this header carries the new token
      // so the in-memory copy stays valid too.
      const rotated = r.headers?.['x-session-token']
      if (typeof rotated === 'string' && rotated && useAuthStore.getState().token) {
        useAuthStore.getState().setToken(rotated)
      }
      return r
    },
    (err) => {
      if (err.response?.status === 401 && window.location.pathname.startsWith('/dashboard')) {
        useAuthStore.setState({ user: null, token: null })
        dropLegacyToken()
        window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
      }
      return Promise.reject(err)
    }
  )
}
