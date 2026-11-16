import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuthStore } from '@/lib/store'
import { AuthStatusScreen } from '@/components/auth/AuthParts'
import { useAuthCopy } from '@/components/auth/copy'
import { safeRedirect } from '@/components/auth/session'

export default function MagicLogin() {
  const router = useRouter()
  const { c } = useAuthCopy()

  useEffect(() => {
    if (!router.isReady) return
    const token = router.query.token as string
    // Same-origin relative paths only ("/x", never "//host" or "/\\host").
    const redirect = safeRedirect(router.query.redirect)
    if (!token) { router.replace('/auth/login'); return }

    fetch('/api/auth/magic-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          // The server set the HttpOnly session cookie. Keep only the profile
          // (persisted) — the token itself is never written to storage.
          if (d.user) useAuthStore.getState().setUser(d.user)
          // Full page navigation so the app boots on the new session.
          setTimeout(() => { window.location.href = redirect }, 100)
        } else {
          router.replace('/auth/login?error=invalid_link')
        }
      })
      .catch(() => router.replace('/auth/login'))
  }, [router.isReady, router.query.token])

  return <AuthStatusScreen title={c('st_signing_in')} subtitle={c('st_magic_d')} />
}
