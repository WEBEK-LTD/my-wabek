import React from 'react'
import {
  CloudIcon, QrCodeIcon, CheckIcon, ExclamationTriangleIcon, WrenchScrewdriverIcon, PlusIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Modal, cn } from '@/components/ui'

function Point({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? CheckIcon : ExclamationTriangleIcon
  return (
    <li className="flex items-start gap-2 text-[13px] leading-relaxed text-body">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ok ? 'text-success' : 'text-warning')} aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

/**
 * "Connect a number" — two clear paths. The parent supplies the existing
 * flows (Meta Embedded Signup, WhatsApp Web create) unchanged.
 */
export function ConnectNumberDialog({ open, onClose, onMeta, metaLoading, onManual, onWeb, webLoading }: {
  open: boolean
  onClose: () => void
  onMeta: () => void
  metaLoading?: boolean
  onManual: () => void
  onWeb: () => void
  webLoading?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} size="xl" icon={PlusIcon} title="ربط رقم واتساب" description="اختر طريقة الربط المناسبة لنشاطك. يمكنك ربط أكثر من رقم بطرق مختلفة.">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Path 1 — Official Cloud API */}
        <section className="relative flex flex-col overflow-hidden rounded-panel border-2 border-brand-teal/40 bg-surface p-5 shadow-card">
          <div aria-hidden="true" className="pointer-events-none absolute -end-12 -top-12 h-36 w-36 rounded-full bg-brand-teal/15 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-[#04282C] shadow-glow">
              <CloudIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-ink">واجهة Meta الرسمية (Cloud API)</h3>
              <Badge tone="success" size="sm" className="mt-1">موصى بها</Badge>
            </div>
          </div>
          <ul className="relative mt-4 flex-1 space-y-2">
            <Point ok>منتج رسمي من Meta دون خطر حظر الرقم</Point>
            <Point ok>استقرار عالٍ ومناسب للإرسال بكميات كبيرة</Point>
            <Point ok>يدعم القوالب المعتمدة خارج نافذة الـ 24 ساعة</Point>
            <Point ok={false}>يتطلب حساب Meta Business وقد يحتاج إلى توثيق النشاط</Point>
          </ul>
          <div className="relative mt-5 flex flex-col gap-2">
            <Button icon={CloudIcon} loading={metaLoading} onClick={onMeta} fullWidth>
              {metaLoading ? 'جارٍ الاتصال بـ Meta…' : 'الربط عبر Meta'}
            </Button>
            <Button variant="ghost" size="sm" icon={WrenchScrewdriverIcon} onClick={onManual} fullWidth>
              إعداد يدوي (Phone Number ID ورمز الوصول)
            </Button>
          </div>
        </section>

        {/* Path 2 — WhatsApp Web QR */}
        <section className="flex flex-col rounded-panel border border-line bg-surface-2 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-3 text-ink">
              <QrCodeIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-ink">واتساب ويب (رمز QR)</h3>
              <Badge tone="warning" size="sm" className="mt-1">طريقة غير رسمية</Badge>
            </div>
          </div>
          <ul className="mt-4 flex-1 space-y-2">
            <Point ok>دون موافقة من Meta ويعمل مع أي رقم</Point>
            <Point ok>دون رسوم على كل رسالة، مع الوسائط والتفاعلات</Point>
            <Point ok={false}>مخالف لشروط واتساب وقد يتعرّض الرقم للحظر</Point>
            <Point ok={false}>غير مناسب للإرسال بكميات كبيرة ويحتاج خادم جلسات</Point>
          </ul>
          <div className="mt-5">
            <Button variant="dark" icon={QrCodeIcon} loading={webLoading} onClick={onWeb} fullWidth>
              {webLoading ? 'جارٍ إنشاء الرمز…' : 'الربط برمز QR'}
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  )
}
