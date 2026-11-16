// Server-only: reads content/docs/**/*.md and turns it into sanitized HTML,
// a table of contents and a search index. Imported from getStaticProps only.
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import { toString as hastToString } from 'hast-util-to-string'
import type { Root, Element, ElementContent, RootContent, Text } from 'hast'
import {
  manifest, allDocSlugs, docsHref, sectionTitle, pageTitle,
  type DocsLang, type ManifestPage, type ManifestSection,
} from './manifest'
import { docsStrings } from './strings'
import type {
  DocPageData, DocPageProps, DocsHomeProps, NavSection, PagerLink, SearchEntry, TocItem,
} from './types'

const CONTENT_DIR = path.join(process.cwd(), 'content', 'docs')

// ── Manifest lookups ─────────────────────────────────────────────

function findPage(slug: string): { section: ManifestSection; page: ManifestPage; index: number } | null {
  const flat = manifest.sections.flatMap(section => section.pages.map(page => ({ section, page })))
  const index = flat.findIndex(x => x.page.slug === slug)
  return index < 0 ? null : { ...flat[index], index }
}

export function getDocsNav(lang: DocsLang): NavSection[] {
  return manifest.sections.map(s => ({
    id: s.id,
    title: sectionTitle(s, lang),
    pages: s.pages.map(p => ({ slug: p.slug, title: pageTitle(p, lang) })),
  }))
}

export function getDocsStaticPaths(): { params: { slug: string[] } }[] {
  return allDocSlugs().map(slug => ({ params: { slug: slug.split('/') } }))
}

// ── Markdown → HTML ──────────────────────────────────────────────

type Parent = Root | Element
const el = (tagName: string, properties: Element['properties'] = {}, children: ElementContent[] = []): Element =>
  ({ type: 'element', tagName, properties, children })
const txt = (value: string): Text => ({ type: 'text', value })
const isEl = (n: RootContent | ElementContent | undefined, tag?: string): n is Element =>
  !!n && n.type === 'element' && (!tag || n.tagName === tag)
const isBlank = (n: RootContent | ElementContent) => n.type === 'text' && !n.value.trim()
const classList = (n: Element): string[] => {
  const c = n.properties?.className
  return Array.isArray(c) ? c.map(String) : c ? String(c).split(' ') : []
}

function walk(node: Parent, fn: (node: Element, parent: Parent, index: number) => void) {
  // Iterate over a snapshot so callbacks may replace the current child.
  node.children.forEach((child, i) => {
    if (child.type !== 'element') return
    fn(child, node, i)
    const current = node.children[i]
    if (isEl(current)) walk(current, fn)
  })
}

// Callout markers accepted in the Markdown sources (Arabic and English docs):
// ملاحظة / نصيحة = note, تحذير / مهم = warning. Written as escapes because
// they are syntax keywords, not UI text.
const CALLOUTS: Record<string, 'note' | 'warning'> = {
  '\u0645\u0644\u0627\u062D\u0638\u0629': 'note', 'note': 'note', 'tip': 'note', '\u0646\u0635\u064A\u062D\u0629': 'note', 'info': 'note',
  '\u062A\u062D\u0630\u064A\u0631': 'warning', 'warning': 'warning', 'important': 'warning', '\u0645\u0647\u0645': 'warning', 'caution': 'warning',
}

const LANG_LABELS: Record<string, string> = {
  bash: 'Shell', sh: 'Shell', shell: 'Shell', javascript: 'JavaScript', js: 'JavaScript', typescript: 'TypeScript',
  ts: 'TypeScript', php: 'PHP', python: 'Python', py: 'Python', json: 'JSON', csv: 'CSV', markdown: 'Markdown',
}
/** Languages that form tabbed example groups when their blocks are consecutive. */
const TAB_LANGS = new Set(['bash', 'sh', 'shell', 'curl', 'javascript', 'js', 'typescript', 'ts', 'php', 'python', 'py'])

const ENDPOINT_RE = /^(GET|POST|PUT|PATCH|DELETE)(?:\/(GET|POST|PUT|PATCH|DELETE))*\s+(\/\S*)$/

interface RenderResult {
  html: string
  toc: TocItem[]
}

function codeInfo(pre: Element): { code: Element | null; lang: string; text: string } {
  const code = pre.children.find((c): c is Element => isEl(c, 'code')) || null
  const cls = code ? classList(code).find(c => c.startsWith('language-')) : undefined
  const lang = cls ? cls.slice('language-'.length).toLowerCase() : ''
  return { code, lang, text: code ? hastToString(code) : hastToString(pre) }
}

function tabKey(lang: string, text: string): string {
  if ((lang === 'bash' || lang === 'sh' || lang === 'shell') && /^\s*curl\b/m.test(text)) return 'curl'
  if (lang === 'js') return 'javascript'
  if (lang === 'py') return 'python'
  if (lang === 'ts') return 'typescript'
  return lang
}
function tabLabel(key: string): string {
  return key === 'curl' ? 'cURL' : LANG_LABELS[key] || key.toUpperCase()
}

function copyButton(lang: DocsLang): Element {
  const s = docsStrings(lang)
  return el('button', { type: 'button', className: ['doc-copy'], dataCopy: '', ariaLabel: s.copyCode }, [
    el('span', { className: ['doc-copy-icon'], ariaHidden: 'true' }),
    el('span', { className: ['doc-copy-label'], dataLabel: s.copy, dataDone: s.copied }, [txt(s.copy)]),
  ])
}

function preparePre(pre: Element, lang: string) {
  pre.properties = { ...pre.properties, dir: lang ? 'ltr' : 'auto', tabIndex: 0 }
}

function codeBlock(pre: Element, lang: DocsLang): Element {
  const info = codeInfo(pre)
  const key = tabKey(info.lang, info.text)
  preparePre(pre, info.lang)

  // Single-line "METHOD /path" blocks render as an endpoint bar.
  const line = info.text.trim()
  const ep = !info.lang && !line.includes('\n') ? ENDPOINT_RE.exec(line) : null
  if (ep) {
    const method = line.split(/\s+/)[0]
    return el('div', { className: ['doc-endpoint'], dir: 'ltr' }, [
      el('span', { className: ['doc-method', `doc-method--${method.split('/')[0].toLowerCase()}`] }, [txt(method)]),
      el('code', { className: ['doc-endpoint-path'] }, [txt(ep[3])]),
      copyButton(lang),
      el('pre', { hidden: true, ariaHidden: 'true' }, [el('code', {}, [txt(line)])]),
    ])
  }

  return el('div', { className: ['doc-code'], dataLang: key || 'text' }, [
    el('div', { className: ['doc-code-head'] }, [
      el('span', { className: ['doc-code-lang'] }, [txt(key ? tabLabel(key) : '')]),
      copyButton(lang),
    ]),
    pre,
  ])
}

let groupCounter = 0
function codeGroup(pres: Element[], lang: DocsLang): Element {
  const s = docsStrings(lang)
  const gid = `cg${++groupCounter}`
  const tabs: Element[] = []
  const panels: Element[] = []
  pres.forEach((pre, i) => {
    const info = codeInfo(pre)
    const key = tabKey(info.lang, info.text)
    preparePre(pre, info.lang)
    const tabId = `${gid}-t${i}`
    const panelId = `${gid}-p${i}`
    tabs.push(el('button', {
      type: 'button', role: 'tab', id: tabId, ariaControls: [panelId], ariaSelected: i === 0 ? 'true' : 'false',
      tabIndex: i === 0 ? 0 : -1, className: ['doc-tab'], dataTab: key,
    }, [txt(tabLabel(key))]))
    panels.push(el('div', {
      role: 'tabpanel', id: panelId, ariaLabelledBy: [tabId], className: ['doc-tabpanel'], dataPanel: key,
      ...(i === 0 ? {} : { hidden: true }),
    }, [pre]))
  })
  return el('div', { className: ['doc-code', 'doc-code--tabs'], dataTabs: '' }, [
    el('div', { className: ['doc-code-head'] }, [
      el('div', { role: 'tablist', ariaLabel: s.codeExamples, className: ['doc-tablist'], dir: 'ltr' }, tabs),
      copyButton(lang),
    ]),
    ...panels,
  ])
}

/** Wrap code blocks; consecutive cURL/JS/PHP/Python blocks become one tabbed group. */
function transformCode(parent: Parent, lang: DocsLang) {
  const out: (RootContent | ElementContent)[] = []
  const kids = parent.children as (RootContent | ElementContent)[]
  for (let i = 0; i < kids.length; i++) {
    const node = kids[i]
    if (!isEl(node, 'pre')) {
      if (isEl(node)) transformCode(node, lang)
      out.push(node)
      continue
    }
    // Collect a run of consecutive <pre> siblings (ignoring whitespace between them).
    const run: Element[] = [node]
    let j = i + 1
    while (j < kids.length) {
      const k = kids[j]
      if (isBlank(k)) { j++; continue }
      if (isEl(k, 'pre')) { run.push(k); j++; continue }
      break
    }
    let r = 0
    while (r < run.length) {
      const key = tabKey(codeInfo(run[r]).lang, codeInfo(run[r]).text)
      if (TAB_LANGS.has(codeInfo(run[r]).lang)) {
        const group: Element[] = [run[r]]
        const seen = new Set([key])
        let q = r + 1
        while (q < run.length) {
          const qi = codeInfo(run[q])
          const qk = tabKey(qi.lang, qi.text)
          if (!TAB_LANGS.has(qi.lang) || seen.has(qk)) break
          seen.add(qk); group.push(run[q]); q++
        }
        if (group.length > 1) { out.push(codeGroup(group, lang)); r = q; continue }
      }
      out.push(codeBlock(run[r], lang))
      r++
    }
    // Drop the whitespace consumed inside the run; keep a trailing newline for readability.
    out.push(txt('\n'))
    i = j - 1
  }
  parent.children = out as typeof parent.children
}

function transformTree(tree: Root, lang: DocsLang, toc: TocItem[], knownSlugs: Set<string>, file: string) {
  const s = docsStrings(lang)
  groupCounter = 0

  // 1. The page title is rendered by the layout: drop the leading <h1>.
  const firstH1 = tree.children.findIndex(n => isEl(n, 'h1'))
  if (firstH1 >= 0) tree.children.splice(firstH1, 1)

  walk(tree, (node, parent, index) => {
    // 2. Headings: table of contents + anchor link.
    if ((node.tagName === 'h2' || node.tagName === 'h3') && node.properties?.id) {
      const id = String(node.properties.id)
      const text = hastToString(node).trim()
      toc.push({ id, text, depth: node.tagName === 'h2' ? 2 : 3 })
      node.properties.className = ['doc-heading']
      node.children.push(el('a', { href: `#${id}`, className: ['doc-anchor'], ariaLabel: `${s.anchor}: ${text}` }, [
        el('span', { ariaHidden: 'true' }, [txt('#')]),
      ]))
    }

    // 3. Callouts: > **ملاحظة:** / > **Note:** …
    if (node.tagName === 'blockquote') {
      const firstP = node.children.find((c): c is Element => isEl(c))
      const strong = firstP && firstP.tagName === 'p' ? firstP.children.find(c => !isBlank(c)) : undefined
      if (firstP && isEl(strong, 'strong')) {
        const label = hastToString(strong).trim().replace(/[:：]\s*$/, '').trim()
        const kind = CALLOUTS[label.toLowerCase()]
        if (kind) {
          const at = firstP.children.indexOf(strong)
          firstP.children.splice(at, 1)
          const nextText = firstP.children[at]
          if (nextText && nextText.type === 'text') nextText.value = nextText.value.replace(/^\s*[:：]?\s*/, '')
          if (!firstP.children.some(c => !isBlank(c))) node.children.splice(node.children.indexOf(firstP), 1)
          parent.children[index] = el('aside', { className: ['doc-callout', `doc-callout--${kind}`], ariaLabel: label }, [
            el('span', { className: ['doc-callout-icon'], ariaHidden: 'true' }),
            el('div', { className: ['doc-callout-body'] }, [
              el('p', { className: ['doc-callout-title'] }, [txt(label)]),
              ...node.children,
            ]),
          ])
        }
      }
    }

    // 4. Links: /docs/<slug> follows the reader's language; external links open in a new tab.
    if (node.tagName === 'a' && typeof node.properties?.href === 'string') {
      const href = node.properties.href
      const m = /^\/docs(?:\/([^#?]*))?(#.*)?$/.exec(href)
      if (m) {
        const slug = (m[1] || '').replace(/\/+$/, '')
        if (slug && !knownSlugs.has(slug)) console.warn(`[docs] ${file}: link to unknown page ${href}`)
        node.properties.href = docsHref(lang, slug || null) + (m[2] || '')
      } else if (/^https?:\/\//i.test(href)) {
        node.properties.target = '_blank'
        node.properties.rel = ['noopener', 'noreferrer']
        node.properties.className = ['doc-ext']
      }
    }

    // 5. Inline code stays left-to-right inside Arabic text.
    if (node.tagName === 'code' && !isEl(parent as Element, 'pre')) {
      node.properties = { ...node.properties, dir: 'ltr' }
    }

    // 6. Tables scroll horizontally on small screens.
    if (node.tagName === 'table' && !(isEl(parent as Element, 'div') && classList(parent as Element).includes('doc-table'))) {
      parent.children[index] = el('div', { className: ['doc-table'], tabIndex: 0, role: 'region', ariaLabel: 'table' }, [node])
    }
  })

  // Table region label: use the preceding heading text when there is one.
  let lastHeading = ''
  walk(tree, node => {
    if (node.tagName === 'h2' || node.tagName === 'h3') lastHeading = hastToString(node).replace(/#$/, '').trim()
    if (node.tagName === 'div' && classList(node).includes('doc-table')) node.properties.ariaLabel = lastHeading || s.docs
  })

  // 7. Code blocks and tab groups (after links so code is not touched above).
  transformCode(tree, lang)
}

export function renderMarkdown(markdown: string, lang: DocsLang, file = 'inline'): RenderResult {
  const toc: TocItem[] = []
  const knownSlugs = new Set(allDocSlugs())
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    // Raw HTML (including <!-- comments -->) is dropped here: allowDangerousHtml is off.
    .use(remarkRehype)
    // Sanitize everything that came from Markdown before adding our own trusted markup.
    .use(rehypeSanitize)
    .use(rehypeHighlight, { plainText: ['csv', 'text', 'txt', 'plain'] })
    .use(rehypeSlug)
    .use(() => (tree: Root) => transformTree(tree, lang, toc, knownSlugs, file))
    .use(rehypeStringify)
  const html = String(processor.processSync(markdown))
  return { html, toc }
}

// ── Pages ────────────────────────────────────────────────────────

interface LoadedPage extends DocPageData {
  headings: [string, string][]
}

const cache = new Map<string, { mtime: number; page: LoadedPage }>()

function loadPage(lang: DocsLang, slug: string): LoadedPage | null {
  const found = findPage(slug)
  if (!found) return null
  const rel = lang === 'en' ? found.page.file_en : found.page.file_ar
  const file = path.join(CONTENT_DIR, rel)
  // Keep reads inside the content folder.
  if (!file.startsWith(CONTENT_DIR + path.sep) || !fs.existsSync(file)) return null
  const mtime = fs.statSync(file).mtimeMs
  const key = `${lang}:${slug}`
  const hit = cache.get(key)
  if (hit && hit.mtime === mtime) return hit.page

  const { data, content } = matter(fs.readFileSync(file, 'utf8'))
  const { html, toc } = renderMarkdown(content, lang, rel)
  const page: LoadedPage = {
    slug,
    title: String(data.title || pageTitle(found.page, lang)),
    description: String(data.description || ''),
    sectionId: found.section.id,
    sectionTitle: sectionTitle(found.section, lang),
    html,
    toc,
    headings: toc.map(t => [t.id, t.text]),
  }
  cache.set(key, { mtime, page })
  return page
}

export function getSearchIndex(lang: DocsLang): SearchEntry[] {
  const out: SearchEntry[] = []
  for (const slug of allDocSlugs()) {
    const p = loadPage(lang, slug)
    if (p) out.push({ s: p.slug, t: p.title, d: p.description, c: p.sectionTitle, h: p.headings })
  }
  return out
}

function pagerLink(index: number, lang: DocsLang): PagerLink | null {
  const flat = manifest.sections.flatMap(section => section.pages.map(page => ({ section, page })))
  const x = flat[index]
  return x ? { slug: x.page.slug, title: pageTitle(x.page, lang), section: sectionTitle(x.section, lang) } : null
}

export function getDocPageProps(lang: DocsLang, slug: string): DocPageProps | null {
  const found = findPage(slug)
  const loaded = loadPage(lang, slug)
  if (!found || !loaded) return null
  const { headings: _h, ...page } = loaded
  return {
    lang,
    nav: getDocsNav(lang),
    search: getSearchIndex(lang),
    page,
    prev: pagerLink(found.index - 1, lang),
    next: pagerLink(found.index + 1, lang),
  }
}

const HOME_SAMPLE = [
  '```bash',
  'curl -X POST https://waabek.com/api/v1/send \\',
  '  -H "X-API-Key: $WABEK_API_KEY" \\',
  '  -H "Content-Type: application/json" \\',
  `  -d '{`,
  '    "to": "966500000000",',
  '    "message": "Your order #1042 has shipped."',
  `  }'`,
  '```',
].join('\n')

export function getDocsHomeProps(lang: DocsLang): DocsHomeProps {
  const nav = getDocsNav(lang)
  // Only the highlighted <pre>; the hero draws its own frame around it.
  const sample = renderMarkdown(HOME_SAMPLE, lang, 'home-sample').html
  const pre = /<pre[\s\S]*<\/pre>/.exec(sample)?.[0] || ''
  return {
    lang,
    nav,
    search: getSearchIndex(lang),
    sections: nav.map(s => ({ ...s, firstSlug: s.pages[0]?.slug || '' })),
    sampleHtml: pre,
  }
}
