import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuthStore } from '@/lib/store'

/**
 * Client-side auth guard.
 *
 * The session is the HttpOnly `wabek_token` cookie; the browser keeps no JWT
 * and the persisted profile in localStorage is only a display cache. On every
 * full page load the guard therefore asks /api/auth/me (cookie-authenticated)
 * once and waits for the answer before deciding anything — no redirect to
 * the login page happens while the session is still being resolved, and the
 * admin check uses the role the server returned, never the cached one.
 *
 * The check runs once per page load (module-level promise) and is shared by
 * every guard, so client-side navigation between protected pages is instant.
 * After a client-side login the login page calls `setUser`, so the guard sees
 * the fresh server profile even if an earlier check on this page load found
 * no session.
 */
let sessionCheck: Promise<unknown> | null = null
let sessionChecked = false

export function verifySession(force = false): Promise<unknown> {
  if (!sessionCheck || force) {
    sessionChecked = false
    sessionCheck = useAuthStore.getState().fetchMe()
      .catch(() => null)
      .finally(() => { sessionChecked = true })
  }
  return sessionCheck
}

/** True once the server session check of this page load has completed. */
export function isSessionChecked() {
  return sessionChecked
}

export function useAuth({ required = true, adminOnly = false } = {}) {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const router = useRouter()
  const [checked, setChecked] = useState(sessionChecked)

  useEffect(() => {
    let alive = true
    verifySession().then(() => { if (alive) setChecked(true) })
    return () => { alive = false }
  }, [])

  const allowed = !!user && (!adminOnly || user.role === 'admin')

  useEffect(() => {
    if (!checked || !router.isReady) return
    if (required && !user) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`)
      return
    }
    if (adminOnly && user && user.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [user, checked, required, adminOnly, router.isReady])

  return {
    user,
    /** True while the session is being resolved (render a loading state). */
    loading: !checked,
    /** True once the session is resolved and the user may see the page. */
    ready: checked && (!required || allowed),
    logout,
  }
}

export function useRequireAuth() {
  return useAuth({ required: true })
}

export function useAdminAuth() {
  return useAuth({ required: true, adminOnly: true })
}
