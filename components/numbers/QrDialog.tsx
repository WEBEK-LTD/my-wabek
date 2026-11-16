import React, { useEffect, useState } from 'react'
import { ArrowPathIcon, QrCodeIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline'
import { Button, Modal, Spinner, cn } from '@/components/ui'
import { StepList, rich } from '@/components/settings/Shared'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/instances'
import type { Instance } from './NumberCard'

/** WhatsApp rotates linking codes roughly every 20–60 s; we count down 60 s per code. */
const QR_TTL = 60

export function qrSrc(code: string) {
  return code.startsWith('data:')
    ? code
    : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(code)}`
}

/**
 * Large QR code with a countdown. The parent owns the polling and the
 * request_qr refresh; this component only displays them.
 */
export function QrDialog({ instance, onClose, onRefresh, refreshing }: {
  instance: Instance | null
  onClose: () => void
  onRefresh: () => void
  refreshing?: boolean
}) {
  const { t: tr } = useT(messages)
  const code = instance?.qr_code || null
  const [left, setLeft] = useState(QR_TTL)

  // Restart the countdown whenever a new code arrives.
  useEffect(() => { setLeft(QR_TTL) }, [code])
  useEffect(() => {
    if (!instance || !code) return
    const t = setInterval(() => setLeft(s => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [instance?.id, code])

  const expired = !!code && left === 0
  const pct = code ? (left / QR_TTL) * 100 : 0

  return (
    <Modal
      open={!!instance}
      onClose={onClose}
      size="lg"
      icon={QrCodeIcon}
      title={tr('qrTitle')}
      description={tr('qrDesc')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{tr('cancel')}</Button>
          <Button variant={expired ? 'primary' : 'secondary'} icon={ArrowPathIcon} loading={refreshing} onClick={onRefresh}>{tr('refreshCode')}</Button>
        </>
      }
    >
      <div className="grid items-center gap-6 md:grid-cols-[auto,1fr]">
        <div className="mx-auto flex flex-col items-center gap-3">
          <div className="relative rounded-[26px] bg-brand-gradient p-[3px] shadow-hero">
            <div className="relative flex h-[17rem] w-[17rem] items-center justify-center rounded-[23px] bg-white p-4 sm:h-[18.5rem] sm:w-[18.5rem]">
              {code ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc(code)} alt={tr('qrAlt')} className={cn('h-full w-full object-contain transition', expired && 'opacity-15 blur-[2px]')} />
                  {expired && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <p className="text-sm font-semibold text-[#04282C]">{tr('codeExpired')}</p>
                      <Button size="sm" variant="dark" icon={ArrowPathIcon} loading={refreshing} onClick={onRefresh}>{tr('newCode')}</Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center text-[#3A5A5D]">
                  <Spinner className="h-8 w-8 text-[#12B5BE]" />
                  <p className="text-sm font-medium">{tr('creatingCode')}</p>
                  <p className="max-w-[12rem] text-xs">{tr('takesSeconds')}</p>
                </div>
              )}
            </div>
          </div>
          {/* Countdown */}
          <div className="flex w-full max-w-[18.5rem] flex-col gap-1.5" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', code && !expired ? 'animate-pulse bg-success' : 'bg-warning')} aria-hidden="true" />
                {code ? (expired ? tr('requestNew') : tr('waitingScan')) : tr('waitingServer')}
              </span>
              {code && !expired && <span className="tabular">{tr('expiresIn', { s: left })}</span>}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-track" role="progressbar" aria-label={tr('timeLeft')} aria-valuemin={0} aria-valuemax={QR_TTL} aria-valuenow={left}>
              <div className="h-full rounded-full bg-brand-gradient-x transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <DevicePhoneMobileIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />
            {tr('onPhone')}
          </div>
          <StepList steps={[
            { title: tr('step1') },
            { title: tr('step2'), body: tr('step2Body') },
            { title: tr('step3') },
          ]} />
          <p className="rounded-card bg-surface-2 px-4 py-3 text-xs leading-relaxed text-muted">
            {rich(tr('qrMissing'), { var: <code dir="ltr" className="font-mono">WA_WEB_SERVER_URL</code> })}
          </p>
        </div>
      </div>
    </Modal>
  )
}
