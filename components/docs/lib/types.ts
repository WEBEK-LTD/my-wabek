import type { DocsLang } from './manifest'

export interface TocItem {
  id: string
  text: string
  depth: 2 | 3
}

export interface NavPage {
  slug: string
  title: string
}
export interface NavSection {
  id: string
  title: string
  pages: NavPage[]
}

export interface PagerLink {
  slug: string
  title: string
  section: string
}

/** One page in the client-side search index (compact keys keep the payload small). */
export interface SearchEntry {
  /** slug */
  s: string
  /** title */
  t: string
  /** description */
  d: string
  /** section title */
  c: string
  /** headings: [id, text] */
  h: [string, string][]
}

export interface DocPageData {
  slug: string
  title: string
  description: string
  sectionId: string
  sectionTitle: string
  html: string
  toc: TocItem[]
}

export interface DocsCommonProps {
  lang: DocsLang
  nav: NavSection[]
  search: SearchEntry[]
}

export interface DocPageProps extends DocsCommonProps {
  page: DocPageData
  prev: PagerLink | null
  next: PagerLink | null
}

export interface DocsHomeSection extends NavSection {
  firstSlug: string
}

export interface DocsHomeProps extends DocsCommonProps {
  sections: DocsHomeSection[]
  /** Highlighted request sample for the hero (built from the docs content). */
  sampleHtml: string
}
