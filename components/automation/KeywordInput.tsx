import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/20/solid'
import { cn } from '@/components/ui'

export interface KeywordInputProps {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  id?: string
  'aria-describedby'?: string
  className?: string
  max?: number
}

/**
 * KeywordInput — type a word and press Enter or comma to add it as a chip.
 * Backspace on an empty field removes the last chip. Pasting "a, b, c"
 * adds all three.
 */
export function KeywordInput({ value, onChange, placeholder = 'اكتب كلمة ثم اضغط Enter', id, className, max = 100, ...aria }: KeywordInputProps) {
  const [draft, setDraft] = useState('')

  const add = (raw: string) => {
    const parts = raw.split(/[,،\n]/).map(s => s.trim()).filter(Boolean)
    if (!parts.length) return
    const next = [...value]
    for (const p of parts) if (!next.some(v => v.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p)
    onChange(next)
    setDraft('')
  }

  return (
    <div className={cn('flex min-h-11 flex-wrap items-center gap-1.5 rounded-field border border-line-strong bg-surface px-2 py-1.5 transition focus-within:border-brand-teal focus-within:shadow-ring', className)}>
      {value.map(k => (
        <span key={k} className="inline-flex items-center gap-1 rounded-full bg-chip py-0.5 pe-1 ps-2.5 text-[13px] font-medium text-chip-ink">
          {k}
          <button type="button" onClick={() => onChange(value.filter(v => v !== k))} aria-label={`إزالة ${k}`}
            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-surface/70">
            <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={e => { const v = e.target.value; if (/[,،]/.test(v)) add(v); else setDraft(v) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); add(draft) }
          else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={() => add(draft)}
        onPaste={e => { const t = e.clipboardData.getData('text'); if (/[,،\n]/.test(t)) { e.preventDefault(); add(draft + t) } }}
        placeholder={value.length ? '' : placeholder}
        className="h-7 min-w-[120px] flex-1 bg-transparent px-1 text-sm text-ink placeholder:text-muted focus:outline-none"
        {...aria}
      />
    </div>
  )
}

export default KeywordInput
