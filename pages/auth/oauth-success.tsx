// @ts-nocheck
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuthStore } from '@/lib/store'

// The OAuth callback sets the httpOnly `wabek_token` cookie; this page never
// accepts a token from the URL. It loads the session via the cookie only.
export default function OAuthSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    try { localStorage.removeItem('wabek_token') } catch {}
    useAuthStore.getState().setToken(null)

    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.user) {
          useAuthStore.getState().setUser(data.user)
          router.replace('/dashboard')
        } else {
          router.replace('/auth/login?error=oauth_failed')
        }
      })
      .catch(() => router.replace('/auth/login?error=oauth_failed'))
  }, [])

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Signing you in...</p>
      </div>
    </div>
  )
}
