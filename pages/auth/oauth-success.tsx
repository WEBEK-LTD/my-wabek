import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuthStore } from '@/lib/store'
import { AuthStatusScreen } from '@/components/auth/AuthParts'
import { useAuthCopy } from '@/components/auth/copy'

// The OAuth callback sets the httpOnly `wabek_token` cookie; this page never
// accepts a token from the URL. It loads the session via the cookie only.
export default function OAuthSuccessPage() {
  const router = useRouter()
  const { c } = useAuthCopy()

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

  return <AuthStatusScreen title={c('st_signing_in')} subtitle={c('st_wait')} />
}
