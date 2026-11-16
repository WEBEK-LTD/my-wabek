import React from 'react'
import {
  CloudIcon, DevicePhoneMobileIcon, EllipsisHorizontalIcon, QrCodeIcon, TrashIcon,
  ClipboardDocumentIcon, StarIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Badge, Button, Card, Dropdown, StatusPill, cn } from '@/components/ui'
import type { Tone } from '@/components/ui'
import { CopyField } from '@/components/settings/Shared'
import { copyText } from '@/components/settings/format'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/instances'

export interface Instance {
  id: string
  phone_number: string
  display_name: string | null
  status: string
  instance_type?: string | null
  phone_number_id?: string | null
  waba_id?: string | null
  webhook_url?: string | null
  qr_code?: string | null
  is_default?: boolean | null
  created_at?: string
}

/** Instance status → dictionary key (locales/dashboard/instances.ts) + tone. */
export const STATUS_META: Record<string, { label: keyof typeof messages.en; tone: Tone; pulse?: boolean }> = {
  connected:    { label: 'status_connected', tone: 'success' },
  disconnected: { label: 'status_disconnected', tone: 'danger' },
  pending:      { label: 'status_pending', tone: 'warning' },
  qr_pending:   { label: 'status_qr_pending', tone: 'warning', pulse: true },
  initializing: { label: 'status_initializing', tone: 'brand', pulse: true },
  banned:       { label: 'status_banned', tone: 'danger' },
}

export const isWebInstance = (i: Instance) => i.instance_type === 'wa_web'

export function NumberCard({ inst, onDelete, onReconnect, reconnecting }: {
  inst: Instance
  onDelete: (inst: Instance) => void
  onReconnect?: (inst: Instance) => void
  reconnecting?: boolean
}) {
  const { t, fmtDate } = useT(messages)
  const web = isWebInstance(inst)
  const known = STATUS_META[inst.status]
  const meta = known ? { ...known, label: t(known.label) } : { label: inst.status, tone: 'neutral' as Tone, pulse: false }
  const phone = web && inst.phone_number === 'pending' ? '' : inst.phone_number
  const title = inst.display_name || phone || (web ? t('waWeb') : t('waNumber'))
  const TypeIcon = web ? DevicePhoneMobileIcon : CloudIcon
  const canReconnect = web && ['disconnected', 'qr_pending', 'initializing'].includes(inst.status)
  const connected = inst.status === 'connected'

  const copyId = async () => {
    if (await copyText(inst.id)) toast.success(t('idCopied'))
  }

  return (
    <Card padding="none" interactive className="group flex flex-col overflow-hidden">
      {/* Top accent: gradient when connected */}
      <div aria-hidden="true" className={cn('h-1 w-full', connected ? 'bg-brand-gradient-x' : meta.tone === 'danger' ? 'bg-danger/60' : 'bg-line')} />
      <div className="flex items-start gap-3.5 p-5">
        <span className={cn(
          'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
          connected ? 'bg-brand-gradient text-[#04282C] shadow-[0_8px_22px_rgba(18,181,190,0.25)]' : 'bg-surface-3 text-muted',
        )}>
          <TypeIcon className="h-6 w-6" aria-hidden="true" />
          {connected && <span className="absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-success" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-ink">{title}</h3>
            {inst.is_default && <Badge tone="violet" size="sm" icon={StarIcon}>{t('defaultNumber')}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted">{phone ? <span dir="ltr">{phone}</span> : t('notLinkedYet')}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <StatusPill tone={meta.tone} pulse={meta.pulse} size="sm">{meta.label}</StatusPill>
            <Badge tone={web ? 'warning' : 'brand'} size="sm">{web ? 'WhatsApp Web' : 'Cloud API'}</Badge>
          </div>
        </div>
        <Dropdown
          label={t('numberOptions')}
          triggerClassName="h-9 w-9 justify-center rounded-btn text-muted hover:bg-surface-3 hover:text-ink"
          trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
          items={[
            { label: t('copyId'), icon: ClipboardDocumentIcon, onClick: copyId },
            ...(canReconnect && onReconnect ? [{ label: inst.status === 'qr_pending' ? t('showQr') : t('reconnect'), icon: QrCodeIcon, onClick: () => onReconnect(inst) }] : []),
            { label: t('deleteNumber'), icon: TrashIcon, danger: true, divider: true, onClick: () => onDelete(inst) },
          ]}
        />
      </div>

      <div className="mt-auto space-y-2 border-t border-line-soft bg-surface-2/50 px-5 py-4">
        <CopyField label={t('numberId')} value={inst.id} />
        {!web && (
          <>
            <CopyField label="Phone Number ID" value={inst.phone_number_id || ''} copyable={!!inst.phone_number_id} />
            {inst.webhook_url && <CopyField label="Webhook" value={inst.webhook_url} />}
          </>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-muted">{inst.created_at ? t('addedOn', { date: fmtDate(inst.created_at) }) : ''}</span>
          {canReconnect && onReconnect && (
            <Button size="sm" variant={inst.status === 'qr_pending' ? 'primary' : 'secondary'} icon={QrCodeIcon} loading={reconnecting} onClick={() => onReconnect(inst)}>
              {inst.status === 'qr_pending' ? t('showQr') : t('reconnect')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
