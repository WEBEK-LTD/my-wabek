import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuthStore } from '@/lib/store'

/**
 * Client-side auth guard. The session lives in the HttpOnly `wabek_token`
 * cookie, so when no profile is cached we ask /api/auth/me (cookie-authenticated)
 * before deciding to redirect — sessions started by OAuth, magic links or a
 * reload are recognised without any token in browser storage.
 */
export function useAuth({ required = true, adminOnly = false } = {}) {
  const { user, loading, fetchMe, logout } = useAuthStore()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let alive = true
    if (useAuthStore.getState().user) {
      setChecked(true)
    } else {
      fetchMe().finally(() => { if (alive) setChecked(true) })
    }
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!checked || loading) return
    if (required && !user) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`)
      return
    }
    if (adminOnly && user && user.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [user, loading, checked, required, adminOnly])

  return { user, loading: loading || !checked, logout }
}

export function useRequireAuth() {
  return useAuth({ required: true })
}

export function useAdminAuth() {
  return useAuth({ required: true, adminOnly: true })
}
