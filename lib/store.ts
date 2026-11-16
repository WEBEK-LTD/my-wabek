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

interface AuthState {
  user: User | null
  token: string | null
  deviceFingerprint: string | null
  loading: boolean
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
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
        try { await axios.post('/api/auth/me') } catch {}
        set({ user: null, token: null })
        if (typeof window !== 'undefined') {
          localStorage.removeItem('wabek_token')
          window.location.href = '/auth/login'
        }
      },

      fetchMe: async () => {
        const token = get().token || (typeof window !== 'undefined' ? localStorage.getItem('wabek_token') : null)
        if (!token) return
        try {
          const { data } = await axios.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          })
          set({ user: data.user, token })
        } catch {
          set({ user: null, token: null })
          if (typeof window !== 'undefined') localStorage.removeItem('wabek_token')
        }
      },
    }),
    {
      name: 'wabek-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        deviceFingerprint: state.deviceFingerprint,
      }),
    }
  )
)

// Axios interceptor
if (typeof window !== 'undefined') {
  axios.interceptors.request.use((config) => {
    const state = useAuthStore.getState()
    const token = state.token || localStorage.getItem('wabek_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  axios.interceptors.response.use(
    (r) => {
      // The server rotates the session (e.g. after a password change) and
      // sends the replacement token in this header.
      const rotated = r.headers?.['x-session-token']
      if (typeof rotated === 'string' && rotated && useAuthStore.getState().token) {
        useAuthStore.getState().setToken(rotated)
        try { localStorage.setItem('wabek_token', rotated) } catch {}
      }
      return r
    },
    (err) => {
      if (err.response?.status === 401 && window.location.pathname.startsWith('/dashboard')) {
        localStorage.removeItem('wabek_token')
        window.location.href = '/auth/login'
      }
      return Promise.reject(err)
    }
  )
}
