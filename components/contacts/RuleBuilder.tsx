import { PlusIcon, XMarkIcon, TagIcon, UserIcon, PhoneIcon, NoSymbolIcon, BellSlashIcon } from '@heroicons/react/24/outline'
import { Button, Input, Select, cn } from '@/components/ui'
import {
  SEGMENT_FIELDS, SEGMENT_OPERATORS, SegmentCondition, SegmentField, booleanValues, defaultCondition, isBooleanField,
} from './segmentRules'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/segments'

const FIELD_ICONS: Record<string, React.ElementType> = {
  tags: TagIcon, name: UserIcon, phone: PhoneIcon, opted_out: BellSlashIcon, is_blocked: NoSymbolIcon,
}

const MAX_CONDITIONS = 20

export interface RuleBuilderProps {
  conditions: SegmentCondition[]
  operator: 'AND' | 'OR'
  onChange: (conditions: SegmentCondition[]) => void
  onOperatorChange: (op: 'AND' | 'OR') => void
  /** Tag suggestions for the value field. */
  tagSuggestions?: string[]
}

/**
 * RuleBuilder — rows of [field] [operator] [value] chips joined by a visible
 * "and / or" connector, with an "all / any" switch on top.
 */
export function RuleBuilder({ conditions, operator, onChange, onOperatorChange, tagSuggestions = [] }: RuleBuilderProps) {
  const { t } = useT(messages)
  const update = (idx: number, patch: Partial<SegmentCondition>) =>
    onChange(conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  const setField = (idx: number, field: SegmentField) => onChange(conditions.map((c, i) => (i === idx ? defaultCondition(field) : c)))
  const remove = (idx: number) => onChange(conditions.filter((_, i) => i !== idx))
  const add = () => onChange([...conditions, defaultCondition()])
  const listId = 'segment-tag-suggestions'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
        <span>{t('rb_match')}</span>
        <div role="radiogroup" aria-label={t('rb_match_aria')} className="inline-flex rounded-full bg-surface-3 p-0.5">
          {([['AND', t('rb_all')], ['OR', t('rb_any')]] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={operator === v} onClick={() => onOperatorChange(v)}
              className={cn('rounded-full px-3 py-1 text-[13px] font-medium transition',
                operator === v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <ol className="flex flex-col">
        {conditions.map((cond, idx) => {
          const Icon = FIELD_ICONS[cond.field] || TagIcon
          const ops = (SEGMENT_OPERATORS[cond.field] || [{ value: 'equals', labelKey: 'op_equals' as const }]).map(o => ({ value: o.value, label: t(o.labelKey) }))
          return (
            <li key={idx} className="flex flex-col">
              {idx > 0 && (
                <div className="flex items-center gap-2 py-1.5 ps-5" aria-hidden="true">
                  <span className="h-4 w-px bg-line-strong" />
                  <span className="rounded-full bg-chip px-2 py-0.5 text-2xs font-semibold text-chip-ink">{operator === 'AND' ? t('rb_and') : t('rb_or')}</span>
                </div>
              )}
              <div className="flex flex-col gap-2 rounded-card border border-line bg-surface-2 p-2.5 sm:flex-row sm:items-center">
                <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chip text-brand-ink sm:flex">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div className="sm:w-40">
                  <Select size="sm" aria-label={t('rb_field_n', { n: idx + 1 })} value={cond.field}
                    onChange={e => setField(idx, e.target.value as SegmentField)}
                    options={SEGMENT_FIELDS.map(f => ({ value: f.value, label: t(f.labelKey) }))} />
                </div>
                <div className="sm:w-32">
                  <Select size="sm" aria-label={t('rb_operator_n', { n: idx + 1 })} value={cond.operator}
                    onChange={e => update(idx, { operator: e.target.value })} options={ops} />
                </div>
                <div className="flex flex-1 items-center gap-2">
                  {isBooleanField(cond.field) ? (
                    <div className="min-w-0 flex-1">
                      <Select size="sm" aria-label={t('rb_value_n', { n: idx + 1 })} value={cond.value}
                        onChange={e => update(idx, { value: e.target.value })} options={booleanValues(t)} />
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                    <Input size="sm" aria-label={t('rb_value_n', { n: idx + 1 })} value={cond.value} maxLength={100}
                      dir={cond.field === 'phone' ? 'ltr' : undefined}
                      list={cond.field === 'tags' ? listId : undefined}
                      placeholder={cond.field === 'tags' ? t('rb_ph_tag') : cond.field === 'phone' ? '966' : t('rb_ph_name')}
                      onChange={e => update(idx, { value: e.target.value })} />
                    </div>
                  )}
                  <Button type="button" size="icon-sm" variant="ghost" icon={XMarkIcon} aria-label={t('rb_remove_n', { n: idx + 1 })}
                    disabled={conditions.length === 1} onClick={() => remove(idx)} className="hover:text-danger" />
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      <datalist id={listId}>{tagSuggestions.map(t => <option key={t} value={t} />)}</datalist>

      <div>
        <Button type="button" variant="secondary" size="sm" icon={PlusIcon} onClick={add} disabled={conditions.length >= MAX_CONDITIONS}>
          {t('rb_add')}
        </Button>
      </div>
    </div>
  )
}

export default RuleBuilder
