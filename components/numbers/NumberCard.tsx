import React from 'react'
import {
  CloudIcon, DevicePhoneMobileIcon, EllipsisHorizontalIcon, QrCodeIcon, TrashIcon,
  ClipboardDocumentIcon, StarIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Badge, Button, Card, Dropdown, StatusPill, cn } from '@/components/ui'
import type { Tone } from '@/components/ui'
import { CopyField } from '@/components/settings/Shared'
import { copyText, fmtDate } from '@/components/settings/format'

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

export const STATUS_META: Record<string, { label: string; tone: Tone; pulse?: boolean }> = {
  connected:    { label: 'متصل', tone: 'success' },
  disconnected: { label: 'غير متصل', tone: 'danger' },
  pending:      { label: 'قيد الانتظار', tone: 'warning' },
  qr_pending:   { label: 'بانتظار مسح الرمز', tone: 'warning', pulse: true },
  initializing: { label: 'جارٍ التهيئة', tone: 'brand', pulse: true },
  banned:       { label: 'محظور', tone: 'danger' },
}

export const isWebInstance = (i: Instance) => i.instance_type === 'wa_web'

export function NumberCard({ inst, onDelete, onReconnect, reconnecting }: {
  inst: Instance
  onDelete: (inst: Instance) => void
  onReconnect?: (inst: Instance) => void
  reconnecting?: boolean
}) {
  const web = isWebInstance(inst)
  const meta = STATUS_META[inst.status] || { label: inst.status, tone: 'neutral' as Tone }
  const phone = web && inst.phone_number === 'pending' ? '' : inst.phone_number
  const title = inst.display_name || phone || (web ? 'واتساب ويب' : 'رقم واتساب')
  const TypeIcon = web ? DevicePhoneMobileIcon : CloudIcon
  const canReconnect = web && ['disconnected', 'qr_pending', 'initializing'].includes(inst.status)
  const connected = inst.status === 'connected'

  const copyId = async () => {
    if (await copyText(inst.id)) toast.success('تم نسخ معرّف الرقم')
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
            {inst.is_default && <Badge tone="violet" size="sm" icon={StarIcon}>الرقم الافتراضي</Badge>}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted" dir="ltr">{phone || 'لم يُربط بعد'}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <StatusPill tone={meta.tone} pulse={meta.pulse} size="sm">{meta.label}</StatusPill>
            <Badge tone={web ? 'warning' : 'brand'} size="sm">{web ? 'WhatsApp Web' : 'Cloud API'}</Badge>
          </div>
        </div>
        <Dropdown
          label="خيارات الرقم"
          triggerClassName="h-9 w-9 justify-center rounded-btn text-muted hover:bg-surface-3 hover:text-ink"
          trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
          items={[
            { label: 'نسخ معرّف الرقم', icon: ClipboardDocumentIcon, onClick: copyId },
            ...(canReconnect && onReconnect ? [{ label: inst.status === 'qr_pending' ? 'عرض رمز QR' : 'إعادة الربط', icon: QrCodeIcon, onClick: () => onReconnect(inst) }] : []),
            { label: 'حذف الرقم', icon: TrashIcon, danger: true, divider: true, onClick: () => onDelete(inst) },
          ]}
        />
      </div>

      <div className="mt-auto space-y-2 border-t border-line-soft bg-surface-2/50 px-5 py-4">
        <CopyField label="معرّف الرقم" value={inst.id} />
        {!web && (
          <>
            <CopyField label="Phone Number ID" value={inst.phone_number_id || ''} copyable={!!inst.phone_number_id} />
            {inst.webhook_url && <CopyField label="Webhook" value={inst.webhook_url} />}
          </>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-muted">{inst.created_at ? `أُضيف في ${fmtDate(inst.created_at)}` : ''}</span>
          {canReconnect && onReconnect && (
            <Button size="sm" variant={inst.status === 'qr_pending' ? 'primary' : 'secondary'} icon={QrCodeIcon} loading={reconnecting} onClick={() => onReconnect(inst)}>
              {inst.status === 'qr_pending' ? 'عرض رمز QR' : 'إعادة الربط'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
