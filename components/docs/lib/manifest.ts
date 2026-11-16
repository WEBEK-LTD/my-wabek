// Client-safe helpers around content/docs/manifest.json (sidebar order, slugs, URLs).
// The JSON is imported statically so it is bundled (works in serverless routes
// such as the sitemap, where the content folder may not be on disk).
import rawManifest from '@/content/docs/manifest.json'

export type DocsLang = 'ar' | 'en'
export const DOCS_LANGS: DocsLang[] = ['ar', 'en']
export const DEFAULT_DOCS_LANG: DocsLang = 'ar'

export interface ManifestPage {
  slug: string
  title_ar: string
  title_en: string
  file_ar: string
  file_en: string
}
export interface ManifestSection {
  id: string
  order: number
  title_ar: string
  title_en: string
  pages: ManifestPage[]
}
export interface DocsManifest {
  version: number
  base_path: string
  languages: string[]
  default_language: string
  sections: ManifestSection[]
}

export const manifest = rawManifest as DocsManifest

/** Public site origin used for canonical URLs, Open Graph and the sitemap. */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com').replace(/\/+$/, '')

export function asDocsLang(v: unknown): DocsLang {
  return v === 'en' ? 'en' : 'ar'
}

/** Docs language for any UI language: Arabic stays Arabic, everything else reads English. */
export function docsLangFor(uiLang: string | null | undefined): DocsLang {
  return uiLang === 'ar' ? 'ar' : 'en'
}

/** Path of a docs page (or the docs home when slug is empty) in a language. */
export function docsHref(lang: DocsLang, slug?: string | null, hash?: string): string {
  const base = lang === 'en' ? '/en/docs' : '/docs'
  return (slug ? `${base}/${slug}` : base) + (hash ? `#${hash}` : '')
}

/** Every page slug in manifest order. */
export function allDocSlugs(): string[] {
  return manifest.sections.flatMap(s => s.pages.map(p => p.slug))
}

export function sectionTitle(section: ManifestSection, lang: DocsLang): string {
  return lang === 'en' ? section.title_en : section.title_ar
}
export function pageTitle(page: ManifestPage, lang: DocsLang): string {
  return lang === 'en' ? page.title_en : page.title_ar
}

/** Sitemap entries (both languages) for the docs home and every page. */
export function docsSitemapPaths(): { path: string; priority: string; changefreq: string }[] {
  const out: { path: string; priority: string; changefreq: string }[] = []
  for (const lang of DOCS_LANGS) {
    out.push({ path: docsHref(lang), priority: '0.8', changefreq: 'weekly' })
    for (const slug of allDocSlugs()) out.push({ path: docsHref(lang, slug), priority: '0.6', changefreq: 'monthly' })
  }
  return out
}
