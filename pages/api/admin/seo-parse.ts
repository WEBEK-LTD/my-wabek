import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { safeFetch } from '@/lib/security'

interface ParseResult {
  path: string
  title: string
  titleLen: number
  metaDescription: string
  metaLen: number
  h1: string[]
  h2: string[]
  h3: string[]
  wordCount: number
  text: string
  links: { href: string; text: string; isInternal: boolean; isExternal: boolean }[]
  images: { src: string; alt: string; hasAlt: boolean }[]
  keywords: Record<string, number>
  readabilityScore: number
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 2).length
}

function extractText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function calcReadability(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)
  const words = text.split(/\s+/).filter(w => w.length > 0)
  if (sentences.length === 0 || words.length === 0) return 50
  const avgWordsPerSentence = words.length / sentences.length
  const avgSyllables = words.reduce((sum, w) => sum + Math.max(1, Math.round(w.length / 3)), 0) / words.length
  // Flesch Reading Ease approximation
  const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllables)
  return Math.min(100, Math.max(0, Math.round(score)))
}

function calcKeywordDensity(text: string, topN = 20): Record<string, number> {
  const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','was','are','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','that','this','these','those','it','its','i','you','he','she','we','they','my','your','his','her','our','their','what','which','who','when','where','how','not','no','yes','all','any','some','more','most','other','than','then','so','if','as'])
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w))
  const freq: Record<string, number> = {}
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
  const total = words.length
  const sorted = Object.entries(freq).sort(([,a],[,b]) => b - a).slice(0, topN)
  const result: Record<string, number> = {}
  sorted.forEach(([w, count]) => { result[w] = parseFloat((count / total * 100).toFixed(2)) })
  return result
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body || {}
  if (typeof url !== 'string' || !url) return res.status(400).json({ error: 'url required' })

  try {
    // Public http(s) hosts only; every redirect hop is re-validated; 10s / 3MB caps.
    const response = await safeFetch(url, {
      headers: { 'User-Agent': 'WABEK-SEO-Parser/1.0' },
      timeoutMs: 10000,
      maxBytes: 3 * 1024 * 1024,
    })

    if (response.status < 200 || response.status >= 300) {
      return res.status(200).json({ error: `HTTP ${response.status}`, path: url })
    }

    const html = response.body.toString('utf8')
    const path = new URL(url).pathname

    // Title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''

    // Meta description
    const metaMatch = html.match(/name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/content=["']([^"']+)["'][^>]*name=["']description["']/i)
    const metaDescription = metaMatch ? metaMatch[1].trim() : ''

    // Headings
    const h1 = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gis)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean)
    const h2 = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gis)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean)
    const h3 = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/gis)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean)

    // Links
    const linkMatches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis)]
    const baseHost = new URL(url).hostname
    const links = linkMatches.map(m => {
      const href = m[1].trim()
      const text = m[2].replace(/<[^>]+>/g, '').trim()
      const isInternal = href.startsWith('/') || href.includes(baseHost)
      const isExternal = href.startsWith('http') && !href.includes(baseHost)
      return { href, text, isInternal, isExternal }
    }).filter(l => l.href && !l.href.startsWith('#') && !l.href.startsWith('mailto:') && !l.href.startsWith('javascript:'))

    // Images
    const imgMatches = [...html.matchAll(/<img([^>]+)>/gi)]
    const images = imgMatches.map(m => {
      const attrs = m[1]
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i)
      const altMatch = attrs.match(/alt=["']([^"']*)["']/i)
      return {
        src: srcMatch ? srcMatch[1] : '',
        alt: altMatch ? altMatch[1] : '',
        hasAlt: !!altMatch && altMatch[1].trim().length > 0,
      }
    }).filter(img => img.src)

    // Text content
    const text = extractText(html)
    const wordCount = countWords(text)
    const keywords = calcKeywordDensity(text)
    const readabilityScore = calcReadability(text)

    const result: ParseResult = {
      path,
      title,
      titleLen: title.length,
      metaDescription,
      metaLen: metaDescription.length,
      h1, h2, h3,
      wordCount,
      text: text.slice(0, 500),
      links,
      images,
      keywords,
      readabilityScore,
    }

    return res.status(200).json(result)
  } catch (err: any) {
    console.error('[seo-parse] fetch failed:', err?.message)
    return res.status(200).json({ error: 'Failed to fetch page (URL must be a public http(s) address)', path: url })
  }
}
