import React from 'react'
import { Input, Select, Switch } from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import { SettingRow } from '../shared'

export type Settings = Record<string, unknown>
export interface Bound { settings: Settings; set: (k: string, v: unknown) => void }

export const asBool = (v: unknown) => v === true || v === 'true'

export function ToggleRow({ k, label, desc, settings, set }: Bound & { k: string; label: string; desc?: string }) {
  return (
    <SettingRow label={label} description={desc}>
      <Switch checked={asBool(settings[k])} onChange={v => set(k, v)} aria-label={label} />
    </SettingRow>
  )
}

export function NumberRow({ k, label, desc, min = 0, max = 9999, settings, set, suffix }: Bound & { k: string; label: string; desc?: string; min?: number; max?: number; suffix?: string }) {
  const id = `set-${k}`
  const raw = settings[k]
  return (
    <SettingRow label={label} description={desc} htmlFor={id}>
      <Input id={id} type="number" dir="ltr" size="sm" min={min} max={max} wrapperClassName="w-32"
        value={raw === null || raw === undefined || raw === '' ? '' : Number(raw)}
        onChange={e => set(k, e.target.value === '' ? '' : parseInt(e.target.value))}
        endAdornment={suffix ? <span className="text-xs text-muted">{suffix}</span> : undefined} />
    </SettingRow>
  )
}

export function TextRow({ k, label, desc, placeholder, settings, set, ltr }: Bound & { k: string; label: string; desc?: string; placeholder?: string; ltr?: boolean }) {
  const id = `set-${k}`
  return (
    <SettingRow label={label} description={desc} htmlFor={id} stacked>
      <Input id={id} dir={ltr ? 'ltr' : undefined} value={(settings[k] as string) || ''} onChange={e => set(k, e.target.value)} placeholder={placeholder} />
    </SettingRow>
  )
}

export function SelectRow({ k, label, desc, options, settings, set }: Bound & { k: string; label: string; desc?: string; options: SelectOption[] }) {
  const id = `set-${k}`
  return (
    <SettingRow label={label} description={desc} htmlFor={id}>
      <Select id={id} size="sm" value={(settings[k] as string) || ''} onChange={e => set(k, e.target.value)} options={options} className="min-w-[200px]" />
    </SettingRow>
  )
}
