import React, { useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ArrowUpTrayIcon, BuildingOffice2Icon, PhotoIcon, TrashIcon, UserPlusIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { Button, Card, CardHeader, Field, Input } from '@/components/ui'
import { apiError, useAdminT } from '../i18n'
import { Notice } from '../shared'
import { Bound, NumberRow, TextRow, ToggleRow, asBool } from './controls'

type Brand = Record<string, string>

export function GeneralSection({ settings, set, brand: brandIn, seo, onSeoSaved }: Bound & {
  brand: Brand; seo: Record<string, unknown>; onSeoSaved: (next: Record<string, unknown>) => void
}) {
  const { tr } = useAdminT()
  const b = { settings, set }
  const [brand, setBrand] = useState<Brand>({})
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { setBrand({ ...brandIn, site_title: (seo?.site_title as string) || brandIn?.site_title || '' }) }, [brandIn, seo])

  const saveBrandField = async (field: string, url: string, okMsg: string) => {
    setBusy(field)
    try { await axios.post('/api/admin/save-brand-url', { url, field }); toast.success(okMsg) }
    catch (e) { toast.error(apiError(e, tr('تعذّر الحفظ', 'Failed to save'))) }
    setBusy(null)
  }

  const saveSiteTitle = async () => {
    setBusy('site_title')
    try {
      // seo_settings is replaced as a whole — send the full object, not just the title.
      const next = { ...seo, site_title: brand.site_title || '' }
      await axios.put('/api/admin/seo', { seo: next })
      onSeoSaved(next)
      toast.success(tr('حُفظ عنوان تبويب المتصفح', 'Browser tab title saved'))
    } catch (e) { toast.error(apiError(e, tr('تعذّر الحفظ', 'Failed to save'))) }
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
        toast.success(tr(`رُفع ${label}`, `${label} uploaded`))
      } catch (err) {
        toast.error(apiError(err, tr('فشل الرفع', 'Upload failed')))
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
        <CardHeader icon={BuildingOffice2Icon} title={tr('المنصة', 'Platform')} />
        <div className="mt-2">
          <TextRow {...b} k="platform_name" label={tr('اسم المنصة', 'Platform name')} placeholder="WABEK" />
          <TextRow {...b} k="platform_logo" label={tr('رابط الشعار', 'Logo URL')} placeholder="https://example.com/logo.png" ltr />
          <TextRow {...b} k="support_email" label={tr('بريد الدعم', 'Support email')} placeholder="support@waabek.com" ltr />
          <ToggleRow {...b} k="maintenance_mode" label={tr('وضع الصيانة', 'Maintenance mode')} desc={tr('يعرض صفحة الصيانة لكل المستخدمين عدا المديرين', 'Shows the maintenance page to everyone except admins')} />
          {maintenance && <Notice tone="warning" icon={WrenchScrewdriverIcon} className="mt-2">{tr('بعد الحفظ لن يتمكن المستخدمون من استخدام المنصة.', 'Once saved, users won’t be able to use the platform.')}</Notice>}
        </div>
      </Card>

      <Card>
        <CardHeader icon={UserPlusIcon} title={tr('التسجيل', 'Registration')} />
        <div className="mt-2">
          <ToggleRow {...b} k="allow_registration" label={tr('السماح بالتسجيل الجديد', 'Allow new registrations')} desc={tr('أوقفه لوضع «بالدعوة فقط»', 'Turn off for invite-only mode')} />
          <NumberRow {...b} k="default_trial_days" label={tr('مدة التجربة', 'Trial period')} desc={tr('أيام التجربة المجانية للمستخدم الجديد', 'Free trial days for new users')} min={0} max={365} suffix={tr('يوم', 'days')} />
        </div>
      </Card>

      <Card className="space-y-5">
        <CardHeader icon={PhotoIcon} title={tr('الهوية والعلامة', 'Brand & identity')} subtitle={tr('تُحفظ كل خانة فورًا وتُطبَّق على الموقع كله.', 'Each field saves on its own and applies site-wide.')} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={tr('اسم التطبيق / الموقع', 'App / site name')}>
            <div className="flex gap-2">
              <Input wrapperClassName="flex-1" value={brand.app_name || ''} onChange={e => setBrand(f => ({ ...f, app_name: e.target.value }))} placeholder="WABEK" />
              <Button size="md" variant="secondary" loading={busy === 'app_name'} onClick={() => saveBrandField('app_name', brand.app_name || '', tr('حُفظ الاسم', 'Name saved'))}>{tr('حفظ', 'Save')}</Button>
            </div>
          </Field>
          <Field label={tr('عنوان تبويب المتصفح', 'Browser tab title')} hint={tr('اتركه فارغًا لاستخدام اسم التطبيق', 'Leave empty to use the app name')}>
            <div className="flex gap-2">
              <Input wrapperClassName="flex-1" value={brand.site_title || ''} onChange={e => setBrand(f => ({ ...f, site_title: e.target.value }))} placeholder="WABEK — WhatsApp Business Platform" />
              <Button size="md" variant="secondary" loading={busy === 'site_title'} onClick={saveSiteTitle}>{tr('حفظ', 'Save')}</Button>
            </div>
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: tr('الشعار', 'Logo'), field: 'logo_url', desc: tr('يظهر في الشريط العلوي والتذييل. يفضّل PNG أو SVG.', 'Shown in the navbar and footer. PNG/SVG recommended.') },
            { label: tr('أيقونة الموقع', 'Favicon'), field: 'favicon_url', desc: tr('أيقونة التبويب. 32×32 بكسل ICO أو PNG.', 'Browser tab icon. 32×32px ICO or PNG.') },
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
                  <Input size="sm" dir="ltr" wrapperClassName="flex-1" aria-label={tr(`رابط ${label}`, `${label} URL`)} value={val.startsWith('data:') ? '' : val}
                    onChange={e => setBrand(f => ({ ...f, [field]: e.target.value }))} placeholder="https://example.com/logo.png" />
                  <Button size="sm" variant="secondary" loading={busy === field} disabled={!val || val.startsWith('data:')} onClick={() => saveBrandField(field, val, tr(`حُفظ ${label}`, `${label} saved`))}>{tr('حفظ', 'Save')}</Button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*,image/svg+xml" id={`file-${field}`} className="sr-only" onChange={upload(field, label)} />
                  <label htmlFor={`file-${field}`} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-btn border border-line-strong bg-surface px-3 text-xs font-medium text-ink transition hover:bg-surface-3 focus-within:shadow-ring">
                    <ArrowUpTrayIcon className="h-4 w-4" aria-hidden="true" />{tr('رفع ملف', 'Upload file')}
                  </label>
                  {val && (
                    <Button size="xs" variant="ghost" icon={TrashIcon} onClick={async () => {
                      setBrand(f => ({ ...f, [field]: '' }))
                      await saveBrandField(field, '', tr('أُزيل', 'Removed'))
                    }}>{tr('إزالة', 'Remove')}</Button>
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
