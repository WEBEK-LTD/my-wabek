import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { safeFetch } from '@/lib/security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body || {}
  if (typeof url !== 'string' || !url) return res.status(400).json({ error: 'URL required' })

  try {
    // Public http(s) hosts only; every redirect hop is re-validated; 8s / 3MB caps.
    const response = await safeFetch(url, {
      headers: { 'User-Agent': 'WABEK-SEO-Analyzer/1.0' },
      timeoutMs: 8000,
      maxBytes: 3 * 1024 * 1024,
    })

    if (response.status < 200 || response.status >= 300) {
      return res.status(200).json({
        score: 0, indexed: false, title: 0, meta: 0, h1: 0, speed: 0, mobile: 0,
        issues: [`Page returned HTTP ${response.status}`],
      })
    }

    const html = response.body.toString('utf8')

    // Analyze HTML
    const hasTitle = /<title[^>]*>([^<]+)<\/title>/i.test(html)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const titleLen = titleMatch ? titleMatch[1].trim().length : 0
    const titleScore = !hasTitle ? 0 : titleLen < 30 ? 50 : titleLen > 60 ? 70 : 100

    const hasMetaDesc = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.test(html) ||
                        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i.test(html)
    const metaDescMatch = html.match(/name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                          html.match(/content=["']([^"']+)["'][^>]*name=["']description["']/i)
    const metaLen = metaDescMatch ? metaDescMatch[1].length : 0
    const metaScore = !hasMetaDesc ? 0 : metaLen < 50 ? 40 : metaLen > 160 ? 70 : 100

    const h1Count = (html.match(/<h1[^>]*>/gi) || []).length
    const h1Score = h1Count === 1 ? 100 : h1Count === 0 ? 0 : 70

    const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html)
    const hasOgTitle = /<meta[^>]+property=["']og:title["']/i.test(html)
    const hasOgDesc = /<meta[^>]+property=["']og:description["']/i.test(html)
    const hasOgImage = /<meta[^>]+property=["']og:image["']/i.test(html)
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html)
    const hasStructuredData = html.includes('application/ld+json')
    const imgWithoutAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length
    const hasH2 = /<h2[^>]*>/i.test(html)

    // Speed estimate (based on content size)
    const sizeKB = Math.round(html.length / 1024)
    const speedScore = sizeKB < 50 ? 100 : sizeKB < 100 ? 85 : sizeKB < 200 ? 70 : 50

    const mobileScore = hasViewport ? 95 : 30

    // Issues
    const issues: string[] = []
    if (!hasTitle) issues.push('Missing <title> tag')
    else if (titleLen < 30) issues.push(`Title too short (${titleLen} chars, aim for 50-60)`)
    else if (titleLen > 60) issues.push(`Title too long (${titleLen} chars, keep under 60)`)
    if (!hasMetaDesc) issues.push('Missing meta description')
    else if (metaLen < 100) issues.push(`Meta description too short (${metaLen} chars, aim for 150-160)`)
    if (h1Count === 0) issues.push('Missing H1 tag')
    if (h1Count > 1) issues.push(`Multiple H1 tags found (${h1Count}), use only one`)
    if (!hasCanonical) issues.push('Missing canonical URL tag')
    if (!hasOgTitle || !hasOgDesc || !hasOgImage) issues.push('Missing Open Graph tags (og:title, og:description, og:image)')
    if (imgWithoutAlt > 0) issues.push(`${imgWithoutAlt} image(s) missing alt text`)
    if (!hasStructuredData) issues.push('No structured data (JSON-LD) found')
    if (!hasH2) issues.push('No H2 subheadings found — add structure to content')
    if (sizeKB > 200) issues.push(`Page size is ${sizeKB}KB — consider optimizing (aim < 100KB)`)

    // Overall score
    const score = Math.round((titleScore + metaScore + h1Score + speedScore + mobileScore) / 5)

    return res.status(200).json({
      score,
      title: titleScore,
      meta: metaScore,
      h1: h1Score,
      speed: speedScore,
      mobile: mobileScore,
      indexed: true,
      titleLen,
      metaLen,
      h1Count,
      sizeKB,
      hasCanonical,
      hasOgImage,
      hasStructuredData,
      imgWithoutAlt,
      issues,
    })

  } catch (err: any) {
    console.error('[seo-analyze] fetch failed:', err?.message)
    return res.status(200).json({
      score: 0, indexed: false, title: 0, meta: 0, h1: 0, speed: 0, mobile: 0,
      issues: ['Failed to fetch page (URL must be a public http(s) address)'],
    })
  }
}
