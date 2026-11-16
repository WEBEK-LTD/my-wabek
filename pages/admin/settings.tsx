import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '@/components/layout/AdminLayout'
import { useQuery } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { AdjustmentsHorizontalIcon, CreditCardIcon, EnvelopeIcon, PuzzlePieceIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { Button, Card, PageHeader, Skeleton, Tabs, cn } from '@/components/ui'
import { useApiError, useAdminT } from '@/components/admin/i18n'
import { ErrorState } from '@/components/admin/shared'
import type { Settings } from '@/components/admin/settings/controls'
import { GeneralSection } from '@/components/admin/settings/GeneralSection'
import { SecuritySection } from '@/components/admin/settings/SecuritySection'
import { SmtpSection } from '@/components/admin/settings/SmtpSection'
import { PaymentsSection } from '@/components/admin/settings/PaymentsSection'
import { IntegrationsSection } from '@/components/admin/settings/IntegrationsSection'
import messages from '@/locales/admin/settings/page'

type SectionId = 'general' | 'security' | 'smtp' | 'payments' | 'integrations'
// Old tab ids keep working as ?tab=… deep links.
const LEGACY: Record<string, SectionId> = { platform: 'general', registration: 'general', brand: 'general', security: 'security', smtp: 'smtp', seo: 'integrations', webmaster: 'integrations', push: 'integrations' }

const EMPTY_OBJ: Record<string, never> = {}

interface SeoBundle { seo?: Record<string, unknown>; brand?: Record<string, string>; smtp?: Record<string, string>; push?: Record<string, unknown>; webmaster?: Record<string, unknown> }

export default function AdminSettingsPage() {
  const { t, tn } = useAdminT(messages)
  const apiError = useApiError()
  const router = useRouter()
  const [section, setSection] = useState<SectionId>('general')
  const [settings, setSettings] = useState<Settings>({})
  const [original, setOriginal] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [instances, setInstances] = useState<{ id: string; display_name?: string; phone_number?: string; instance_type?: string }[]>([])

  const seoQ = useQuery<SeoBundle>('admin-seo', () => axios.get('/api/admin/seo').then(r => r.data))
  const [seoLocal, setSeoLocal] = useState<Record<string, unknown> | null>(null)
  const seo = seoLocal || seoQ.data?.seo || EMPTY_OBJ

  useEffect(() => {
    const q = router.query.tab
    if (typeof q === 'string' && (LEGACY[q] || ['general', 'security', 'smtp', 'payments', 'integrations'].includes(q))) setSection(LEGACY[q] || (q as SectionId))
  }, [router.query.tab])

  const load = () => {
    setLoading(true); setLoadError(false)
    axios.get('/api/admin/settings')
      .then(r => { setSettings(r.data.settings || {}); setOriginal(r.data.settings || {}) })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    axios.get('/api/whatsapp/instances').then(r => setInstances((r.data.instances || []).filter((i: { status?: string }) => i.status === 'connected'))).catch(() => {})
  }, [])

  const set = (k: string, v: unknown) => setSettings(s => ({ ...s, [k]: v }))
  const changed = useMemo(() => Object.keys(settings).filter(k => JSON.stringify(settings[k]) !== JSON.stringify(original[k])), [settings, original])
  const dirty = changed.length > 0

  const save = async () => {
    if (!dirty) return
    setSaving(true)
    try {
      // Only changed keys go out, so masked secrets are never echoed back.
      const body = Object.fromEntries(changed.map(k => [k, settings[k]]))
      await axios.put('/api/admin/settings', body)
      setOriginal(settings)
      toast.success(t('settingsSaved'))
    } catch (e) { toast.error(apiError(e, t('failedSave'))) }
    finally { setSaving(false) }
  }

  const sections: { id: SectionId; label: string; desc: string; icon: React.ElementType; generic?: boolean }[] = [
    { id: 'general', label: t('general'), desc: t('platformRegistrationBrand'), icon: AdjustmentsHorizontalIcon, generic: true },
    { id: 'security', label: t('securityOtp'), desc: t('verificationCodesSign'), icon: ShieldCheckIcon, generic: true },
    { id: 'smtp', label: t('emailSmtp'), desc: t('mailServerTest'), icon: EnvelopeIcon },
    { id: 'payments', label: t('payments'), desc: 'Stripe', icon: CreditCardIcon },
    { id: 'integrations', label: t('integrations'), desc: t('trackingWebmasterPush'), icon: PuzzlePieceIcon },
  ]
  const current = sections.find(s => s.id === section)!
  const go = (id: string) => { setSection(id as SectionId); router.replace({ pathname: router.pathname, query: { tab: id } }, undefined, { shallow: true, scroll: false }) }

  return (
    <AdminLayout title={t('platformSettings')}>
      <PageHeader className="mb-6"
        eyebrow={t('settings')}
        title={t('platformSettings')}
        description={t('platformWideSettingsEvery')}
        actions={current.generic ? <Button loading={saving} disabled={!dirty || loading} onClick={save}>{t('saveChanges')}</Button> : undefined}
      />

      <div className="mb-4 lg:hidden">
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-none">
          <Tabs variant="pills" size="sm" value={section} onChange={go} aria-label={t('settingsSections')} idPrefix="settings"
            tabs={sections.map(s => ({ id: s.id, label: s.label, icon: s.icon }))} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="hidden lg:block" aria-label={t('settingsSections')}>
          <ul className="sticky top-[72px] space-y-1">
            {sections.map(s => (
              <li key={s.id}>
                <button type="button" onClick={() => go(s.id)} aria-current={section === s.id ? 'page' : undefined}
                  className={cn('flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start transition-colors',
                    section === s.id ? 'bg-surface shadow-card ring-1 ring-line' : 'hover:bg-surface-3')}>
                  <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]', section === s.id ? 'bg-brand-gradient text-[#04282C]' : 'bg-chip text-brand-ink')}>
                    <s.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{s.label}</span>
                    <span className="block truncate text-xs text-muted">{s.desc}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 max-w-3xl">
          {current.generic && loadError ? <ErrorState onRetry={load} /> : current.generic && loading ? (
            <div className="space-y-4">{[0, 1].map(i => <Skeleton key={i} className="h-56 rounded-card" />)}</div>
          ) : (
            <>
              {section === 'general' && (
                <GeneralSection settings={settings} set={set} brand={seoQ.data?.brand || EMPTY_OBJ} seo={seo} onSeoSaved={next => { setSeoLocal(next); seoQ.refetch() }} />
              )}
              {section === 'security' && <SecuritySection settings={settings} set={set} instances={instances} dirty={dirty} />}
              {section === 'smtp' && (seoQ.isLoading ? <Skeleton className="h-96 rounded-card" /> : seoQ.isError ? <ErrorState onRetry={() => seoQ.refetch()} /> :
                <SmtpSection smtp={seoQ.data?.smtp} onSaved={() => seoQ.refetch()} />)}
              {section === 'payments' && <PaymentsSection />}
              {section === 'integrations' && (seoQ.isLoading ? <Skeleton className="h-96 rounded-card" /> : seoQ.isError ? <ErrorState onRetry={() => seoQ.refetch()} /> :
                <IntegrationsSection seo={seo} webmaster={seoQ.data?.webmaster} push={seoQ.data?.push} onSaved={() => { setSeoLocal(null); seoQ.refetch() }} />)}
            </>
          )}

          {current.generic && dirty && (
            <div className="sticky bottom-4 z-10 mt-5">
              <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3 shadow-dropdown">
                <span className="text-sm text-ink">{tn('unsavedChanges', changed.length, { n: changed.length })}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSettings(original)}>{t('discard')}</Button>
                  <Button size="sm" loading={saving} onClick={save}>{t('save')}</Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
