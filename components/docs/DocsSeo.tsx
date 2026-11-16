import Head from 'next/head'
import { SITE_URL, docsHref, type DocsLang } from './lib/manifest'
import { docsStrings } from './lib/strings'

export interface DocsSeoProps {
  lang: DocsLang
  slug: string | null
  title: string
  description: string
  /** Breadcrumb trail after "Docs" (for JSON-LD). */
  trail?: { name: string; slug: string | null }[]
}

const jsonLd = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

export default function DocsSeo({ lang, slug, title, description, trail = [] }: DocsSeoProps) {
  const s = docsStrings(lang)
  const url = SITE_URL + docsHref(lang, slug)
  const fullTitle = slug ? `${title} · ${s.docsTitle}` : s.docsTitle
  const crumbs = [{ name: s.docs, slug: null as string | null }, ...trail]
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta key="description" name="description" content={description} />
      <link key="canonical" rel="canonical" href={url} />
      <link key="alt-ar" rel="alternate" hrefLang="ar" href={SITE_URL + docsHref('ar', slug)} />
      <link key="alt-en" rel="alternate" hrefLang="en" href={SITE_URL + docsHref('en', slug)} />
      <link key="alt-default" rel="alternate" hrefLang="x-default" href={SITE_URL + docsHref('ar', slug)} />
      <meta key="og:type" property="og:type" content={slug ? 'article' : 'website'} />
      <meta key="og:site_name" property="og:site_name" content="WABEK" />
      <meta key="og:title" property="og:title" content={fullTitle} />
      <meta key="og:description" property="og:description" content={description} />
      <meta key="og:url" property="og:url" content={url} />
      <meta key="og:locale" property="og:locale" content={lang === 'ar' ? 'ar_AR' : 'en_US'} />
      <meta key="og:locale:alternate" property="og:locale:alternate" content={lang === 'ar' ? 'en_US' : 'ar_AR'} />
      <meta key="og:image" property="og:image" content={`${SITE_URL}/brand/logo-mark.png`} />
      <meta key="twitter:card" name="twitter:card" content="summary" />
      <meta key="twitter:title" name="twitter:title" content={fullTitle} />
      <meta key="twitter:description" name="twitter:description" content={description} />
      <script
        key="docs-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: crumbs.map((c, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: c.name,
              item: SITE_URL + docsHref(lang, c.slug),
            })),
          }),
        }}
      />
    </Head>
  )
}
