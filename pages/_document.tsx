import { Html, Head, Main, NextScript } from 'next/document'
import { THEME_INIT_SCRIPT, THEME_COLORS } from '@/hooks/useTheme'
import { LANG_INIT_SCRIPT, DEFAULT_LANG } from '@/lib/i18n'

export default function Document() {
  return (
    // Arabic (RTL) is the default; LANG_INIT_SCRIPT applies the stored language before paint.
    <Html lang={DEFAULT_LANG} dir="rtl" suppressHydrationWarning>
      <Head>
        <meta name="theme-color" content={THEME_COLORS.light} />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon.png" />

        {/* Set language/direction and theme before first paint (no flash). */}
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
