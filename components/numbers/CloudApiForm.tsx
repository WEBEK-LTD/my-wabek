import React from 'react'
import { useForm } from 'react-hook-form'
import { CloudIcon } from '@heroicons/react/24/outline'
import { Button, Field, Input, Modal } from '@/components/ui'
import { CopyField, Notice, rich } from '@/components/settings/Shared'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/instances'

export interface CloudApiValues {
  phone_number: string
  display_name?: string
  phone_number_id: string
  waba_id: string
  access_token: string
}

/** Manual Cloud API setup. Submits exactly the same body as before. */
export function CloudApiForm({ open, onClose, onSubmit, loading, webhookUrl }: {
  open: boolean
  onClose: () => void
  onSubmit: (values: CloudApiValues, reset: () => void) => void
  loading?: boolean
  webhookUrl: string
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CloudApiValues>()
  const { t } = useT(messages)
  const req = t('required')

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={CloudIcon}
      title={t('cloudFormTitle')}
      description={t('cloudFormDesc')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" form="cloud-api-form" loading={loading}>{t('connectSubmit')}</Button>
        </>
      }
    >
      <form id="cloud-api-form" onSubmit={handleSubmit(d => onSubmit(d, () => reset()))} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('phoneLabel')} required error={errors.phone_number && req}>
            <Input {...register('phone_number', { required: true })} placeholder="+905551234567" dir="ltr" />
          </Field>
          <Field label={t('displayName')}>
            <Input {...register('display_name')} placeholder={t('displayNamePlaceholder')} />
          </Field>
          <Field label="Phone Number ID" hint={t('fromPortal')} required error={errors.phone_number_id && req}>
            <Input {...register('phone_number_id', { required: true })} placeholder="123456789012345" dir="ltr" className="font-mono" />
          </Field>
          <Field label="WABA ID" hint={t('wabaHint')} required error={errors.waba_id && req}>
            <Input {...register('waba_id', { required: true })} placeholder="987654321098765" dir="ltr" className="font-mono" />
          </Field>
        </div>
        <Field label={t('tokenLabel')} hint={t('tokenHint')} required error={errors.access_token && req}>
          <Input {...register('access_token', { required: true })} type="password" placeholder="EAAx…" dir="ltr" className="font-mono" autoComplete="off" />
        </Field>
        <Notice tone="warning" title={t('tokenWarnTitle')}>
          {rich(t('tokenWarnBody'), {
            path: <strong>{t('tokenWarnPath')}</strong>,
            perm1: <code dir="ltr" className="font-mono">whatsapp_business_messaging</code>,
            perm2: <code dir="ltr" className="font-mono">whatsapp_business_management</code>,
          })}
        </Notice>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">{t('webhookLabel')}</p>
          <CopyField value={webhookUrl} />
        </div>
      </form>
    </Modal>
  )
}
