import Head from 'next/head'
import { useEffect, useState, createContext } from 'react'
import Router, { useRouter } from 'next/router'
import { BRAND_ASSETS, brandOverride } from '@/hooks/useWhiteLabel'
import { DEFAULT_LANG, getStoredLang, setStoredLang, isRtlLang, routeLang } from '@/lib/i18n'
import { AppToaster } from '@/components/ui/Toast'

export const LangContext = createContext<{lang:string;setLang:(l:string)=>void}>({lang:DEFAULT_LANG,setLang:()=>{}})

/** Routes whose shell manages <html lang/dir> itself (profile language). */
const SHELL_ROUTES = /^\/(dashboard|admin)(\/|$)/

// Admin-configured values that end up inside <script> tags.
const safeGaId = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9-]{1,40}$/.test(v) ? v : '')
const safeJsonLd = (v: unknown) => (typeof v === 'string' ? v.replace(/</g, '\\u003c') : '')

/** Canonical for pages that don't declare their own: configured origin + path (no query/hash). */
function defaultCanonical(base: unknown, asPath: string): string {
  if (typeof base !== 'string' || !/^https?:\/\//i.test(base)) return ''
  const path = (asPath || '/').split(/[?#]/)[0] || '/'
  return base.replace(/\/+$/, '') + (path === '/' ? '' : path)
}

function SeoHead() {
  const router = useRouter()
  const [seo, setSeo] = useState<any>({})
  const [brand, setBrand] = useState<any>({})
  const [webmaster, setWebmaster] = useState<any>({})
  useEffect(() => {
    // Public, cached, read-only subset of the admin SEO settings.
    fetch('/api/seo/public')
      .then(r => (r.ok ? r.json() : {}))
      .then((d: any) => { setSeo(d.seo || {}); setBrand(d.brand || {}); setWebmaster(d.webmaster || {}) })
      .catch(() => {})
  }, [])
  const isApp = SHELL_ROUTES.test(router.pathname)
  const canonical = isApp ? '' : defaultCanonical(seo.canonical, router.asPath)
  const schemas = Object.entries(seo).filter(([k, v]) => /^schema_[a-z0-9_]+$/.test(k) && typeof v === 'string' && v)

  const siteTitle = seo.site_title || brand.app_name || 'WABEK'
  // Admin-configured overrides win; the legacy Cloudinary logo falls back to /brand.
  const favicon = brandOverride(brand.favicon_url) || brandOverride(seo.favicon_url) || BRAND_ASSETS.favicon
  const logo = brandOverride(brand.logo_url) || BRAND_ASSETS.mark
  const titleTemplate = seo.title_template || '%page% | ' + siteTitle

  if (typeof window !== 'undefined') {
    ;(window as any).__WABEK_TITLE_TEMPLATE__ = titleTemplate
    ;(window as any).__WABEK_SITE_TITLE__ = siteTitle
    ;(window as any).__WABEK_LOGO__ = logo
  }

  return (
    <Head>
      <title>{siteTitle}</title>
      {seo.site_description && <meta key="description" name="description" content={seo.site_description} />}
      {/* Pages that set their own <link key="canonical"> (docs, blog…) override this one. */}
      {canonical && <link key="canonical" rel="canonical" href={canonical} />}
      {seo.og_image && <meta key="og:image" property="og:image" content={seo.og_image} />}
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <link key="favicon" rel="icon" href={favicon} />
      <link key="apple-touch-icon" rel="apple-touch-icon" href={brandOverride(brand.favicon_url) || BRAND_ASSETS.appleTouch} />
      {safeGaId(seo.ga_id) && <script async src={"https://www.googletagmanager.com/gtag/js?id=" + safeGaId(seo.ga_id)} />}
      {safeGaId(seo.ga_id) && <script dangerouslySetInnerHTML={{ __html: "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','" + safeGaId(seo.ga_id) + "')" }} />}
      {webmaster.google_site_verification && <meta name="google-site-verification" content={webmaster.google_site_verification} />}
      {webmaster.bing_site_verification && <meta name="msvalidate.01" content={webmaster.bing_site_verification} />}
      {webmaster.yandex_verification && <meta name="yandex-verification" content={webmaster.yandex_verification} />}
      {webmaster.baidu_verification && <meta name="baidu-site-verification" content={webmaster.baidu_verification} />}
      <meta name="p:domain_verify" content={webmaster.pinterest_verification || '67f0db54e40ee97b1eeb7675f199e477'} />
      {!isApp && schemas.map(([k, v]) => (
        <script key={k} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(v) }} />
      ))}
    </Head>
  )
}

import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from 'react-query'
import '@/styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

export default function App({ Component, pageProps }: AppProps) {
  // Start with the default on the server and first render (no hydration
  // mismatch); the stored language is applied right after mount.
  const [globalLang, setGlobalLang] = useState<string>(DEFAULT_LANG)

  const setLang = (l: string) => {
    setGlobalLang(l)
    if (typeof window !== 'undefined') {
      setStoredLang(l)
      window.dispatchEvent(new CustomEvent('langchange', { detail: l }))
    }
  }

  // Public pages: keep <html lang/dir> in sync with the chosen language.
  // Routes whose URL fixes the language (/en/… docs, /docs) keep it.
  useEffect(() => {
    if (SHELL_ROUTES.test(Router.pathname)) return
    const l = routeLang(Router.asPath) || globalLang
    document.documentElement.lang = l
    document.documentElement.dir = isRtlLang(l) ? 'rtl' : 'ltr'
  }, [globalLang])

  useEffect(() => {
    // Sync lang from localStorage on mount
    const stored = getStoredLang()
    setStoredLang(stored) // mirrors the choice into the cookie read by _document
    if (stored !== globalLang) setGlobalLang(stored)

    // Listen for changes
    const onLangChange = (e: any) => {
      if (typeof e.detail !== 'string') return
      setGlobalLang(e.detail)
      setStoredLang(e.detail)
    }
    window.addEventListener('langchange', onLangChange)

    // On route change: fire langchange so new page gets current lang
    const onRoute = () => {
      const lang = getStoredLang()
      window.dispatchEvent(new CustomEvent('langchange', { detail: lang }))
      if (!SHELL_ROUTES.test(Router.pathname)) {
        const l = routeLang(Router.asPath) || lang
        document.documentElement.lang = l
        document.documentElement.dir = isRtlLang(l) ? 'rtl' : 'ltr'
      }
    }
    Router.events.on('routeChangeComplete', onRoute)

    return () => {
      window.removeEventListener('langchange', onLangChange)
      Router.events.off('routeChangeComplete', onRoute)
    }
  }, [])

  return (
    <LangContext.Provider value={{ lang: globalLang, setLang }}>
      <QueryClientProvider client={queryClient}>
        <SeoHead />
        <Component {...pageProps} />
        <AppToaster dir={isRtlLang(globalLang) ? 'rtl' : 'ltr'} />
      </QueryClientProvider>
    </LangContext.Provider>
  )
}
