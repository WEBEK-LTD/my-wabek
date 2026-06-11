import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuthStore } from '@/lib/store'

export function useAuth({ required = true, adminOnly = false } = {}) {
  const { user, token, loading, fetchMe, logout } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!user && token) {
      fetchMe()
    }
  }, [])

  useEffect(() => {
    if (!loading) {
      if (required && !user) {
        router.replace(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`)
      }
      if (adminOnly && user?.role !== 'admin') {
        router.replace('/dashboard')
      }
    }
  }, [user, loading, required, adminOnly])

  return { user, loading, logout }
}

export function useRequireAuth() {
  return useAuth({ required: true })
}

export function useAdminAuth() {
  return useAuth({ required: true, adminOnly: true })
}
