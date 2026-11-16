import React from 'react'
import {
  CloudIcon, QrCodeIcon, CheckIcon, ExclamationTriangleIcon, WrenchScrewdriverIcon, PlusIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Modal, cn } from '@/components/ui'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/instances'

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
  const { t } = useT(messages)
  return (
    <Modal open={open} onClose={onClose} size="xl" icon={PlusIcon} title={t('connectTitle')} description={t('connectDesc')}>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Path 1 — Official Cloud API */}
        <section className="relative flex flex-col overflow-hidden rounded-panel border-2 border-brand-teal/40 bg-surface p-5 shadow-card">
          <div aria-hidden="true" className="pointer-events-none absolute -end-12 -top-12 h-36 w-36 rounded-full bg-brand-teal/15 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-[#04282C] shadow-glow">
              <CloudIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-ink">{t('cloudTitle')}</h3>
              <Badge tone="success" size="sm" className="mt-1">{t('recommended')}</Badge>
            </div>
          </div>
          <ul className="relative mt-4 flex-1 space-y-2">
            <Point ok>{t('cloudPoint1')}</Point>
            <Point ok>{t('cloudPoint2')}</Point>
            <Point ok>{t('cloudPoint3')}</Point>
            <Point ok={false}>{t('cloudPoint4')}</Point>
          </ul>
          <div className="relative mt-5 flex flex-col gap-2">
            <Button icon={CloudIcon} loading={metaLoading} onClick={onMeta} fullWidth>
              {metaLoading ? t('connectingMeta') : t('connectMeta')}
            </Button>
            <Button variant="ghost" size="sm" icon={WrenchScrewdriverIcon} onClick={onManual} fullWidth>
              {t('manualSetup')}
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
              <h3 className="font-semibold text-ink">{t('webTitle')}</h3>
              <Badge tone="warning" size="sm" className="mt-1">{t('unofficial')}</Badge>
            </div>
          </div>
          <ul className="mt-4 flex-1 space-y-2">
            <Point ok>{t('webPoint1')}</Point>
            <Point ok>{t('webPoint2')}</Point>
            <Point ok={false}>{t('webPoint3')}</Point>
            <Point ok={false}>{t('webPoint4')}</Point>
          </ul>
          <div className="mt-5">
            <Button variant="dark" icon={QrCodeIcon} loading={webLoading} onClick={onWeb} fullWidth>
              {webLoading ? t('creatingCode') : t('connectQr')}
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  )
}
