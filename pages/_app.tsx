import Head from 'next/head'
import { useEffect, useState, createContext } from 'react'
import Router from 'next/router'

export const LangContext = createContext<{lang:string;setLang:(l:string)=>void}>({lang:'en',setLang:()=>{}})

const LOGO = 'https://res.cloudinary.com/dkl7ntpgw/image/upload/f_auto,q_auto/%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86_1_kejdrs'

// Admin-configured values that end up inside <script> tags.
const safeGaId = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9-]{1,40}$/.test(v) ? v : '')
const safeJsonLd = (v: unknown) => (typeof v === 'string' ? v.replace(/</g, '\\u003c') : '')

function SeoHead() {
  const [seo, setSeo] = useState<any>({})
  const [brand, setBrand] = useState<any>({})
  const [webmaster, setWebmaster] = useState<any>({})
  useEffect(() => {
    fetch('/api/admin/seo')
      .then(r => r.json())
      .then(d => { setSeo(d.seo || {}); setBrand(d.brand || {}); if (d.webmaster) setWebmaster(d.webmaster) })
      .catch(() => {})
  }, [])

  const siteTitle = seo.site_title || brand.app_name || 'WABEK'
  const favicon = brand.favicon_url || seo.favicon_url || LOGO
  const titleTemplate = seo.title_template || '%page% | ' + siteTitle

  if (typeof window !== 'undefined') {
    ;(window as any).__WABEK_TITLE_TEMPLATE__ = titleTemplate
    ;(window as any).__WABEK_SITE_TITLE__ = siteTitle
    ;(window as any).__WABEK_LOGO__ = brand.logo_url || LOGO
  }

  return (
    <Head>
      <title>{siteTitle}</title>
      {seo.site_description && <meta name="description" content={seo.site_description} />}
      {seo.canonical && <link rel="canonical" href={seo.canonical} />}
      {seo.og_image && <meta property="og:image" content={seo.og_image} />}
      <link rel="icon" href={favicon} />
      <link rel="shortcut icon" href={favicon} />
      <link rel="apple-touch-icon" href={favicon} />
      {safeGaId(seo.ga_id) && <script async src={"https://www.googletagmanager.com/gtag/js?id=" + safeGaId(seo.ga_id)} />}
      {safeGaId(seo.ga_id) && <script dangerouslySetInnerHTML={{ __html: "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','" + safeGaId(seo.ga_id) + "')" }} />}
      {webmaster.google_site_verification && <meta name="google-site-verification" content={webmaster.google_site_verification} />}
      {webmaster.bing_site_verification && <meta name="msvalidate.01" content={webmaster.bing_site_verification} />}
      <meta name="p:domain_verify" content="67f0db54e40ee97b1eeb7675f199e477" />
      {seo.schema_organization && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(seo.schema_organization) }} />}
      {seo.schema_website && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(seo.schema_website) }} />}
    </Head>
  )
}

import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import '@/styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

export default function App({ Component, pageProps }: AppProps) {
  const [globalLang, setGlobalLang] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en'
  )

  const setLang = (l: string) => {
    setGlobalLang(l)
    if (typeof window !== 'undefined') {
      localStorage.setItem('lang', l)
      window.dispatchEvent(new CustomEvent('langchange', { detail: l }))
    }
  }

  useEffect(() => {
    // Sync lang from localStorage on mount
    const stored = localStorage.getItem('lang') || 'en'
    if (stored !== globalLang) setGlobalLang(stored)

    // Listen for changes
    const onLangChange = (e: any) => {
      setGlobalLang(e.detail)
      localStorage.setItem('lang', e.detail)
    }
    window.addEventListener('langchange', onLangChange)

    // On route change: fire langchange so new page gets current lang
    const onRoute = () => {
      const lang = localStorage.getItem('lang') || 'en'
      window.dispatchEvent(new CustomEvent('langchange', { detail: lang }))
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
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#F8FAFC', color: '#0F172A', border: '1px solid #1F2937', borderRadius: '10px', fontSize: '14px' },
            success: { iconTheme: { primary: '#00D46A', secondary: '#fff' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
          }}
        />
      </QueryClientProvider>
    </LangContext.Provider>
  )
}
