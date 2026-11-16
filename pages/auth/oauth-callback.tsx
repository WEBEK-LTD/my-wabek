import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { useAuthStore } from '@/lib/store'
import { AuthStatusScreen } from '@/components/auth/AuthParts'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/auth'
import type { MessageKey as AuthCopyKey } from '@/locales/auth'

export default function OAuthCallbackPage() {
  const router = useRouter()
  const { setUser, setToken } = useAuthStore()
  const { t } = useT(messages)
  const [status, setStatus] = useState<AuthCopyKey>('st_completing')

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const error = params.get('error')
    const errorDescription = params.get('error_description')

    if (error) {
      router.replace(`/auth/login?error=${encodeURIComponent(errorDescription || error)}`)
      return
    }

    if (!accessToken) {
      // Maybe it's a query param redirect (PKCE flow)
      const qParams = new URLSearchParams(window.location.search)
      const code = qParams.get('code')
      if (code) {
        // PKCE / code flow: the server-side callback exchanges the code, sets
        // the httpOnly session cookie and redirects to /auth/oauth-success.
        setStatus('st_exchanging')
        window.location.replace(`/api/auth/oauth/callback?code=${encodeURIComponent(code)}`)
        return
      }
      router.replace('/auth/login?error=no_token')
      return
    }

    // Drop the provider token from the address bar / history.
    try { window.history.replaceState(null, '', window.location.pathname) } catch {}
    setStatus('st_verifying')
    axios.post('/api/auth/oauth/exchange', { access_token: accessToken })
      .then(({ data }) => {
        if (data.token) {
          // The exchange set the HttpOnly session cookie; the token is kept in memory only.
          setToken(data.token)
          setUser(data.user)
          router.replace('/dashboard')
        } else {
          router.replace('/auth/login?error=exchange_failed')
        }
      })
      .catch(e => {
        const msg = e?.response?.data?.error || 'server_error'
        const details = e?.response?.data?.details || ''
        console.error('Exchange failed:', msg, details)
        router.replace(`/auth/login?error=${encodeURIComponent(msg)}`)
      })
  }, [])

  return <AuthStatusScreen title={t(status)} subtitle={t('st_wait')} />
}
