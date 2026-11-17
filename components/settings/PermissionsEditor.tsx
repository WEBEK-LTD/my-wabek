import {
  ShieldCheckIcon, CodeBracketIcon, MegaphoneIcon, LifebuoyIcon, EyeIcon, AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/components/ui'
import {
  PERM_GROUPS, PERM_PRESETS, PRESET_MAPS,
  type PermGroup, type PermLevel, type PermPreset, type PermissionMap,
} from '@/lib/team-permissions'

export type PermissionsValue = { preset: PermPreset; areas: PermissionMap }

const PRESET_ICONS: Record<PermPreset, typeof EyeIcon> = {
  admin: ShieldCheckIcon, developer: CodeBracketIcon, marketing: MegaphoneIcon,
  support: LifebuoyIcon, viewer: EyeIcon, custom: AdjustmentsHorizontalIcon,
}
const LEVELS: PermLevel[] = ['none', 'view', 'edit']

export const presetValue = (preset: Exclude<PermPreset, 'custom'>): PermissionsValue => ({ preset, areas: { ...PRESET_MAPS[preset] } })

/** Which template a set of levels matches (or 'custom'). */
function matchPreset(areas: PermissionMap): PermPreset {
  for (const p of PERM_PRESETS) {
    if (p === 'custom') continue
    if (PERM_GROUPS.every(g => PRESET_MAPS[p][g] === areas[g])) return p
  }
  return 'custom'
}

export type NumberOption = { id: string; display_name?: string | null; phone_number?: string | null }

export default function PermissionsEditor({ value, onChange, t, numbers, selectedNumbers, onNumbersChange }: {
  value: PermissionsValue
  onChange: (v: PermissionsValue) => void
  t: (key: string, vars?: Record<string, unknown>) => string
  /** Owner's numbers; when given, the member can be limited to some of them. */
  numbers?: NumberOption[]
  selectedNumbers?: string[]
  onNumbersChange?: (ids: string[]) => void
}) {
  const isAdmin = value.preset === 'admin'
  const setLevel = (g: PermGroup, l: PermLevel) => {
    const areas = { ...value.areas, [g]: l }
    onChange({ preset: matchPreset(areas), areas })
  }
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t('permTemplate')}</legend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
          {PERM_PRESETS.map(p => {
            const Icon = PRESET_ICONS[p]
            const selected = value.preset === p
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => (p === 'custom' ? onChange({ ...value, preset: 'custom' }) : onChange(presetValue(p)))}
                className={cn('rounded-card border p-3 text-start transition', selected ? 'border-brand-teal bg-chip/40 shadow-ring' : 'border-line hover:border-line-strong')}
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3 text-brand-ink"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="text-sm font-semibold text-ink">{t(`preset_${p}`)}</span>
                </span>
                <span className="mt-2 block text-xs leading-relaxed text-muted">{t(`presetDesc_${p}`)}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset disabled={isAdmin} className={cn(isAdmin && 'opacity-60')}>
        <legend className="mb-2 text-sm font-medium text-ink">{t('permSections')}</legend>
        <div className="divide-y divide-line-soft rounded-card border border-line">
          {PERM_GROUPS.map(g => (
            <div key={g} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <span id={`perm-${g}`} className="text-sm text-body">{t(`group_${g}`)}</span>
              <div className="inline-flex rounded-full border border-line bg-surface-2 p-0.5" role="radiogroup" aria-labelledby={`perm-${g}`}>
                {LEVELS.map(l => {
                  const on = value.areas[g] === l
                  return (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setLevel(g, l)}
                      className={cn('rounded-full px-3 py-1 text-xs font-medium transition',
                        on ? (l === 'none' ? 'bg-surface-3 text-ink' : l === 'view' ? 'bg-chip text-chip-ink' : 'bg-brand-gradient text-[#04282C]') : 'text-muted hover:text-ink')}
                    >
                      {t(`level_${l}`)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{t('ownerOnlyNote')}</p>
      </fieldset>

      {numbers && numbers.length > 0 && onNumbersChange && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">{t('permNumbers')}</legend>
          <div className="flex flex-wrap gap-1.5" role="group">
            {numbers.map(n => {
              const on = (selectedNumbers || []).includes(n.id)
              return (
                <button
                  key={n.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onNumbersChange(on ? (selectedNumbers || []).filter(x => x !== n.id) : [...(selectedNumbers || []), n.id])}
                  className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    on ? 'border-transparent bg-brand-gradient text-[#04282C]' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink')}
                >
                  {n.display_name || <span dir="ltr">{n.phone_number}</span>}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted">{t('permNumbersHint')}</p>
        </fieldset>
      )}
    </div>
  )
}
