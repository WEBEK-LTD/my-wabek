import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { cn } from '@/components/ui/utils'
import styles from './docs.module.css'
import type { DocsLang } from './lib/manifest'
import { docsStrings } from './lib/strings'

const TAB_STORAGE_KEY = 'wabek_docs_code_lang'

function readTabPref(): string | null {
  try { return localStorage.getItem(TAB_STORAGE_KEY) } catch { return null }
}
function writeTabPref(v: string) {
  try { localStorage.setItem(TAB_STORAGE_KEY, v) } catch {}
}

/** Activate the tab with data-tab=key in one group. Returns false when the group has no such tab. */
function selectTab(group: HTMLElement, key: string, focus = false): boolean {
  const tabs = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  const target = tabs.find(t => t.dataset.tab === key)
  if (!target) return false
  tabs.forEach(t => {
    const on = t === target
    t.setAttribute('aria-selected', on ? 'true' : 'false')
    t.tabIndex = on ? 0 : -1
    const panel = group.querySelector<HTMLElement>(`#${CSS.escape(t.getAttribute('aria-controls') || '')}`)
    if (panel) panel.hidden = !on
  })
  if (focus) target.focus()
  return true
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers without the async clipboard (or without permission).
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch {}
    ta.remove()
    return ok
  }
}

/**
 * Renders the build-time, sanitized HTML of a docs page and wires its
 * interactive bits with event delegation: copy buttons, code tabs (synced
 * across the page and remembered), and client-side navigation for internal links.
 */
export default function DocContent({ html, lang, className }: { html: string; lang: DocsLang; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [announce, setAnnounce] = useState('')
  const s = docsStrings(lang)

  // Restore the preferred example language.
  useEffect(() => {
    const root = ref.current
    const pref = readTabPref()
    if (!root || !pref) return
    root.querySelectorAll<HTMLElement>('[data-tabs]').forEach(g => selectTab(g, pref))
  }, [html])

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const onClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement

      const copyBtn = target.closest<HTMLButtonElement>('[data-copy]')
      if (copyBtn && root.contains(copyBtn)) {
        const block = copyBtn.closest<HTMLElement>('.doc-code, .doc-endpoint')
        const pre = block?.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden]) pre') || block?.querySelector<HTMLElement>('pre')
        const text = (pre?.textContent || '').replace(/\n$/, '')
        if (await copyText(text)) {
          const label = copyBtn.querySelector<HTMLElement>('.doc-copy-label')
          copyBtn.dataset.copied = 'true'
          if (label) label.textContent = label.dataset.done || s.copied
          setAnnounce('')
          window.setTimeout(() => setAnnounce(s.copiedAnnounce), 10)
          window.setTimeout(() => {
            delete copyBtn.dataset.copied
            if (label) label.textContent = label.dataset.label || s.copy
          }, 1800)
        }
        return
      }

      const tab = target.closest<HTMLButtonElement>('[role="tab"]')
      if (tab && root.contains(tab)) {
        const key = tab.dataset.tab || ''
        // Keep the clicked tab in view while every group on the page switches.
        const top = tab.getBoundingClientRect().top
        root.querySelectorAll<HTMLElement>('[data-tabs]').forEach(g => selectTab(g, key))
        window.scrollBy({ top: tab.getBoundingClientRect().top - top })
        writeTabPref(key)
        return
      }

      // Internal links: client-side navigation (keeps the shell mounted).
      const a = target.closest<HTMLAnchorElement>('a[href]')
      if (a && root.contains(a) && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !a.target) {
        const href = a.getAttribute('href') || ''
        if (href.startsWith('/') && !href.startsWith('//')) {
          e.preventDefault()
          router.push(href)
        }
      }
    }

    const onKey = (e: KeyboardEvent) => {
      const tab = (e.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]')
      if (!tab || !root.contains(tab)) return
      const group = tab.closest<HTMLElement>('[data-tabs]')
      if (!group) return
      const tabs = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      const i = tabs.indexOf(tab)
      // Tab lists are laid out left-to-right (code languages), so arrows follow the screen.
      let n = -1
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length
      else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length
      else if (e.key === 'Home') n = 0
      else if (e.key === 'End') n = tabs.length - 1
      if (n < 0) return
      e.preventDefault()
      const key = tabs[n].dataset.tab || ''
      root.querySelectorAll<HTMLElement>('[data-tabs]').forEach(g => selectTab(g, key, g === group))
      writeTabPref(key)
    }

    root.addEventListener('click', onClick)
    root.addEventListener('keydown', onKey)
    return () => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('keydown', onKey)
    }
  }, [router, s.copied, s.copy, s.copiedAnnounce])

  return (
    <>
      <div
        ref={ref}
        className={cn(styles.prose, className)}
        // Build-time HTML from repo Markdown, passed through rehype-sanitize (see lib/content.server.ts).
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <span className="sr-only" role="status" aria-live="polite">{announce}</span>
    </>
  )
}
