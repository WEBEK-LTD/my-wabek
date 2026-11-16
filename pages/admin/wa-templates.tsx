import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowUturnLeftIcon, ClockIcon, DocumentDuplicateIcon, PaperAirplaneIcon, PhoneIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, SearchInput, Skeleton, Tooltip, cn } from '@/components/ui'
import { useApiError, useAdminT, type AdminT } from '@/components/admin/i18n'
import { ErrorState, Notice } from '@/components/admin/shared'
import messages from '@/locales/admin/wa-templates'

const BUILT_IN_TEMPLATES = (t: AdminT<typeof messages.en>) => [
  { key: 'OTP', name: 'wabek_otp', params: ['otp_code'], use: t('otpVerificationCodesPositional') },
  { key: 'WELCOME', name: 'welcome_message_v2', params: [], use: t('newCustomerWelcomeNo') },
  { key: 'WELCOME_V1', name: 'welcome_message', params: [], use: t('welcomeLegacyNoVariables') },
  { key: 'SUPPORT_TICKET_OPEN', name: 'support_ticket_update', params: ['customer_name'], use: t('serviceUpdateNotification') },
  { key: 'SUPPORT_REPLY', name: 'support_reply', params: ['message'], use: t('supportTeamReply') },
  { key: 'MARKETING', name: 'marketing_offer', params: ['customer_name', 'offer_details'], use: t('marketingCampaigns') },
  { key: 'BROADCAST', name: 'broadcast_notification', params: ['customer_name'], use: t('bulkAnnouncements') },
  { key: 'INVOICE_CREATED', name: 'invoice_created', params: ['customer_name'], use: t('newInvoice') },
  { key: 'INVOICE_OVERDUE', name: 'invoice_overdue', params: ['customer_name'], use: t('overdueInvoice') },
  { key: 'PAYMENT_REMINDER', name: 'payment_reminder', params: ['customer_name'], use: t('paymentReminder') },
  { key: 'SERVICE_NOTIFICATION', name: 'service_notification', params: ['customer_name'], use: t('generalServiceUpdate') },
  { key: 'AI_FOLLOWUP', name: 'ai_assistant_followup', params: ['customer_name'], use: t('aiAssistantFollowUp') },
  { key: 'PASSWORD_RESET', name: 'password_reset', params: ['customer_name'], use: t('passwordResetNotification') },
]

export default function WATemplatesPage() {
  const { t } = useAdminT(messages)
  const apiError = useApiError()
  const templates = useMemo(() => BUILT_IN_TEMPLATES(t), [t])
  const [config, setConfig] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [q, setQ] = useState('')

  const load = () => {
    setLoading(true); setError(false)
    axios.get('/api/admin/wa-templates')
      .then(r => { const c = r.data.templates || r.data.defaults || {}; setConfig(c); setSaved(c) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const dirty = JSON.stringify(config) !== JSON.stringify(saved)

  const save = async () => {
    setSaving(true)
    try {
      await axios.post('/api/admin/wa-templates', { templates: config })
      setSaved(config)
      toast.success(t('templatesSaved'))
    } catch (e) { toast.error(apiError(e, t('failedSave'))) }
    setSaving(false)
  }

  const test = async (templateKey: string) => {
    if (!testPhone) { toast.error(t('enterPhoneNumberFirst')); return }
    setTesting(templateKey)
    try {
      await axios.post('/api/admin/wa-templates/test', { templateKey, phone: testPhone })
      toast.success(t('testMessageSent'))
    } catch (e) { toast.error(apiError(e, t('testFailed'))) }
    setTesting(null)
  }

  const shown = templates.filter(tpl => !q || [tpl.key, tpl.name, tpl.use, config[tpl.key]].some(v => (v || '').toLowerCase().includes(q.toLowerCase())))
  const overridden = templates.filter(tpl => config[tpl.key]).length

  return (
    <AdminLayout title={t('whatsappTemplates')}>
      <PageHeader className="mb-6"
        eyebrow={t('messaging')}
        title={t('whatsappTemplates')}
        description={t('metaApprovedTemplatesUsed')}
        actions={<Button loading={saving} disabled={!dirty || loading} onClick={save}>{t('saveConfiguration')}</Button>}
      />

      {error ? <ErrorState onRetry={load} /> : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card padding="none">
              <div className="flex flex-col gap-3 border-b border-line-soft p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="section-title">{t('builtTemplates')}</h2>
                  <p className="text-xs text-muted">{t('templatesRenamed', { templatesCount: templates.length, overridden })}</p>
                </div>
                <SearchInput size="sm" value={q} onChange={setQ} placeholder={t('searchTemplates')} wrapperClassName="sm:w-64" />
              </div>
              {loading ? (
                <div className="space-y-3 p-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {shown.map(tpl => {
                    const custom = config[tpl.key] || ''
                    return (
                      <li key={tpl.key} className={cn('space-y-3 px-4 py-4 transition-colors sm:px-5', custom && 'bg-chip/25')}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <code dir="ltr" className={cn('rounded-md px-2 py-0.5 font-mono text-sm', custom ? 'bg-surface-3 text-muted line-through' : 'bg-chip text-chip-ink')}>{tpl.name}</code>
                              {custom && <code dir="ltr" className="rounded-md bg-chip px-2 py-0.5 font-mono text-sm text-chip-ink">{custom}</code>}
                              <span className="font-mono text-2xs text-muted" dir="ltr">{tpl.key}</span>
                              {custom && <Badge tone="brand" size="sm">{t('custom')}</Badge>}
                            </div>
                            <p className="mt-1 text-sm text-body">{tpl.use}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {tpl.params.length ? tpl.params.map(p => (
                                <span key={p} dir="ltr" className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs text-body">{`{{${p}}}`}</span>
                              )) : <span className="text-xs italic text-muted">{t('noParameters')}</span>}
                            </div>
                          </div>
                          <Tooltip content={testPhone ? t('sendTestAlt') : t('enterTestNumberFirst')}>
                            <Button size="sm" variant="secondary" icon={PaperAirplaneIcon} className="rtl:[&_svg]:-scale-x-100" loading={testing === tpl.key} disabled={!testPhone} onClick={() => test(tpl.key)}>
                              {t('test')}
                            </Button>
                          </Tooltip>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input size="sm" dir="ltr" className="font-mono" wrapperClassName="flex-1 sm:max-w-sm" value={custom} placeholder={tpl.name}
                            aria-label={t('overrideMetaTemplateName', { key: tpl.key })}
                            onChange={e => setConfig(c => ({ ...c, [tpl.key]: e.target.value }))} />
                          {custom && <Button size="icon-sm" variant="ghost" icon={ArrowUturnLeftIcon} className="rtl:[&_svg]:-scale-x-100" aria-label={t('resetDefault')} onClick={() => setConfig(c => ({ ...c, [tpl.key]: '' }))} />}
                        </div>
                      </li>
                    )
                  })}
                  {!shown.length && <li className="p-6 text-center text-sm text-muted">{t('noMatchingTemplates')}</li>}
                </ul>
              )}
            </Card>

            <Card className="space-y-4">
              <CardHeader icon={SparklesIcon} title={t('windowBehaviour')} subtitle={t('defaultTemplatesOnce24')} />
              {[
                { key: 'default_campaign_template', label: t('defaultCampaignTemplate'), placeholder: 'marketing_offer', desc: t('usedWhenNoTemplate') },
                { key: 'default_support_template', label: t('defaultSupportReplyTemplate'), placeholder: 'support_ticket_update', desc: t('supportRepliesOutsideWindow') },
                { key: 'default_ai_template', label: t('defaultAiAssistantTemplate'), placeholder: 'ai_assistant_followup', desc: t('aiRepliesOutsideWindow') },
              ].map(s => (
                <Field key={s.key} label={s.label} hint={s.desc}>
                  <Input dir="ltr" className="font-mono" value={config[s.key] || ''} placeholder={s.placeholder} disabled={loading}
                    onChange={e => setConfig(c => ({ ...c, [s.key]: e.target.value }))} />
                </Field>
              ))}
            </Card>
          </div>

          <div className="space-y-5 lg:sticky lg:top-[72px] lg:self-start">
            <Card className="space-y-3">
              <CardHeader icon={PhoneIcon} title={t('testNumber')} />
              <Field label={t('phoneNumber')} hint={t('internationalFormatNo')}>
                <Input dir="ltr" inputMode="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="201234567890" />
              </Field>
            </Card>
            <Notice tone="info" icon={ClockIcon} title={t('how24HourWindow')}>
              {t('whenCustomerMessagesYou')}
            </Notice>
            <Notice tone="violet" icon={DocumentDuplicateIcon}>
              {t('onlyRenameTemplateIf')}
            </Notice>
            {dirty && (
              <Card variant="gradient" padding="sm" className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{t('youHaveUnsavedChanges')}</span>
                <Button size="sm" variant="dark" loading={saving} onClick={save}>{t('save')}</Button>
              </Card>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
