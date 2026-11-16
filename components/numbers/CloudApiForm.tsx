import React from 'react'
import { useForm } from 'react-hook-form'
import { CloudIcon } from '@heroicons/react/24/outline'
import { Button, Field, Input, Modal } from '@/components/ui'
import { CopyField, Notice } from '@/components/settings/Shared'

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
  const req = 'هذا الحقل مطلوب'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={CloudIcon}
      title="إعداد Cloud API يدويًا"
      description="لربط رقم من Meta Developer Portal باستخدام معرّفاته ورمز وصول دائم."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button type="submit" form="cloud-api-form" loading={loading}>ربط الرقم</Button>
        </>
      }
    >
      <form id="cloud-api-form" onSubmit={handleSubmit(d => onSubmit(d, () => reset()))} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رقم الهاتف (بصيغة E.164)" required error={errors.phone_number && req}>
            <Input {...register('phone_number', { required: true })} placeholder="+905551234567" dir="ltr" />
          </Field>
          <Field label="الاسم الظاهر">
            <Input {...register('display_name')} placeholder="متجري" />
          </Field>
          <Field label="Phone Number ID" hint="من Meta Developer Portal" required error={errors.phone_number_id && req}>
            <Input {...register('phone_number_id', { required: true })} placeholder="123456789012345" dir="ltr" className="font-mono" />
          </Field>
          <Field label="WABA ID" hint="معرّف حساب واتساب للأعمال" required error={errors.waba_id && req}>
            <Input {...register('waba_id', { required: true })} placeholder="987654321098765" dir="ltr" className="font-mono" />
          </Field>
        </div>
        <Field label="رمز الوصول (Access Token)" hint="رمز مستخدم النظام (System User) الدائم" required error={errors.access_token && req}>
          <Input {...register('access_token', { required: true })} type="password" placeholder="EAAx…" dir="ltr" className="font-mono" autoComplete="off" />
        </Field>
        <Notice tone="warning" title="يجب أن يكون رمز مستخدم نظام (System User Token)">
          الرمز المؤقت من Meta Developer Portal لن يستقبل الرسائل الواردة. أنشئه من
          <strong> Meta Business Suite ← الإعدادات ← المستخدمون ← مستخدمو النظام ← إنشاء رمز</strong>،
          مع الصلاحيتين <code dir="ltr" className="font-mono">whatsapp_business_messaging</code> و<code dir="ltr" className="font-mono">whatsapp_business_management</code>.
        </Notice>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">رابط Webhook الذي تضيفه في Meta</p>
          <CopyField value={webhookUrl} />
        </div>
      </form>
    </Modal>
  )
}
