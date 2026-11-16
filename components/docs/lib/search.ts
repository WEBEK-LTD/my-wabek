import type { SearchEntry } from './types'

/** Lower-case and fold Arabic letter variants and diacritics so "إعداد" finds "اعداد". */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // harakat, superscript alef, tatweel
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A')
    .replace(/[\u200C-\u200F]/g, '')
    .replace(/[^\p{L}\p{N}#/@._-]+/gu, ' ')
    .trim()
}

function tokens(q: string): string[] {
  return normalize(q).split(/\s+/).filter(Boolean)
}

/** Each token may match with or without the Arabic article "ال". */
function variants(token: string): string[] {
  const v = [token]
  if (token.length > 4 && token.startsWith('\u0627\u0644')) v.push(token.slice(2))
  if (token.length > 5 && (token.startsWith('\u0648\u0627\u0644') || token.startsWith('\u0628\u0627\u0644'))) v.push(token.slice(3))
  return v
}

function hasToken(hay: string, token: string): boolean {
  return variants(token).some(v => hay.includes(v))
}

export interface SearchResult {
  slug: string
  /** Heading id when the match is a section of the page. */
  hash: string | null
  title: string
  /** Page title (for heading matches) or section title (for page matches). */
  context: string
  snippet: string
  score: number
}

interface Prepared {
  e: SearchEntry
  t: string
  d: string
  c: string
  h: string[]
}

const preparedCache = new WeakMap<SearchEntry[], Prepared[]>()
function prepare(index: SearchEntry[]): Prepared[] {
  let p = preparedCache.get(index)
  if (!p) {
    p = index.map(e => ({ e, t: normalize(e.t), d: normalize(e.d), c: normalize(e.c), h: e.h.map(([, text]) => normalize(text)) }))
    preparedCache.set(index, p)
  }
  return p
}

export function searchDocs(index: SearchEntry[], query: string, limit = 12): SearchResult[] {
  const q = tokens(query)
  if (!q.length) return []
  const out: SearchResult[] = []

  for (const p of prepare(index)) {
    const all = [p.t, p.d, p.c, ...p.h].join(' \u0000 ')
    if (!q.every(tok => hasToken(all, tok))) continue

    // Page-level match.
    let score = 0
    for (const tok of q) {
      if (hasToken(p.t, tok)) score += p.t.startsWith(variants(tok)[0]) ? 14 : 10
      else if (p.h.some(h => hasToken(h, tok))) score += 5
      else if (hasToken(p.d, tok)) score += 3
      else score += 1
    }
    if (p.t === q.join(' ')) score += 20
    out.push({ slug: p.e.s, hash: null, title: p.e.t, context: p.e.c, snippet: p.e.d, score })

    // Heading-level matches (all tokens inside one heading, or heading + page title).
    p.h.forEach((h, i) => {
      if (!q.every(tok => hasToken(h, tok) || hasToken(p.t, tok))) return
      if (!q.some(tok => hasToken(h, tok))) return
      const [id, text] = p.e.h[i]
      const exact = q.every(tok => hasToken(h, tok))
      out.push({ slug: p.e.s, hash: id, title: text, context: p.e.t, snippet: '', score: (exact ? 8 : 4) + q.length })
    })
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Split text into [plain, match, plain, …] parts for highlighting the query (case/diacritic aware). */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const q = tokens(query).flatMap(variants).filter(t => t.length > 1)
  if (!q.length) return [{ text, match: false }]
  // Map normalized positions back onto the original string character by character.
  const chars = Array.from(text)
  const norm = chars.map(ch => normalize(ch) || (ch.trim() ? '' : ' '))
  const flags = new Array(chars.length).fill(false)
  const joined = norm.join('')
  const starts: number[] = []
  let acc = 0
  for (const n of norm) { starts.push(acc); acc += n.length }
  for (const tok of q) {
    let from = 0
    let at: number
    while ((at = joined.indexOf(tok, from)) >= 0) {
      for (let i = 0; i < chars.length; i++) {
        const s = starts[i]
        const e = s + norm[i].length
        if (norm[i].length && s < at + tok.length && e > at) flags[i] = true
      }
      from = at + tok.length
    }
  }
  // Arabic letters join: highlighting part of a word would break the shaping,
  // so a partly matched Arabic word is highlighted whole.
  let ws = 0
  for (let i = 0; i <= chars.length; i++) {
    if (i === chars.length || /\s/.test(chars[i])) {
      const word = chars.slice(ws, i)
      if (word.some(c => /[\u0600-\u06FF]/.test(c)) && flags.slice(ws, i).some(Boolean)) {
        for (let k = ws; k < i; k++) flags[k] = true
      }
      ws = i + 1
    }
  }
  const parts: { text: string; match: boolean }[] = []
  chars.forEach((ch, i) => {
    const last = parts[parts.length - 1]
    if (last && last.match === flags[i]) last.text += ch
    else parts.push({ text: ch, match: flags[i] })
  })
  return parts
}
