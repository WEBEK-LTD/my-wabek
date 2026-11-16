import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { AdjustmentsHorizontalIcon, BoltIcon, ChartBarIcon, CheckCircleIcon, CpuChipIcon, KeyIcon, SparklesIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { AreaChart, Badge, Button, Card, CardHeader, Field, Input, PageHeader, ProgressBar, Select, Skeleton, StatCard, Switch } from '@/components/ui'
import { apiError, useAdminT, type AdminT } from '@/components/admin/i18n'
import { ErrorState, Notice, SecretField } from '@/components/admin/shared'
import messages from '@/locales/admin/ai-settings'

const REVIEW_FIELDS = (t: AdminT<typeof messages.en>) => [
  { key: 'ai_review_interval_hours', label: t('reviewInterval'), def: '1', suffix: t('h'), hint: t('howOftenSchedulerRuns') },
  { key: 'ai_inactivity_hours', label: t('inactivityThreshold'), def: '2', suffix: t('h'), hint: t('conversationCountsAsEnded') },
  { key: 'ai_max_messages', label: t('maxMessagesAnalysed'), def: '100', suffix: '', hint: t('perConversationControlCost') },
  { key: 'ai_daily_limit', label: t('dailyRequestLimit'), def: '500', suffix: '', hint: t('maxAiCallsPer') },
]

export default function AISettingsPage() {
  const { t, fmtShort, fmtNumber } = useAdminT(messages)
  const qc = useQueryClient()
  const fields = useMemo(() => REVIEW_FIELDS(t), [t])
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; model?: string; provider?: string; error?: string } | null>(null)
  const [newKey, setNewKey] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})

  const { data, isLoading, isError, refetch } = useQuery<{ settings: Record<string, string> }>('admin-ai-settings', () => axios.get('/api/admin/ai-settings').then(r => r.data))
  const settings = useMemo(() => data?.settings || {}, [data])
  const initial = useMemo(() => {
    const f: Record<string, string> = { ai_provider: settings.ai_provider || 'deepseek' }
    for (const x of fields) f[x.key] = settings[x.key] || x.def
    return f
  }, [settings, fields])
  useEffect(() => { setForm(initial) }, [initial])
  const changed = Object.keys(form).filter(k => form[k] !== initial[k])

  const saveMut = useMutation((body: Record<string, string>) => axios.put('/api/admin/ai-settings', body), {
    onSuccess: () => { qc.invalidateQueries('admin-ai-settings'); toast.success(t('settingsSaved')) },
    onError: e => { toast.error(apiError(e, t('failedSave'))) },
  })
  const save = (updates: Record<string, string>) => saveMut.mutate(updates)

  const testConnection = async () => {
    setTesting(true); setTestResult(null)
    try {
      const r = await axios.post('/api/admin/ai-settings')
      setTestResult({ success: true, ...r.data })
      toast.success(t('connectionSuccessful'))
    } catch (e) {
      setTestResult({ success: false, error: apiError(e, t('failed')) })
      toast.error(t('connectionFailed'))
    }
    setTesting(false)
  }

  const enabled = settings.ai_reviews_enabled === 'true'
  const hasKey = settings.has_ai_deepseek_api_key === 'true'
  const today = new Date().toISOString().split('T')[0]
  const dailyUsage = parseInt(settings[`ai_usage_${today}`] || '0') || 0
  const monthlyUsage = parseInt(settings.ai_monthly_usage || '0') || 0
  const dailyLimit = parseInt(settings.ai_daily_limit || '500') || 500
  // The API returns per-day counters for the last 30 days (ai_usage_YYYY-MM-DD).
  const series = useMemo(() => {
    const days: { date: string; v: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
      days.push({ date: d, v: parseInt(settings[`ai_usage_${d}`] || '0') || 0 })
    }
    return days
  }, [settings])

  return (
    <AdminLayout title={t('aiSettings')}>
      <PageHeader className="mb-6"
        eyebrow={t('ai')}
        title={t('aiQualityReviews')}
        description={t('configureAiProviderHow')}
      />

      {isError ? <ErrorState onRetry={() => refetch()} /> : (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <Card variant="deep" padding="lg" className="relative overflow-hidden">
              <div aria-hidden="true" className="pointer-events-none absolute -end-12 -top-16 h-48 w-48 rounded-full bg-violet opacity-30 blur-3xl" />
              <div className="relative flex flex-wrap items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><SparklesIcon className="h-6 w-6 text-brand-green" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-white">{t('automaticReviews')}</p>
                  <p className="text-sm text-deep-muted">{t('analyseTeamConversationsAutomatically')}</p>
                </div>
                {isLoading ? <Skeleton className="h-7 w-12 opacity-30" /> : (
                  <Switch checked={enabled} disabled={saveMut.isLoading} onChange={v => save({ ai_reviews_enabled: v ? 'true' : 'false' })} aria-label={t('enableReviews')} />
                )}
              </div>
            </Card>

            <Card className="space-y-4">
              <CardHeader icon={CpuChipIcon} title={t('provider')} action={<Badge tone={hasKey ? 'success' : 'warning'} dot>{hasKey ? t('keySet') : t('noKey')}</Badge>} />
              {isLoading ? <Skeleton lines={3} /> : (
                <>
                  <Field label={t('aiProvider')} hint={t('deepseekDefaultSystemSupports')}>
                    <Select value={form.ai_provider || 'deepseek'} onChange={e => setForm(f => ({ ...f, ai_provider: e.target.value }))}
                      options={[{ value: 'deepseek', label: t('deepseekDefault') }, { value: 'openai', label: 'OpenAI' }]} />
                  </Field>
                  <Field label={t('apiKey')} hint={t('storedDatabaseNeverShown')}>
                    <SecretField stored={hasKey ? settings.ai_deepseek_api_key_masked : ''} value={newKey || (hasKey ? settings.ai_deepseek_api_key_masked : '')}
                      onChange={v => setNewKey(v.startsWith('••') ? '' : v)} placeholder="sk-…" />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {newKey && <Button icon={KeyIcon} loading={saveMut.isLoading} onClick={() => { save({ ai_deepseek_api_key: newKey }); setNewKey('') }}>{t('saveKey')}</Button>}
                    <Button variant="secondary" icon={BoltIcon} loading={testing} onClick={testConnection}>{t('testConnection')}</Button>
                  </div>
                  {testResult && (
                    <Notice tone={testResult.success ? 'success' : 'danger'} icon={testResult.success ? CheckCircleIcon : XCircleIcon}>
                      {testResult.success ? t('connectedModel', { model: testResult.model }) : testResult.error}
                    </Notice>
                  )}
                </>
              )}
            </Card>

            <Card className="space-y-4">
              <CardHeader icon={AdjustmentsHorizontalIcon} title={t('reviewSettings')} />
              {isLoading ? <Skeleton lines={4} /> : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {fields.map(fl => (
                      <Field key={fl.key} label={fl.label} hint={fl.hint}>
                        <Input type="number" dir="ltr" min={1} value={form[fl.key] || ''} onChange={e => setForm(f => ({ ...f, [fl.key]: e.target.value }))}
                          endAdornment={fl.suffix ? <span className="text-xs text-muted">{fl.suffix}</span> : undefined} />
                      </Field>
                    ))}
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-line-soft pt-4">
                    {changed.length > 0 && <Button variant="ghost" onClick={() => setForm(initial)}>{t('discard')}</Button>}
                    <Button loading={saveMut.isLoading} disabled={!changed.length} onClick={() => save(Object.fromEntries(changed.map(k => [k, form[k]])))}>{t('save')}</Button>
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="space-y-5 lg:col-span-2">
            <div className="grid grid-cols-2 gap-3.5">
              <StatCard loading={isLoading} icon={BoltIcon} label={t('requestsToday')} value={fmtNumber(dailyUsage)} />
              <StatCard loading={isLoading} icon={ChartBarIcon} label={t('last30Days')} value={fmtNumber(monthlyUsage)} />
            </div>
            <Card className="space-y-4">
              <CardHeader title={t('dailyUsage')} />
              <ProgressBar size="md" label={t('dailyLimit')} value={dailyUsage} max={dailyLimit}
                valueText={`${fmtNumber(dailyUsage)} / ${fmtNumber(dailyLimit)}`} tone={dailyUsage / dailyLimit > 0.9 ? 'danger' : dailyUsage / dailyLimit > 0.7 ? 'warning' : 'gradient'} />
              {isLoading ? <Skeleton className="h-40" /> : series.some(d => d.v > 0) ? (
                <AreaChart height={170} labels={series.map(d => fmtShort(d.date))} series={[{ name: t('requests'), data: series.map(d => d.v), color: '#B59CF5' }]}
                  ariaLabel={t('aiRequestsPerDay')} />
              ) : (
                <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">{t('noRequestsLast30')}</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
