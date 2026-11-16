import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'wabek_theme'
const THEME_EVENT = 'wabek:themechange'

/** Light/dark brand colours for <meta name="theme-color">. */
export const THEME_COLORS: Record<Theme, string> = { light: '#F3F7F6', dark: '#031B1E' }

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Apply a theme to <html>: `.dark` class + data-theme + theme-color meta. */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[theme])
}

/**
 * Inline script for _document: sets the theme before first paint so there is
 * no light flash for dark-mode users.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='dark'&&t!=='light'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var r=document.documentElement;if(t==='dark'){r.classList.add('dark')}r.setAttribute('data-theme',t);r.style.colorScheme=t}catch(e){}})();`

export function useTheme() {
  // Start as 'light' on the server and first client render to avoid a
  // hydration mismatch; the real value is read right after mount.
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    setThemeState(readTheme())
    const onChange = (e: Event) => setThemeState((e as CustomEvent<Theme>).detail)
    window.addEventListener(THEME_EVENT, onChange)
    return () => window.removeEventListener(THEME_EVENT, onChange)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    try { localStorage.setItem(THEME_STORAGE_KEY, next) } catch {}
    applyTheme(next)
    setThemeState(next)
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }))
  }, [])

  const toggle = useCallback(() => setTheme(readTheme() === 'dark' ? 'light' : 'dark'), [setTheme])

  return { theme, setTheme, toggle, isDark: theme === 'dark', isLight: theme === 'light' }
}

export default useTheme
