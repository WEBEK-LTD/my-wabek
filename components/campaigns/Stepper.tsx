import React from 'react'
import { CheckIcon } from '@heroicons/react/20/solid'
import { cn } from '@/components/ui'

export interface WizardStep { id: number; label: string; hint?: string; icon: React.ElementType }

/** Horizontal step indicator; finished steps are buttons back to that step. */
export function Stepper({ steps, current, maxReached, onGo }: {
  steps: WizardStep[]
  current: number
  maxReached: number
  onGo: (step: number) => void
}) {
  return (
    <nav aria-label="خطوات إنشاء الحملة">
      <ol className="flex items-stretch gap-1.5 sm:gap-2">
        {steps.map((s, i) => {
          const done = s.id < current
          const active = s.id === current
          const reachable = s.id <= maxReached && !active
          const Icon = s.icon
          return (
            <li key={s.id} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onGo(s.id)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'group flex min-w-0 flex-1 items-center gap-2.5 rounded-card border px-2.5 py-2 text-start transition sm:px-3.5 sm:py-2.5',
                  active ? 'border-transparent bg-deep-hero text-deep-ink shadow-hero'
                    : done ? 'border-line bg-surface hover:border-brand-teal'
                    : 'border-line-soft bg-surface-2 text-muted',
                  !reachable && !active && 'cursor-default',
                )}
              >
                <span className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular',
                  active ? 'bg-brand-gradient text-[#04282C]' : done ? 'bg-success-bg text-success' : 'bg-surface-3 text-muted',
                )}>
                  {done ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className={cn('block text-[11px]', active ? 'text-deep-muted' : 'text-muted')}>الخطوة {i + 1}</span>
                  <span className={cn('block truncate text-sm font-semibold', active ? 'text-deep-ink' : done ? 'text-ink' : 'text-muted')}>{s.label}</span>
                </span>
                <span className="sr-only sm:hidden">{`الخطوة ${i + 1}: ${s.label}`}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-sm font-semibold text-ink sm:hidden">
        الخطوة {current} من {steps.length}: {steps.find(s => s.id === current)?.label}
      </p>
    </nav>
  )
}
