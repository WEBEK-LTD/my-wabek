// @ts-nocheck
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuthStore } from '@/lib/store'
import axios from 'axios'

export default function OAuthCallbackPage() {
  const router = useRouter()
  const { setUser, setToken } = useAuthStore()
  const [status, setStatus] = useState('Completing sign in...')

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
        setStatus('Exchanging code...')
        window.location.replace(`/api/auth/oauth/callback?code=${encodeURIComponent(code)}`)
        return
      }
      router.replace('/auth/login?error=no_token')
      return
    }

    // Drop the provider token from the address bar / history.
    try { window.history.replaceState(null, '', window.location.pathname) } catch {}
    setStatus('Verifying your account...')
    axios.post('/api/auth/oauth/exchange', { access_token: accessToken })
      .then(({ data }) => {
        if (data.token) {
          localStorage.setItem('wabek_token', data.token)
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">{status}</p>
      </div>
    </div>
  )
}
