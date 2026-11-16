import Document, { Html, Head, Main, NextScript, type DocumentContext, type DocumentInitialProps } from 'next/document'
import { THEME_INIT_SCRIPT, THEME_COLORS } from '@/hooks/useTheme'
import { LANG_INIT_SCRIPT, LANG_PENDING_CSS, DEFAULT_LANG, LANG_COOKIE, routeLang, translations } from '@/lib/i18n'

interface Props extends DocumentInitialProps {
  lang: string
  dir: 'rtl' | 'ltr'
  /** The route fixes the language (/en/… docs, /docs): the client script must not override it. */
  fixed: boolean
}

function cookieLang(header: string | undefined): string | null {
  if (!header) return null
  const m = header.match(new RegExp('(?:^|;\\s*)' + LANG_COOKIE + '=([a-z]{2})'))
  return m && translations[m[1]] ? m[1] : null
}

export default class AppDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext): Promise<Props> {
    const initial = await Document.getInitialProps(ctx)
    const fromRoute = routeLang(ctx.asPath || ctx.pathname)
    // Otherwise: the language cookie (mirrors the stored choice), else Arabic.
    const lang = fromRoute || cookieLang(ctx.req?.headers?.cookie) || DEFAULT_LANG
    return { ...initial, lang, dir: lang === 'ar' ? 'rtl' : 'ltr', fixed: !!fromRoute }
  }

  render() {
    const { lang = DEFAULT_LANG, dir = 'rtl', fixed = false } = this.props
    return (
      // LANG_INIT_SCRIPT applies the stored language before paint unless the route fixes it.
      <Html lang={lang} dir={dir} data-lang-fixed={fixed ? '' : undefined} suppressHydrationWarning>
        <Head>
          <meta name="theme-color" content={THEME_COLORS.light} />
          <meta name="color-scheme" content="light dark" />
          <link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon.png" />

          {/* Set language/direction and theme before first paint (no flash). */}
          <style dangerouslySetInnerHTML={{ __html: LANG_PENDING_CSS }} />
          <script dangerouslySetInnerHTML={{ __html: LANG_INIT_SCRIPT + THEME_INIT_SCRIPT }} />

          {/* Readex Pro (Arabic + Latin) for UI, Fira Code for code blocks */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap"
            rel="stylesheet"
          />

          {/* Service Worker for Push Notifications */}
          <script dangerouslySetInnerHTML={{ __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function() {});
              });
            }
          `}} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
