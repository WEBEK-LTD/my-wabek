import React, { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ArrowUpTrayIcon, BuildingOffice2Icon, PhotoIcon, TrashIcon, UserPlusIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { Button, Card, CardHeader, Field, Input } from '@/components/ui'
import { apiError, useAdminT } from '../i18n'
import { Notice } from '../shared'
import { Bound, NumberRow, TextRow, ToggleRow, asBool } from './controls'
import messages from '@/locales/admin/settings/general'

type Brand = Record<string, string>

export function GeneralSection({ settings, set, brand: brandIn, seo, onSeoSaved }: Bound & {
  brand: Brand; seo: Record<string, unknown>; onSeoSaved: (next: Record<string, unknown>) => void
}) {
  const { t } = useAdminT(messages)
  const b = { settings, set }
  const [brand, setBrand] = useState<Brand>({})
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { setBrand({ ...brandIn, site_title: (seo?.site_title as string) || brandIn?.site_title || '' }) }, [brandIn, seo])

  const saveBrandField = async (field: string, url: string, okMsg: string) => {
    setBusy(field)
    try { await axios.post('/api/admin/save-brand-url', { url, field }); toast.success(okMsg) }
    catch (e) { toast.error(apiError(e, t('failedSave'))) }
    setBusy(null)
  }

  const saveSiteTitle = async () => {
    setBusy('site_title')
    try {
      // seo_settings is replaced as a whole — send the full object, not just the title.
      const next = { ...seo, site_title: brand.site_title || '' }
      await axios.put('/api/admin/seo', { seo: next })
      onSeoSaved(next)
      toast.success(t('browserTabTitleSaved'))
    } catch (e) { toast.error(apiError(e, t('failedSave'))) }
    setBusy(null)
  }

  const upload = (field: string, label: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const b64 = ev.target?.result as string
      const prev = brand[field]
      setBrand(f => ({ ...f, [field]: b64 }))
      setBusy(field)
      try {
        const r = await axios.post('/api/admin/upload-logo', { imageBase64: b64, field })
        if (r.data?.url) setBrand(f => ({ ...f, [field]: r.data.url }))
        toast.success(t('uploaded', { label }))
      } catch (err) {
        toast.error(apiError(err, t('uploadFailed')))
        setBrand(f => ({ ...f, [field]: prev || '' }))
      }
      setBusy(null)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const maintenance = asBool(settings.maintenance_mode)

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={BuildingOffice2Icon} title={t('platform')} />
        <div className="mt-2">
          <TextRow {...b} k="platform_name" label={t('platformName')} placeholder="WABEK" />
          <TextRow {...b} k="platform_logo" label={t('logoUrl')} placeholder="https://example.com/logo.png" ltr />
          <TextRow {...b} k="support_email" label={t('supportEmail')} placeholder="support@waabek.com" ltr />
          <ToggleRow {...b} k="maintenance_mode" label={t('maintenanceMode')} desc={t('showsMaintenancePageEveryone')} />
          {maintenance && <Notice tone="warning" icon={WrenchScrewdriverIcon} className="mt-2">{t('onceSavedUsersWon')}</Notice>}
        </div>
      </Card>

      <Card>
        <CardHeader icon={UserPlusIcon} title={t('registration')} />
        <div className="mt-2">
          <ToggleRow {...b} k="allow_registration" label={t('allowNewRegistrations')} desc={t('turnOffInviteOnly')} />
          <NumberRow {...b} k="default_trial_days" label={t('trialPeriod')} desc={t('freeTrialDaysNew')} min={0} max={365} suffix={t('days')} />
        </div>
      </Card>

      <Card className="space-y-5">
        <CardHeader icon={PhotoIcon} title={t('brandIdentity')} subtitle={t('eachFieldSavesIts')} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('appSiteName')}>
            <div className="flex gap-2">
              <Input wrapperClassName="flex-1" value={brand.app_name || ''} onChange={e => setBrand(f => ({ ...f, app_name: e.target.value }))} placeholder="WABEK" />
              <Button size="md" variant="secondary" loading={busy === 'app_name'} onClick={() => saveBrandField('app_name', brand.app_name || '', t('nameSaved'))}>{t('save')}</Button>
            </div>
          </Field>
          <Field label={t('browserTabTitle')} hint={t('leaveEmptyUseApp')}>
            <div className="flex gap-2">
              <Input wrapperClassName="flex-1" value={brand.site_title || ''} onChange={e => setBrand(f => ({ ...f, site_title: e.target.value }))} placeholder="WABEK — WhatsApp Business Platform" />
              <Button size="md" variant="secondary" loading={busy === 'site_title'} onClick={saveSiteTitle}>{t('save')}</Button>
            </div>
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: t('logo'), field: 'logo_url', desc: t('shownNavbarFooterPng') },
            { label: t('favicon'), field: 'favicon_url', desc: t('browserTabIcon32') },
          ].map(({ label, field, desc }) => {
            const val = brand[field] || ''
            return (
              <div key={field} className="space-y-3 rounded-xl border border-line-soft bg-surface-2 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-xl border border-line bg-surface p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {val ? <img src={val} alt="" className="max-h-full max-w-full object-contain" onError={e => ((e.target as HTMLImageElement).style.display = 'none')} /> : <PhotoIcon className="h-6 w-6 text-muted" aria-hidden="true" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{label}</p>
                    <p className="text-xs text-muted">{desc}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input size="sm" dir="ltr" wrapperClassName="flex-1" aria-label={t('url', { label })} value={val.startsWith('data:') ? '' : val}
                    onChange={e => setBrand(f => ({ ...f, [field]: e.target.value }))} placeholder="https://example.com/logo.png" />
                  <Button size="sm" variant="secondary" loading={busy === field} disabled={!val || val.startsWith('data:')} onClick={() => saveBrandField(field, val, t('saved', { label }))}>{t('save')}</Button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*,image/svg+xml" id={`file-${field}`} className="sr-only" onChange={upload(field, label)} />
                  <label htmlFor={`file-${field}`} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-btn border border-line-strong bg-surface px-3 text-xs font-medium text-ink transition hover:bg-surface-3 focus-within:shadow-ring">
                    <ArrowUpTrayIcon className="h-4 w-4" aria-hidden="true" />{t('uploadFile')}
                  </label>
                  {val && (
                    <Button size="xs" variant="ghost" icon={TrashIcon} onClick={async () => {
                      setBrand(f => ({ ...f, [field]: '' }))
                      await saveBrandField(field, '', t('removed'))
                    }}>{t('remove')}</Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
