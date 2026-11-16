import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { AdjustmentsHorizontalIcon, BoltIcon, ChartBarIcon, CheckCircleIcon, CpuChipIcon, KeyIcon, SparklesIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { AreaChart, Badge, Button, Card, CardHeader, Field, Input, PageHeader, ProgressBar, Select, Skeleton, StatCard, Switch, formatNumber } from '@/components/ui'
import { apiError, useAdminT } from '@/components/admin/i18n'
import { ErrorState, Notice, SecretField } from '@/components/admin/shared'

const REVIEW_FIELDS = (tr: (a: string, e: string) => string) => [
  { key: 'ai_review_interval_hours', label: tr('فاصل المراجعة', 'Review interval'), def: '1', suffix: tr('ساعة', 'h'), hint: tr('كل كم ساعة يعمل المجدول', 'How often the scheduler runs') },
  { key: 'ai_inactivity_hours', label: tr('حد الخمول', 'Inactivity threshold'), def: '2', suffix: tr('ساعة', 'h'), hint: tr('تُعدّ المحادثة منتهية بعد هذا الصمت', 'A conversation counts as ended after this much silence') },
  { key: 'ai_max_messages', label: tr('أقصى رسائل للتحليل', 'Max messages analysed'), def: '100', suffix: '', hint: tr('لكل محادثة، للتحكم في التكلفة', 'Per conversation, to control cost') },
  { key: 'ai_daily_limit', label: tr('حد الطلبات اليومي', 'Daily request limit'), def: '500', suffix: '', hint: tr('أقصى طلبات يومية لكل الحسابات', 'Max AI calls per day across all accounts') },
]

export default function AISettingsPage() {
  const { tr, fmtShort } = useAdminT()
  const qc = useQueryClient()
  const fields = useMemo(() => REVIEW_FIELDS(tr), [tr])
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
    onSuccess: () => { qc.invalidateQueries('admin-ai-settings'); toast.success(tr('حُفظت الإعدادات', 'Settings saved')) },
    onError: e => { toast.error(apiError(e, tr('تعذّر الحفظ', 'Failed to save'))) },
  })
  const save = (updates: Record<string, string>) => saveMut.mutate(updates)

  const testConnection = async () => {
    setTesting(true); setTestResult(null)
    try {
      const r = await axios.post('/api/admin/ai-settings')
      setTestResult({ success: true, ...r.data })
      toast.success(tr('الاتصال ناجح', 'Connection successful'))
    } catch (e) {
      setTestResult({ success: false, error: apiError(e, tr('فشل الاتصال', 'Failed')) })
      toast.error(tr('فشل الاتصال', 'Connection failed'))
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
    <AdminLayout title={tr('إعدادات الذكاء الاصطناعي', 'AI settings')}>
      <PageHeader className="mb-6"
        eyebrow={tr('الذكاء الاصطناعي', 'AI')}
        title={tr('مراجعات الجودة بالذكاء الاصطناعي', 'AI quality reviews')}
        description={tr('اضبط مزوّد الذكاء الاصطناعي وإعدادات تحليل محادثات الفرق. لا يرى العملاء هذه الصفحة.', 'Configure the AI provider and how team conversations are analysed. Customers can’t see this page.')}
      />

      {isError ? <ErrorState onRetry={() => refetch()} /> : (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <Card variant="deep" padding="lg" className="relative overflow-hidden">
              <div aria-hidden="true" className="pointer-events-none absolute -end-12 -top-16 h-48 w-48 rounded-full bg-violet opacity-30 blur-3xl" />
              <div className="relative flex flex-wrap items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><SparklesIcon className="h-6 w-6 text-brand-green" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-white">{tr('المراجعات التلقائية', 'Automatic reviews')}</p>
                  <p className="text-sm text-deep-muted">{tr('تحليل محادثات الفريق تلقائيًا بالذكاء الاصطناعي', 'Analyse team conversations automatically with AI')}</p>
                </div>
                {isLoading ? <Skeleton className="h-7 w-12 opacity-30" /> : (
                  <Switch checked={enabled} disabled={saveMut.isLoading} onChange={v => save({ ai_reviews_enabled: v ? 'true' : 'false' })} aria-label={tr('تفعيل المراجعات', 'Enable reviews')} />
                )}
              </div>
            </Card>

            <Card className="space-y-4">
              <CardHeader icon={CpuChipIcon} title={tr('المزوّد', 'Provider')} action={<Badge tone={hasKey ? 'success' : 'warning'} dot>{hasKey ? tr('المفتاح محفوظ', 'Key set') : tr('لا يوجد مفتاح', 'No key')}</Badge>} />
              {isLoading ? <Skeleton lines={3} /> : (
                <>
                  <Field label={tr('مزوّد الذكاء الاصطناعي', 'AI provider')} hint={tr('DeepSeek هو الافتراضي، والنظام يدعم عدة مزوّدين.', 'DeepSeek is the default; the system supports several providers.')}>
                    <Select value={form.ai_provider || 'deepseek'} onChange={e => setForm(f => ({ ...f, ai_provider: e.target.value }))}
                      options={[{ value: 'deepseek', label: tr('DeepSeek (افتراضي)', 'DeepSeek (default)') }, { value: 'openai', label: 'OpenAI' }]} />
                  </Field>
                  <Field label={tr('مفتاح API', 'API key')} hint={tr('يُخزَّن في قاعدة البيانات ولا يُعرض للعملاء.', 'Stored in the database, never shown to customers.')}>
                    <SecretField stored={hasKey ? settings.ai_deepseek_api_key_masked : ''} value={newKey || (hasKey ? settings.ai_deepseek_api_key_masked : '')}
                      onChange={v => setNewKey(v.startsWith('••') ? '' : v)} placeholder="sk-…" />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {newKey && <Button icon={KeyIcon} loading={saveMut.isLoading} onClick={() => { save({ ai_deepseek_api_key: newKey }); setNewKey('') }}>{tr('حفظ المفتاح', 'Save key')}</Button>}
                    <Button variant="secondary" icon={BoltIcon} loading={testing} onClick={testConnection}>{tr('اختبار الاتصال', 'Test connection')}</Button>
                  </div>
                  {testResult && (
                    <Notice tone={testResult.success ? 'success' : 'danger'} icon={testResult.success ? CheckCircleIcon : XCircleIcon}>
                      {testResult.success ? tr(`متصل — النموذج: ${testResult.model}`, `Connected — model: ${testResult.model}`) : testResult.error}
                    </Notice>
                  )}
                </>
              )}
            </Card>

            <Card className="space-y-4">
              <CardHeader icon={AdjustmentsHorizontalIcon} title={tr('إعدادات المراجعة', 'Review settings')} />
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
                    {changed.length > 0 && <Button variant="ghost" onClick={() => setForm(initial)}>{tr('تراجع', 'Discard')}</Button>}
                    <Button loading={saveMut.isLoading} disabled={!changed.length} onClick={() => save(Object.fromEntries(changed.map(k => [k, form[k]])))}>{tr('حفظ', 'Save')}</Button>
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="space-y-5 lg:col-span-2">
            <div className="grid grid-cols-2 gap-3.5">
              <StatCard loading={isLoading} icon={BoltIcon} label={tr('طلبات اليوم', 'Requests today')} value={formatNumber(dailyUsage)} />
              <StatCard loading={isLoading} icon={ChartBarIcon} label={tr('آخر 30 يومًا', 'Last 30 days')} value={formatNumber(monthlyUsage)} />
            </div>
            <Card className="space-y-4">
              <CardHeader title={tr('الاستخدام اليومي', 'Daily usage')} />
              <ProgressBar size="md" label={tr('من الحد اليومي', 'Of the daily limit')} value={dailyUsage} max={dailyLimit}
                valueText={`${formatNumber(dailyUsage)} / ${formatNumber(dailyLimit)}`} tone={dailyUsage / dailyLimit > 0.9 ? 'danger' : dailyUsage / dailyLimit > 0.7 ? 'warning' : 'gradient'} />
              {isLoading ? <Skeleton className="h-40" /> : series.some(d => d.v > 0) ? (
                <AreaChart height={170} labels={series.map(d => fmtShort(d.date))} series={[{ name: tr('طلبات', 'Requests'), data: series.map(d => d.v), color: '#B59CF5' }]}
                  ariaLabel={tr('طلبات الذكاء الاصطناعي يوميًا لآخر 30 يومًا', 'AI requests per day, last 30 days')} />
              ) : (
                <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">{tr('لا توجد طلبات خلال آخر 30 يومًا', 'No requests in the last 30 days')}</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
