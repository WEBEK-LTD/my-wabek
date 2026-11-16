import React from 'react'
import { Logo } from '@/components/ui'
import { cn } from '@/components/ui/utils'

/**
 * ErrorScreen — full-page deep-teal state used by 404, 500 and the link
 * redirect fallback. Kept light (no data calls) so it renders even when the
 * rest of the app is failing.
 */
export function ErrorScreen({ code, title, body, actions, dir, lang, children }: {
  code?: string
  title: React.ReactNode
  body?: React.ReactNode
  actions?: React.ReactNode
  dir: 'rtl' | 'ltr'
  lang: string
  children?: React.ReactNode
}) {
  return (
    <main dir={dir} lang={lang} className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-deep-landing px-4 py-16 text-center text-deep-ink">
      <div aria-hidden="true" className="pointer-events-none absolute start-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06] rtl:translate-x-1/2" />
      <div aria-hidden="true" className="pointer-events-none absolute start-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07] rtl:translate-x-1/2" />
      <div className="relative flex max-w-lg flex-col items-center gap-5">
        <Logo href="/" size={64} wordmark={false} hiRes glow />
        {code && (
          <p className={cn('tabular text-[88px] font-bold leading-none tracking-tight sm:text-[120px]', 'text-gradient')} dir="ltr" aria-hidden="true">
            {code}
          </p>
        )}
        <h1 className="text-2xl font-bold text-deep-ink sm:text-3xl">{title}</h1>
        {body && <p className="text-base leading-[1.85] text-deep-muted">{body}</p>}
        {children}
        {actions && <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div>}
      </div>
    </main>
  )
}

export default ErrorScreen
