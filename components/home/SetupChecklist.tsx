import Link from 'next/link'
import { CheckIcon, PlusIcon } from '@heroicons/react/20/solid'
import { ProgressBar } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/home'
import type { MessageKey as HomeCopyKey } from '@/locales/dashboard/home'

export interface SetupStep {
  id: string
  label: HomeCopyKey
  href: string
  done: boolean
}

/** Gradient "set up your account" banner. Renders nothing once every step is done. */
export function SetupChecklist({ steps, brand }: { steps: SetupStep[]; brand: string }) {
  const { t } = useT(messages)
  if (!steps.length) return null
  const done = steps.filter(s => s.done).length
  if (done === steps.length) return null

  return (
    <section
      aria-label={t('setup_aria')}
      className="relative flex flex-wrap items-center gap-5 overflow-hidden rounded-panel bg-brand-gradient-soft px-5 py-5 text-[#04282C] shadow-[0_18px_44px_rgba(18,181,190,0.22)] sm:px-6"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-white/20 blur-2xl" />
      <div className="relative flex min-w-[220px] flex-[1_1_240px] flex-col gap-2">
        <h2 className="text-lg font-bold">{t('setup_title', { done, total: steps.length })}</h2>
        <p className="text-[13px] text-[#04282C]/75">{t('setup_sub', { brand })}</p>
        <ProgressBar tone="on-gradient" value={done} max={steps.length} size="md" className="max-w-[260px]" aria-label={t('setup_aria')} />
      </div>
      <ol className="relative flex flex-[3_1_480px] flex-wrap gap-2">
        {steps.map(s => (
          <li key={s.id}>
            {s.done ? (
              <span className="flex items-center gap-2 rounded-btn bg-[#04282C]/[0.12] px-3.5 py-2.5 text-[13px] font-medium">
                <CheckIcon className="h-4 w-4" aria-hidden="true" />
                <span>{t(s.label)}</span>
                <span className="sr-only">({t('step_done')})</span>
              </span>
            ) : (
              <Link
                href={s.href}
                className={cn(
                  'flex items-center gap-2 rounded-btn bg-[#04282C] px-3.5 py-2.5 text-[13px] font-semibold text-[#EAF7F5] transition',
                  'hover:bg-[#0A3A3F] hover:text-white focus-visible:outline-[#04282C]',
                )}
              >
                <PlusIcon className="h-4 w-4" aria-hidden="true" />
                {t(s.label)}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
