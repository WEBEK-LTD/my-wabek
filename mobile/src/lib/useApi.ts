import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { api, ApiError } from './api'
import { useI18n } from '@/i18n'

/** Loads `path` (re-runs when it changes), with pull-to-refresh and optional polling while focused. */
export function useApi<T>(
  path: string | null,
  opts: { query?: Record<string, string | number | undefined | null>; pollMs?: number } = {},
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState<boolean>(!!path)
  const [refreshing, setRefreshing] = useState(false)
  const key = path ? path + JSON.stringify(opts.query || {}) : ''
  const keyRef = useRef(key)
  keyRef.current = key

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (!path) return
      if (mode === 'initial') setLoading(true)
      if (mode === 'refresh') setRefreshing(true)
      const myKey = key
      try {
        const d = await api<T>(path, { query: opts.query })
        if (keyRef.current === myKey) {
          setData(d)
          setError(null)
        }
      } catch (e) {
        if (keyRef.current === myKey && mode !== 'silent') setError(e instanceof ApiError ? e : new ApiError(0, 'network'))
      } finally {
        if (keyRef.current === myKey) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  useEffect(() => {
    void load('initial')
  }, [load])

  useFocusEffect(
    useCallback(() => {
      if (!opts.pollMs) return
      const id = setInterval(() => void load('silent'), opts.pollMs)
      return () => clearInterval(id)
    }, [load, opts.pollMs]),
  )

  return { data, setData, error, loading, refreshing, reload: () => load('initial'), refresh: () => load('refresh'), silentReload: () => load('silent') }
}

/** Human message for an API error, in the current language. */
export function useErrorText() {
  const { t, lang } = useI18n()
  return (e: unknown): string => {
    if (!(e instanceof ApiError)) return t('error_generic')
    if (e.status === 0) return t('error_network')
    if (e.status === 401) return t('error_session')
    if (e.code === 'PLAN_LIMIT') return t('error_plan_limit')
    if (e.code === 'member_forbidden' || e.code === 'owner_only') return t('error_forbidden')
    if (e.code === 'invalid_phone') return t('err_invalid_phone')
    if (e.code === 'pairing_failed') return t('err_pairing')
    if (e.code === 'WA_WEB_NOT_CONFIGURED') return t('err_server_not_ready')
    if (e.code === 'wrong_password') return t('err_wrong_password')
    // Server messages are English: show them as-is in English only.
    return lang === 'en' && e.message && !/^HTTP \d+$/.test(e.message) ? e.message : t('error_generic')
  }
}
