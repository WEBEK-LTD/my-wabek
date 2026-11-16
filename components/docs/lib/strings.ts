import type { DocsLang } from './manifest'

import { translate } from '@/lib/i18n-local'
import messages, { type DocsMessageKey } from '@/locales/docs'

/** UI copy for the docs site. The docs language comes from the URL, so the
 *  strings are resolved from the docs language, not the app language. */
const SECTION_IDS = ['getting-started', 'guides', 'integrations', 'api', 'security', 'faq', 'changelog'] as const

function build(lang: DocsLang) {
  const t = (k: DocsMessageKey, vars?: Record<string, string | number>) => translate(messages, lang, k, vars)
  const flat = Object.fromEntries((Object.keys(messages.en) as DocsMessageKey[]).map(k => [k, t(k)])) as Record<DocsMessageKey, string>
  return {
    ...flat,
    otherLangCode: (lang === 'ar' ? 'en' : 'ar') as DocsLang,
    pagesCount: (n: number) => t(n === 1 ? 'pages_one' : n === 2 ? 'pages_two' : n <= 10 ? 'pages_few' : 'pages_many', { n }),
    sectionDescriptions: Object.fromEntries(SECTION_IDS.map(id => [id, t(`section_${id}` as DocsMessageKey)])) as Record<string, string>,
  }
}

const STRINGS = { ar: build('ar'), en: build('en') }

export type DocsStrings = typeof STRINGS['ar']

export function docsStrings(lang: DocsLang): DocsStrings {
  return STRINGS[lang] as DocsStrings
}
