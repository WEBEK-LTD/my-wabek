// @ts-nocheck
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuthStore } from '@/lib/store'

export default function OAuthSuccessPage() {
  const router = useRouter()
  const { setToken } = useAuthStore()

  useEffect(() => {
    const { token } = router.query
    if (!token) {
      router.replace('/auth/login?error=oauth_failed')
      return
    }

    // Set token in localStorage (same as normal login)
    const tokenStr = decodeURIComponent(token as string)
    localStorage.setItem('wabek_token', tokenStr)
    setToken(tokenStr)

    // Fetch user data then redirect
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${tokenStr}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          useAuthStore.getState().setUser(data.user)
        }
        router.replace('/dashboard')
      })
      .catch(() => router.replace('/dashboard'))
  }, [router.query])

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Signing you in...</p>
      </div>
    </div>
  )
}
