import Link from 'next/link'
import { LanguageIcon } from '@heroicons/react/24/outline'
import { cn } from '@/components/ui/utils'
import { docsHref, type DocsLang } from './lib/manifest'
import { docsStrings } from './lib/strings'
import { rememberDocsLang } from './useDocsLang'
import { LANGUAGES } from '@/lib/i18n'

/** Each language is shown by its own name (endonym). */
const endonym = (code: DocsLang) => LANGUAGES.find(l => l.code === code)?.name || code
const OPTIONS: { code: DocsLang; label: string }[] = (['ar', 'en'] as DocsLang[]).map(code => ({ code, label: endonym(code) }))

/** Two-way switch to the same page in the other language. */
export default function DocsLangSwitch({ lang, slug, className }: { lang: DocsLang; slug?: string | null; className?: string }) {
  const s = docsStrings(lang)
  return (
    <div role="group" aria-label={s.language} className={cn('flex items-center gap-1 rounded-btn border border-line bg-surface-2 p-1', className)}>
      <LanguageIcon className="mx-1.5 h-4 w-4 flex-none text-muted" aria-hidden="true" />
      {OPTIONS.map(o => {
        const active = o.code === lang
        return (
          <Link
            key={o.code}
            href={docsHref(o.code, slug)}
            hrefLang={o.code}
            lang={o.code}
            aria-current={active ? 'true' : undefined}
            onClick={() => { if (!active) rememberDocsLang(o.code) }}
            className={cn(
              'flex h-8 flex-1 items-center justify-center rounded-[9px] px-3 text-[13px] transition-colors',
              active ? 'bg-surface font-semibold text-ink shadow-card' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </Link>
        )
      })}
    </div>
  )
}
