import React from 'react'
import { fmtNum, pct } from './shared'

export interface FunnelStage { label: string; value: number; color: string }

/** Funnel rows: each bar relative to the first stage, with the step-to-step conversion. */
export function Funnel({ stages, ariaLabel = 'مسار التسليم' }: { stages: FunnelStage[]; ariaLabel?: string }) {
  const top = Math.max(1, stages[0]?.value || 0)
  return (
    <ol className="space-y-4" aria-label={ariaLabel}>
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : 0
        return (
          <li key={s.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-muted">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
                {s.label}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-base font-bold text-ink tabular">{fmtNum(s.value)}</span>
                {i > 0 && (
                  <span className="text-xs text-muted tabular">
                    {pct(s.value, prev)}%<span className="sr-only"> من «{stages[i - 1].label}»</span>
                  </span>
                )}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
              <div className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{ width: `${(s.value / top) * 100}%`, background: s.color }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
