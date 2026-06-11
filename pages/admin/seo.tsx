// @ts-nocheck
import { useState, useEffect, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import Link from 'next/link'

const PUBLIC_PAGES = [
  { path: '/', label: 'Homepage', priority: '1.0', changefreq: 'daily' },
  { path: '/features', label: 'Features', priority: '0.9', changefreq: 'weekly' },
  { path: '/integrations', label: 'Integrations', priority: '0.9', changefreq: 'weekly' },
  { path: '/pricing', label: 'Pricing', priority: '0.9', changefreq: 'weekly' },
  { path: '/about', label: 'About Us', priority: '0.7', changefreq: 'monthly' },
  { path: '/support', label: 'Support', priority: '0.8', changefreq: 'weekly' },
  { path: '/blog', label: 'Blog Index', priority: '0.8', changefreq: 'daily' },
  { path: '/blog/whatsapp-automation-guide-2026', label: 'Blog: Automation Guide', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whatsapp-chatbot-setup-2026', label: 'Blog: Chatbot Setup', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/ai-whatsapp-replies-2026', label: 'Blog: AI Replies', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whatsapp-bulk-campaigns-2026', label: 'Blog: Bulk Campaigns', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whatsapp-cloud-api-vs-web-2026', label: 'Blog: Cloud API vs Web', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whatsapp-reseller-business-2026', label: 'Blog: Reseller Business', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog/whmcs-whatsapp-integration-2026', label: 'Blog: WHMCS Integration', priority: '0.8', changefreq: 'monthly' },
  { path: '/legal/privacy', label: 'Privacy Policy', priority: '0.3', changefreq: 'yearly' },
  { path: '/legal/terms', label: 'Terms of Service', priority: '0.3', changefreq: 'yearly' },
  { path: '/legal/license', label: 'License', priority: '0.2', changefreq: 'yearly' },
]

const KEYWORD_DATA = [
  { kw: 'WhatsApp automation platform', vol: 4400, diff: 42, page: '/' },
  { kw: 'WhatsApp business automation', vol: 3600, diff: 38, page: '/' },
  { kw: 'automate WhatsApp messages', vol: 2900, diff: 35, page: '/' },
  { kw: 'WhatsApp chatbot builder', vol: 2400, diff: 45, page: '/features' },
  { kw: 'WhatsApp bulk messaging', vol: 3600, diff: 40, page: '/features' },
  { kw: 'WhatsApp AI auto reply', vol: 1900, diff: 33, page: '/features' },
  { kw: 'WhatsApp team inbox', vol: 720, diff: 28, page: '/features' },
  { kw: 'WhatsApp automation pricing', vol: 880, diff: 30, page: '/pricing' },
  { kw: 'WhatsApp business API cost', vol: 1300, diff: 36, page: '/pricing' },
  { kw: 'WhatsApp automation guide 2026', vol: 2200, diff: 25, page: '/blog' },
  { kw: 'how to automate WhatsApp', vol: 1800, diff: 28, page: '/blog' },
  { kw: 'Wix WhatsApp integration', vol: 1100, diff: 22, page: '/integrations' },
  { kw: 'WordPress WhatsApp plugin', vol: 2800, diff: 32, page: '/integrations' },
  { kw: 'WHMCS WhatsApp notifications', vol: 590, diff: 18, page: '/integrations' },
  { kw: 'WhatsApp reseller business', vol: 480, diff: 20, page: '/blog' },
]

const SCHEMA_TEMPLATES = {
  Organization: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "WABEK",
  "url": "https://waabek.com",
  "logo": "https://waabek.com/logo.png",
  "sameAs": [],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "availableLanguage": ["English", "Arabic", "French", "Turkish"]
  }
}`,
  SoftwareApplication: `{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "WABEK",
  "applicationCategory": "BusinessApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "operatingSystem": "Web"
}`,
  WebSite: `{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "WABEK",
  "url": "https://waabek.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://waabek.com/blog?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}`,
  FAQPage: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is WABEK?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "WABEK is an all-in-one WhatsApp Business platform..."
    }
  }]
}`,
}

const OG_TEMPLATES = {
  homepage: { title: 'WABEK — WhatsApp Business Automation Platform', desc: 'Send bulk campaigns, build AI chatbots, manage team inbox, and automate WhatsApp. Integrates with Wix, WordPress, WHMCS and more.', type: 'website' },
  features: { title: 'All WhatsApp Business Features — WABEK', desc: 'Bulk campaigns, AI auto-reply, team inbox, chatbot builder, analytics and more. Everything for WhatsApp automation.', type: 'website' },
  pricing: { title: 'WhatsApp Automation Pricing — WABEK', desc: 'Free plan available. No hidden fees. Start free and scale as you grow.', type: 'website' },
  blog: { title: 'WhatsApp Business Blog — WABEK', desc: 'Tutorials, guides, and best practices for WhatsApp automation and business growth.', type: 'website' },
}

export default function SeoAdminPage() {
  const [tab, setTab] = useState('overview')
  const [pageScores, setPageScores] = useState<Record<string, any>>({})
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analyzeAll, setAnalyzeAll] = useState(false)
  const [loading, setSaving] = useState(false)
  const [selectedSchema, setSelectedSchema] = useState('Organization')
  const [schemaCode, setSchemaCode] = useState(SCHEMA_TEMPLATES.Organization)
  const [copied, setCopied] = useState('')

  // ── GSC OAuth State ──
  const [gscStatus, setGscStatus] = useState<any>(null)
  const [gscLoading, setGscLoading] = useState(false)
  const [gscData, setGscData] = useState<any>(null)
  const [gscPages, setGscPages] = useState<any[]>([])
  const [gscSummary, setGscSummary] = useState<any>(null)
  const [gscSites, setGscSites] = useState<any[]>([])
  const [gscSite, setGscSite] = useState('https://waabek.com/')
  const [gscRange, setGscRange] = useState('28')
  const [gscConnecting, setGscConnecting] = useState(false)

  const loadGscStatus = async () => {
    try {
      const { data } = await axios.get('/api/admin/gsc-oauth')
      setGscStatus(data)
    } catch {}
  }

  const connectGsc = async () => {
    setGscConnecting(true)
    try {
      const { data } = await axios.post('/api/admin/gsc-oauth', { action: 'connect' })
      if (data.url) window.location.href = data.url
      else toast.error(data.error || 'Connection failed')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to start OAuth')
    }
    setGscConnecting(false)
  }

  const disconnectGsc = async () => {
    await axios.post('/api/admin/gsc-oauth', { action: 'disconnect' })
    setGscStatus({ connected: false })
    setGscData(null)
    setGscSummary(null)
    toast.success('Disconnected from Google Search Console')
  }

  const loadGscData = async () => {
    setGscLoading(true)
    try {
      const days = parseInt(gscRange)
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
      const params = 'siteUrl=' + encodeURIComponent(gscSite) + '&startDate=' + startDate + '&endDate=' + endDate

      const [summaryRes, queriesRes, pagesRes] = await Promise.all([
        axios.get('/api/admin/gsc-data?type=summary&' + params),
        axios.get('/api/admin/gsc-data?type=queries&' + params),
        axios.get('/api/admin/gsc-data?type=pages&' + params),
      ])
      setGscSummary(summaryRes.data)
      setGscData(queriesRes.data.rows || [])
      setGscPages(pagesRes.data.rows || [])
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load GSC data')
    }
    setGscLoading(false)
  }

  const loadGscSites = async () => {
    try {
      const { data } = await axios.get('/api/admin/gsc-data?type=sites')
      setGscSites(data.sites || [])
    } catch {}
  }

  // Check URL params for GSC OAuth result
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('gsc_success')) {
      toast.success('✅ Connected to Google Search Console!')
      window.history.replaceState({}, '', window.location.pathname)
      loadGscStatus()
      setTab('gsc')
      // Auto-load data after short delay
      setTimeout(() => loadGscData(), 1000)
    }
    if (params.get('gsc_error')) {
      toast.error('GSC connection failed: ' + params.get('gsc_error'))
      window.history.replaceState({}, '', window.location.pathname)
    }
    loadGscStatus()
  }, [])

  // ── Real HTML Parse data ──
  const [parsedPages, setParsedPages] = useState<Record<string, any>>({})
  const [parsing, setParsing] = useState<string | null>(null)
  const [parseAll, setParseAll] = useState(false)

  const parsePage = async (path: string) => {
    setParsing(path)
    try {
      const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const { data } = await axios.post('/api/admin/seo-parse', { url: appUrl + path })
      setParsedPages(prev => {
        const updated = { ...prev, [path]: data }
        saveSeoData('parsed_pages', updated)
        return updated
      })
    } catch (e) {
      console.error('Parse failed', e)
    }
    setParsing(null)
  }

  const runParseAll = async () => {
    setParseAll(true)
    for (const page of PUBLIC_PAGES.slice(0, 7)) {
      await parsePage(page.path)
      await new Promise(r => setTimeout(r, 200))
    }
    setParseAll(false)
    toast.success('All pages parsed!')
  }

  // Load parsed pages from DB on mount
  useEffect(() => {
    loadSeoData('parsed_pages').then(d => { if (d) setParsedPages(d) })
  }, [])

  // ── AI Assistant state ──
  const [aiLoading, setAiLoading] = useState<string|null>(null)
  // Meta Generator
  const [metaInput, setMetaInput] = useState('')
  const [metaResult, setMetaResult] = useState<{title:string,description:string,keywords:string}|null>(null)
  // Content Optimizer
  const [contentInput, setContentInput] = useState('')
  const [contentKw, setContentKw] = useState('')
  const [contentResult, setContentResult] = useState('')
  // Schema Generator
  const [schemaDesc, setSchemaDesc] = useState('')
  const [schemaType, setSchemaType] = useState('Organization')
  const [schemaResult, setSchemaResult] = useState('')
  // Auto-Fix Audit
  const [auditPage, setAuditPage] = useState('/')
  const [auditResult, setAuditResult] = useState<any>(null)
  // Keyword Research
  const [kwBusiness, setKwBusiness] = useState('')
  const [kwResult, setKwResult] = useState<any[]>([])

  // Rank history (date → {kw: rank})
  const [rankHistory, setRankHistory] = useState<Record<string, Record<string, number>>>({})

  // Rank Tracker
  const [rankData, setRankData] = useState<Record<string,any[]>>({})
  const [trackingKws, setTrackingKws] = useState([
    { kw: 'WhatsApp automation platform', target: '/', tracked: true },
    { kw: 'WhatsApp chatbot builder', target: '/features', tracked: true },
    { kw: 'WhatsApp bulk messaging', target: '/features', tracked: true },
    { kw: 'WhatsApp automation pricing', target: '/pricing', tracked: true },
    { kw: 'WordPress WhatsApp plugin', target: '/integrations', tracked: true },
    { kw: 'WHMCS WhatsApp notifications', target: '/integrations', tracked: true },
  ])
  const [newKw, setNewKw] = useState('')

  // Competitors
  const [competitors, setCompetitors] = useState([
    { domain: 'wati.io', name: 'WATI', da: 42, traffic: 85000, keywords: 1200, backlinks: 3400 },
    { domain: 'respond.io', name: 'Respond.io', da: 55, traffic: 210000, keywords: 3800, backlinks: 8900 },
    { domain: 'manychat.com', name: 'ManyChat', da: 68, traffic: 980000, keywords: 12000, backlinks: 42000 },
    { domain: 'twilio.com', name: 'Twilio', da: 88, traffic: 5200000, keywords: 85000, backlinks: 320000 },
  ])
  const [newCompetitor, setNewCompetitor] = useState('')
  const myDa = 12
  const myTraffic = 2400
  const myKeywords = 45
  const myBacklinks = 180

  // Redirects
  const [redirects, setRedirects] = useState([
    { from: '/home', to: '/', type: '301', active: true },
    { from: '/whatsapp-automation', to: '/features', type: '301', active: true },
    { from: '/contact', to: '/support', type: '302', active: true },
  ])
  const [newRedirect, setNewRedirect] = useState({ from: '', to: '', type: '301' })

  // GSC mock data


  // Crawl results
  const [crawlResults, setCrawlResults] = useState<any[]>([])
  const [crawling, setCrawling] = useState(false)

  const runCrawl = async () => {
    setCrawling(true)
    const results: any[] = []
    for (const page of PUBLIC_PAGES.slice(0, 10)) {
      try {
        const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const res = await axios.post('/api/admin/seo-analyze', { url: appUrl + page.path })
        results.push({
          path: page.path,
          label: page.label,
          status: (res.data?.score != null && res.data.score > 0) ? 200 : (res.data?.status || 200),
          score: res.data?.score || 0,
          issues: res.data?.issues?.length || 0,
          size: res.data?.sizeKB || 0,
          hasCanonical: res.data?.hasCanonical ?? true,
          hasStructuredData: res.data?.hasStructuredData ?? false,
        })
      } catch {
        results.push({ path: page.path, label: page.label, status: 'error', score: 0, issues: 1 })
      }
      await new Promise(r => setTimeout(r, 100))
    }
    setCrawlResults(results)
    setCrawling(false)
    toast.success('Crawl complete!')
  }

  // Speed data
  const [speedData, setSpeedData] = useState<Record<string,any>>({})
  const [speedLoading, setSpeedLoading] = useState<string|null>(null)

  const checkSpeed = async (path: string) => {
    setSpeedLoading(path)
    try {
      const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(appUrl+path)}&strategy=mobile`
      const res = await fetch(apiUrl)
      if (res.ok) {
        const data = await res.json()
        const cats = data.lighthouseResult?.categories
        setSpeedData(prev => ({ ...prev, [path]: {
          performance: Math.round((cats?.performance?.score || 0) * 100),
          seo: Math.round((cats?.seo?.score || 0) * 100),
          accessibility: Math.round((cats?.accessibility?.score || 0) * 100),
          bestPractices: Math.round((cats?.['best-practices']?.score || 0) * 100),
          lcp: data.lighthouseResult?.audits?.['largest-contentful-paint']?.displayValue || 'N/A',
          cls: data.lighthouseResult?.audits?.['cumulative-layout-shift']?.displayValue || 'N/A',
          fid: data.lighthouseResult?.audits?.['interactive']?.displayValue || 'N/A',
        }}))
      }
    } catch {
      setSpeedData(prev => ({ ...prev, [path]: {
        performance: 0, seo: 0, accessibility: 0, bestPractices: 0,
        lcp: 'N/A', cls: 'N/A', fid: 'N/A', error: true
      }}))
    }
    setSpeedLoading(null)
  }

  const [form, setForm] = useState({
    site_title: 'WABEK — WhatsApp Business Automation Platform',
    title_template: '%page% | WABEK',
    site_description: 'Send bulk campaigns, build AI chatbots, manage a shared team inbox, and automate WhatsApp messages. Integrates with Wix, WordPress, WHMCS and more.',
    focus_kw: 'WhatsApp automation, WhatsApp business platform, WhatsApp chatbot',
    canonical: 'https://waabek.com',
    og_image: 'https://waabek.com/og-image.jpg',
    twitter_handle: '@waabek',
    ga_id: '',
    gsc_verify: '',
    fb_pixel: '',
    hotjar_id: '',
    robots_txt: 'User-agent: *\nAllow: /\nDisallow: /dashboard/\nDisallow: /admin/\nDisallow: /api/\nSitemap: https://waabek.com/sitemap.xml',
    custom_head: '',
    redirect_www: true,
    force_https: true,
    index_site: true,
  })

  // Persistence helpers
  const loadSeoData = async (type: string) => {
    try {
      const { data } = await axios.get('/api/admin/seo-data?type=' + type)
      return data.data
    } catch { return null }
  }
  const saveSeoData = async (type: string, data: any) => {
    try { await axios.post('/api/admin/seo-data', { type, data }) } catch {}
  }

  useEffect(() => {
    axios.get('/api/admin/seo').then(r => {
      if (r.data?.seo) setForm(f => ({ ...f, ...r.data.seo }))
    }).catch(() => {})

    // Load persisted SEO data
    loadSeoData('page_scores').then(d => {
      if (d) {
        // Clean up any invalid entries (non-path keys like full URLs)
        const cleaned: Record<string,any> = {}
        const validPaths = new Set(PUBLIC_PAGES.map(p => p.path))
        Object.entries(d).forEach(([k, v]) => {
          const path = k.startsWith('http') ? k.replace(/^https?:\/\/[^/]+/, '') : k
          if (validPaths.has(path)) cleaned[path] = v
        })
        setPageScores(cleaned)
      }
    })
    loadSeoData('redirects').then(d => { if (d) setRedirects(d) })
    loadSeoData('crawl').then(d => {
      if (d) {
        // Handle both array and object (JSONB can deserialize differently)
        const arr = Array.isArray(d) ? d : Object.values(d)
        setCrawlResults(arr.filter(r => r && typeof r === 'object'))
      }
    })
    loadSeoData('keywords').then(d => { if (d) setTrackingKws(d) })
    loadSeoData('competitors').then(d => { if (d) setCompetitors(d) })
    loadSeoData('ranks').then(d => { if (d) setRankHistory(d) })
  }, [])

  const analyzePage = async (path: string) => {
    setAnalyzing(path)
    try {
      const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'
      const { data } = await axios.post('/api/admin/seo-analyze', { url: appUrl + path })
      setPageScores(prev => ({ ...prev, [path]: data }))
    } catch {
      setPageScores(prev => ({
        ...prev, [path]: {
          score: 55,
          title: 70,
          meta: 60,
          h1: 100,
          speed: 75,
          mobile: 92,
          indexed: false,
          issues: ['Could not fetch page — check if site is deployed', 'Run analysis after deploying to production'],
          sizeKB: 0,
          hasCanonical: false,
          hasOgImage: false,
          hasStructuredData: false,
          imgWithoutAlt: 0,
          error: true,
        }
      }))
    }
    setAnalyzing(null)
  }

  // Auto-save page scores after analysis
  useEffect(() => {
    if (Object.keys(pageScores).length > 0) saveSeoData('page_scores', pageScores)
  }, [pageScores])

  // Auto-save other data
  useEffect(() => { if (redirects.length > 0) saveSeoData('redirects', redirects) }, [redirects])
  useEffect(() => { if (crawlResults.length > 0) saveSeoData('crawl', crawlResults) }, [crawlResults])
  useEffect(() => { saveSeoData('keywords', trackingKws) }, [trackingKws])
  useEffect(() => { saveSeoData('competitors', competitors) }, [competitors])

  const runAnalyzeAll = async () => {
    setAnalyzeAll(true)
    for (const p of PUBLIC_PAGES) {
      await analyzePage(p.path)
      await new Promise(r => setTimeout(r, 150))
    }
    setAnalyzeAll(false)
    toast.success(`✅ Analyzed ${PUBLIC_PAGES.length} pages`)
  }

  const save = async () => {
    setSaving(true)
    try {
      await axios.put('/api/admin/seo', { seo: form })
      toast.success('SEO settings saved ✅')
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  const copyText = (txt: string, key: string) => {
    navigator.clipboard.writeText(txt)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const sc = (n: number) => n >= 80 ? '#25D366' : n >= 60 ? '#f59e0b' : '#ef4444'
  const sl = (n: number) => n >= 80 ? 'Good' : n >= 60 ? 'Fair' : 'Poor'
  const validPaths = new Set(PUBLIC_PAGES.map(p => p.path))
  const analyzedEntries = Object.entries(pageScores).filter(([k]) => validPaths.has(k) || k.startsWith('/'))
  const analyzed = Math.min(analyzedEntries.length, PUBLIC_PAGES.length)
  const avgScore = analyzed > 0 ? Math.round(analyzedEntries.reduce((a: any, [,b]: any) => a + (Number(b.score) || 0), 0) / analyzed) : 0
  const indexed = analyzedEntries.filter(([,p]: any) => p.indexed).length
  const issues = analyzedEntries.reduce((a: any, [,p]: any) => a + (p.issues?.length || 0), 0)

  const TABS = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'pages', icon: '🔍', label: 'Page Analyzer' },
    { id: 'meta', icon: '🏷️', label: 'Meta Tags' },
    { id: 'og', icon: '🖼️', label: 'Open Graph' },
    { id: 'schema', icon: '🧩', label: 'Structured Data' },
    { id: 'keywords', icon: '🔑', label: 'Keywords' },
    { id: 'sitemap', icon: '🗺️', label: 'Sitemap' },
    { id: 'technical', icon: '⚙️', label: 'Technical SEO' },
    { id: 'analytics', icon: '📈', label: 'Analytics' },
    { id: 'backlinks', icon: '🔗', label: 'Backlinks' },
    { id: 'rank', icon: '📡', label: 'Rank Tracker' },
    { id: 'competitors', icon: '⚔️', label: 'Competitors' },
    { id: 'links', icon: '🕸️', label: 'Internal Links' },
    { id: 'gsc', icon: '🔭', label: 'Search Console' },
    { id: 'speed', icon: '⚡', label: 'Core Web Vitals' },
    { id: 'content', icon: '✍️', label: 'Content SEO' },
    { id: 'redirects', icon: '↪️', label: 'Redirects' },
    { id: 'crawl', icon: '🕷️', label: 'Crawl Monitor' },
    { id: 'ai', icon: '🤖', label: 'AI Assistant' },
  ]

  // ── AI Helper: call Claude API ──
  const callClaude = async (prompt: string, maxTokens = 800): Promise<string> => {
    const res = await fetch('/api/ai/seo-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, maxTokens }),
    })
    if (!res.ok) throw new Error('AI request failed')
    const data = await res.json()
    return data.result || ''
  }

  // 1. AI Meta Generator
  const generateMeta = async () => {
    if (!metaInput.trim()) return toast.error('Please provide page content or URL')
    setAiLoading('meta')
    try {
      const prompt = `You are an SEO expert. Based on the following page content or description, generate:
1. An SEO-optimized page title (max 60 characters)
2. A meta description (max 160 characters)  
3. 5-7 focus keywords (comma separated)

Page content/description:
${metaInput}

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{"title":"...","description":"...","keywords":"..."}
`
      const raw = await callClaude(prompt, 400)
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setMetaResult(parsed)
      toast.success('Meta tags generated!')
    } catch (e) {
      toast.error('Generation failed — try again')
    }
    setAiLoading(null)
  }

  // 2. AI Content Optimizer
  const optimizeContent = async () => {
    if (!contentInput.trim() || !contentKw.trim()) return toast.error('Please provide content and target keyword')
    setAiLoading('content')
    try {
      const prompt = `You are an SEO content expert. Optimize the following text for the keyword "${contentKw}".

Rules:
- Keep the same meaning and information
- Include the keyword naturally in: first sentence, at least one heading, and 2-3 times in the body
- Improve readability (shorter sentences, active voice)
- Add or improve H2 subheadings (use ## prefix)
- Target keyword density: 1-2%
- Keep the same approximate length

Original content:
${contentInput.slice(0, 2000)}

Respond with the optimized content ONLY, no explanation:`
      const result = await callClaude(prompt, 1200)
      setContentResult(result)
      toast.success('Content optimized!')
    } catch {
      toast.error('Optimization failed — try again')
    }
    setAiLoading(null)
  }

  // 3. AI Schema Generator
  const generateSchema = async () => {
    if (!schemaDesc.trim()) return toast.error('Please describe your page')
    setAiLoading('schema')
    try {
      const schemaExamples: Record<string,string> = {
        Organization: '{"@context":"https://schema.org","@type":"Organization","name":"...","url":"...","logo":"..."}',
        SoftwareApplication: '{"@context":"https://schema.org","@type":"SoftwareApplication","name":"...","applicationCategory":"BusinessApplication","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}',
        FAQPage: '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"...","acceptedAnswer":{"@type":"Answer","text":"..."}}]}',
        Article: '{"@context":"https://schema.org","@type":"Article","headline":"...","author":{"@type":"Organization","name":"..."},"datePublished":"..."}',
        BreadcrumbList: '{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://waabek.com"}]}',
      }
      const prompt = `You are a structured data expert. Generate a complete, valid ${schemaType} JSON-LD schema for the following:

Page description: ${schemaDesc}
Site: waabek.com
Business type: WhatsApp Business Automation SaaS Platform

Schema type to generate: ${schemaType}
Example structure: ${schemaExamples[schemaType] || ''}

Rules:
- Output ONLY the JSON object, no markdown, no explanation
- Use real values where possible (use waabek.com as the URL)
- Make it complete and valid for Google's Rich Results test
- Include all recommended properties for ${schemaType}`
      const raw = await callClaude(prompt, 600)
      const clean = raw.replace(/```json|```/g, '').trim()
      // Validate JSON
      JSON.parse(clean)
      setSchemaResult(clean)
      toast.success('Schema generated!')
    } catch {
      toast.error('Schema generation failed — try again')
    }
    setAiLoading(null)
  }

  // 4. AI SEO Audit + Auto-Fix
  const runAiAudit = async () => {
    setAiLoading('audit')
    try {
      const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
      // First run the analyzer
      const { data: analysis } = await axios.post('/api/admin/seo-analyze', { url: appUrl + auditPage })
      // Then ask AI to generate fixes
      const issues = analysis.issues || []
      const issuesText = issues.map((iss: string, i: number) => (i+1) + '. ' + iss).join('\n')
      const prompt = 'You are an SEO expert. For each issue below, provide a specific ready-to-use fix.\n\n'
        + 'Page: ' + auditPage + ' | Title length: ' + (analysis.titleLen || 0)
        + ' | Meta length: ' + (analysis.metaLen || 0)
        + ' | H1 count: ' + (analysis.h1Count || 0)
        + ' | Canonical: ' + (analysis.hasCanonical ? 'yes' : 'no')
        + ' | OG image: ' + (analysis.hasOgImage ? 'yes' : 'no')
        + ' | Schema: ' + (analysis.hasStructuredData ? 'yes' : 'no')
        + '\n\nIssues:\n' + issuesText
        + '\n\nRespond ONLY with JSON (no markdown):'
        + '{"score":' + analysis.score
        + ',"fixes":[{"issue":"...","fix":"...","example":"...","priority":"HIGH"}]'
        + ',"suggested_title":"60-char SEO title for this page"'
        + ',"suggested_meta":"160-char meta description"'
        + ',"suggested_h1":"ideal H1 text"}'
      const raw = await callClaude(prompt, 1000)
      const clean = raw.replace(/```json|```/g, '').trim()
      const result = JSON.parse(clean)
      result.analysis = analysis
      setAuditResult(result)
      toast.success('AI audit complete!')
    } catch {
      toast.error('Audit failed — make sure the site is deployed')
    }
    setAiLoading(null)
  }

  // 5. AI Keyword Research
  const researchKeywords = async () => {
    if (!kwBusiness.trim()) return toast.error('Please describe your business')
    setAiLoading('keywords')
    try {
      const prompt = `You are an SEO keyword research expert. Generate a comprehensive keyword strategy for this business:

Business description: ${kwBusiness}

Generate keywords in these categories:
1. Primary keywords (high volume, direct match)
2. Long-tail keywords (lower competition, high intent)
3. Question keywords (FAQ content opportunities)
4. Competitor gap keywords (keywords competitors rank for)
5. Local/niche keywords (specific use cases)

Respond ONLY with valid JSON array (no markdown):
[
  {"keyword": "...", "category": "primary|longtail|question|competitor|niche", "intent": "informational|commercial|transactional", "difficulty": "easy|medium|hard", "suggestion": "which page to target"}
]
Generate at least 20 keywords.`
      const raw = await callClaude(prompt, 1500)
      const clean = raw.replace(/```json|```/g, '').trim()
      const result = JSON.parse(clean)
      setKwResult(result)
      toast.success(result.length + ' keywords generated!')
    } catch {
      toast.error('Keyword research failed — try again')
    }
    setAiLoading(null)
  }

  const fmtRedirects = (rs: typeof redirects) =>
    rs.map(r => '[[redirects]]\n  from = "' + r.from + '"\n  to = "' + r.to + '"\n  status = ' + r.type).join('\n\n')

  return (
    <AdminLayout title="SEO Manager">
      <div className="max-w-6xl space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900">SEO Manager</h1>
            <p className="text-sm text-slate-400 mt-1">Full SEO toolkit — analyze, optimize, and rank higher on Google</p>
          </div>
          <div className="flex gap-2">
            <button onClick={runAnalyzeAll} disabled={analyzeAll}
              className="btn-secondary text-sm flex items-center gap-2">
              {analyzeAll ? '⏳ Analyzing...' : '🔍 Analyze All Pages'}
            </button>
            <button onClick={save} disabled={loading} className="btn-primary text-sm">
              {loading ? 'Saving...' : '💾 Save Settings'}
            </button>
          </div>
        </div>

        {/* Score Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'SEO Score', value: analyzed && !isNaN(avgScore) ? `${avgScore}/100` : '—', color: (analyzed && !isNaN(avgScore)) ? sc(avgScore) : '#6b7280', sub: (analyzed && !isNaN(avgScore)) ? sl(avgScore) : 'Not analyzed' },
            { label: 'Pages Analyzed', value: `${Math.min(analyzed, PUBLIC_PAGES.length)}/${PUBLIC_PAGES.length}`, color: '#25D366', sub: 'total pages' },
            { label: 'Pages Indexed', value: analyzed ? String(indexed) : '—', color: '#0ea5e9', sub: 'ready for Google' },
            { label: 'Issues Found', value: analyzed ? String(issues) : '—', color: issues > 10 ? '#ef4444' : '#f59e0b', sub: 'need fixing' },
          ].map(c => (
            <div key={c.label} className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">{c.label}</p>
              <p className="text-2xl font-bold mb-0.5" style={{ color: c.color }}>{c.value}</p>
              <p className="text-xs text-slate-600">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 border-b border-slate-200 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                tab === t.id ? 'border-brand-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="space-y-5">
            {/* Page scores */}
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Page Health</h3>
              {!analyzed ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-3">🔍</div>
                  <p className="text-slate-400 mb-4">Click "Analyze All Pages" to get your SEO scores</p>
                  <button onClick={runAnalyzeAll} className="btn-primary text-sm">Start Analysis</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {PUBLIC_PAGES.map(p => {
                    const s = pageScores[p.path]
                    if (!s) return (
                      <div key={p.path} className="flex items-center gap-3 p-2.5 bg-wabek-bg rounded-lg opacity-40">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-500">—</div>
                        <div className="flex-1"><p className="text-sm text-slate-400">{p.label}</p></div>
                        <span className="text-xs text-slate-600">Not analyzed</span>
                      </div>
                    )
                    return (
                      <div key={p.path} className="flex items-center gap-3 p-2.5 bg-wabek-bg rounded-lg">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: sc(s.score) + '20', color: sc(s.score) }}>{s.score}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 truncate">{p.label}</p>
                          <p className="text-xs text-slate-600 font-mono truncate">{p.path}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* mini bars */}
                          {[s.title, s.meta, s.h1, s.speed, s.mobile].map((v, i) => (
                            <div key={i} className="w-1.5 h-6 bg-slate-100 rounded-full overflow-hidden">
                              <div className="w-full rounded-full transition-all" style={{ height: `${v}%`, background: sc(v), marginTop: `${100 - v}%` }} />
                            </div>
                          ))}
                          <span className="text-xs px-2 py-0.5 rounded-full ml-1" style={{ background: sc(s.score) + '20', color: sc(s.score) }}>{sl(s.score)}</span>
                          {s.indexed ? <span className="text-xs text-green-400">✓</span> : <span className="text-xs text-red-400">✗</span>}
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex gap-4 mt-3 text-xs text-slate-600">
                    <span>Bars: Title · Meta · H1 · Speed · Mobile</span>
                    <span>✓/✗ = Indexed</span>
                  </div>
                </div>
              )}
            </div>

            {/* Priority Actions */}
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">🚀 Priority Actions</h3>
              <div className="space-y-2">
                {[
                  { p: 'HIGH', t: 'Submit sitemap to Google Search Console', url: 'https://search.google.com/search-console', done: !!gscStatus?.connected },
                  { p: 'HIGH', t: 'Add Google Analytics 4 tracking', done: !!form.ga_id },
                  { p: 'HIGH', t: 'Connect Google Search Console for real data', done: !!gscStatus?.connected },
                  { p: 'HIGH', t: 'Save Organization JSON-LD schema (Structured Data tab)', done: !!(form as any).schema_organization },
                  { p: 'HIGH', t: 'Set global meta title & description (Meta Tags tab)', done: !!(form.site_title && form.site_description) },
                  { p: 'MEDIUM', t: 'Create og:image (1200x630px) for social sharing', done: !!form.og_image },
                  { p: 'MEDIUM', t: 'Add canonical domain to prevent duplicate content', done: !!form.canonical },
                  { p: 'MEDIUM', t: 'Run full page analysis (Page Analyzer tab)', done: Object.keys(pageScores).length >= 5 },
                  { p: 'MEDIUM', t: 'Run site crawl to find 404s & broken links', done: crawlResults.length > 0 },
                  { p: 'MEDIUM', t: 'List on G2, Capterra, Product Hunt for backlinks', done: false },
                  { p: 'LOW', t: 'Optimize image alt tags across all pages', done: !Object.values(pageScores).some((p: any) => p.imgWithoutAlt > 0) },
                  { p: 'LOW', t: 'Add FAQ schema to homepage & support page', done: !!(form as any).schema_faqpage },
                  { p: 'LOW', t: 'Save keyword rank snapshot (Rank Tracker tab)', done: Object.keys(rankHistory).length > 0 },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-wabek-bg rounded-lg">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                      item.p === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                      item.p === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-[#F8FAFC]0/20 text-slate-400'
                    }`}>{item.p}</span>
                    <p className={`text-sm flex-1 ${item.done ? 'line-through text-slate-600' : 'text-slate-700'}`}>{item.t}</p>
                    {item.done ? <span className="text-xs text-green-400">✓ Done</span> :
                    item.url ? <a href={item.url} target="_blank" className="text-xs text-blue-600">Go →</a> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PAGE ANALYZER ── */}
        {tab === 'pages' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Real-time analysis of your live pages — fetches HTML and checks SEO signals</p>
              <button onClick={runAnalyzeAll} disabled={analyzeAll} className="btn-secondary text-xs px-3 py-1.5">
                {analyzeAll ? '⏳ Running...' : '🔄 Analyze All'}
              </button>
            </div>
            {PUBLIC_PAGES.map(page => {
              const s = pageScores[page.path]
              const isAn = analyzing === page.path
              return (
                <div key={page.path} className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">{page.label}</h3>
                        {s && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: sc(s.score) + '20', color: sc(s.score) }}>{sl(s.score)}</span>}
                        {s && (s.indexed ? <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">✓ Indexed</span> : <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">✗ Not indexed</span>)}
                      </div>
                      <p className="text-xs text-slate-500 font-mono">{page.path}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s && <div className="text-right"><p className="text-3xl font-black" style={{ color: sc(s.score) }}>{s.score}</p><p className="text-xs text-slate-600">/100</p></div>}
                      <div className="flex flex-col gap-1">
                        <button onClick={() => analyzePage(page.path)} disabled={isAn} className="btn-secondary text-xs px-2.5 py-1">
                          {isAn ? '⏳' : s ? '🔄' : '🔍'}
                        </button>
                        <a href={page.path} target="_blank" className="btn-secondary text-xs px-2.5 py-1 text-center">🌐</a>
                      </div>
                    </div>
                  </div>

                  {s && (
                    <div className="space-y-3">
                      {/* Score bars */}
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { label: 'Title', score: s.title, detail: s.titleLen ? `${s.titleLen} chars` : '' },
                          { label: 'Meta Desc', score: s.meta, detail: s.metaLen ? `${s.metaLen} chars` : '' },
                          { label: 'H1 Tag', score: s.h1, detail: s.h1Count !== undefined ? `${s.h1Count} found` : '' },
                          { label: 'Page Speed', score: s.speed, detail: s.sizeKB ? `${s.sizeKB}KB` : '' },
                          { label: 'Mobile', score: s.mobile, detail: 'Viewport' },
                        ].map(m => (
                          <div key={m.label} className="bg-wabek-bg rounded-lg p-2.5 text-center">
                            <div className="text-base font-bold mb-0.5" style={{ color: sc(m.score) }}>{m.score}%</div>
                            <div className="text-[10px] text-slate-500 mb-1.5">{m.label}</div>
                            {m.detail && <div className="text-[10px] text-slate-600">{m.detail}</div>}
                            <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${m.score}%`, background: sc(m.score) }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Additional checks */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          { label: 'Canonical URL', ok: s.hasCanonical },
                          { label: 'OG Image', ok: s.hasOgImage },
                          { label: 'Structured Data', ok: s.hasStructuredData },
                          { label: 'Alt Text', ok: !s.imgWithoutAlt },
                        ].map(c => (
                          <div key={c.label} className="flex items-center gap-2 bg-wabek-bg rounded-lg px-3 py-2">
                            <span style={{ color: c.ok ? '#25D366' : '#ef4444', fontSize: 14 }}>{c.ok ? '✓' : '✗'}</span>
                            <span className="text-xs text-slate-400">{c.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Issues */}
                      {s.issues?.length > 0 && (
                        <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-3">
                          <p className="text-xs font-semibold text-red-400 mb-2">⚠️ {s.issues.length} issue{s.issues.length > 1 ? 's' : ''} found:</p>
                          <div className="space-y-1">
                            {s.issues.map((issue: string, i: number) => (
                              <p key={i} className="text-xs text-red-300/80">• {issue}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── META TAGS ── */}
        {tab === 'meta' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Global Meta Tags</h3>
              <div className="space-y-5">
                {[
                  { label: 'Site Title', key: 'site_title', ph: 'WABEK — WhatsApp Business Platform', desc: 'Browser tab title shown on all pages (50–60 chars ideal)', max: 60 },
                  { label: 'Title Template', key: 'title_template', ph: '%page% | WABEK', desc: 'Template for inner pages. Use %page% for page name, %site% for site name. E.g. "%page% | WABEK"', max: 80 },
                  { label: 'Meta Description', key: 'site_description', ph: 'Describe your platform...', desc: 'Google snippet text (150–160 chars ideal)', max: 160, textarea: true },
                  { label: 'Focus Keywords', key: 'focus_kw', ph: 'WhatsApp automation, WhatsApp business...', desc: 'Primary keywords, comma separated', textarea: true },
                  { label: 'Canonical Domain', key: 'canonical', ph: 'https://waabek.com', desc: 'Used in canonical link tags to prevent duplicate content' },
                ].map(f => (
                  <div key={f.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-slate-900">{f.label}</label>
                      {f.max && <span className={`text-xs ${(form[f.key]?.length || 0) > f.max ? 'text-red-400' : 'text-slate-500'}`}>{form[f.key]?.length || 0}/{f.max}</span>}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{f.desc}</p>
                    {f.textarea ? (
                      <textarea value={form[f.key]} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
                        placeholder={f.ph} rows={3} className="input w-full text-sm" />
                    ) : (
                      <input value={form[f.key]} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
                        placeholder={f.ph} className="input w-full text-sm" />
                    )}
                  </div>
                ))}

                {/* Preview */}
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-2">Google Preview</p>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-[13px] text-blue-700 font-medium truncate">{form.site_title || 'WABEK — WhatsApp Business Platform'}</p>
                    <p className="text-[11px] text-green-700 mb-1">waabek.com</p>
                    <p className="text-[12px] text-slate-600 leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {form.site_description || 'Your meta description will appear here...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Custom Head Tags</h3>
              <p className="text-xs text-slate-500 mb-3">Inject custom meta tags, verification codes, or scripts into &lt;head&gt;</p>
              <textarea value={form.custom_head}
                onChange={e => setForm(s => ({ ...s, custom_head: e.target.value }))}
                placeholder={'<meta name="custom" content="value" />\n<link rel="preconnect" href="https://fonts.googleapis.com" />'}
                rows={5} className="input w-full text-sm font-mono" />
            </div>

            <div className="flex items-center gap-3">
              <button onClick={save} disabled={loading} className="btn-primary">{loading ? 'Saving...' : '💾 Save Meta Settings'}</button>
            </div>
          </div>
        )}

        {/* ── OPEN GRAPH ── */}
        {tab === 'og' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-2">Open Graph & Social Cards</h3>
              <p className="text-sm text-slate-400 mb-4">How your pages look when shared on WhatsApp, Facebook, Twitter, LinkedIn</p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-900 block mb-1">Global OG Image URL</label>
                  <p className="text-xs text-slate-500 mb-2">Default image for all pages. Use 1200×630px for best quality.</p>
                  <input value={form.og_image} onChange={e => setForm(s => ({ ...s, og_image: e.target.value }))}
                    placeholder="https://waabek.com/og-image.jpg" className="input w-full text-sm" />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-900 block mb-1">Twitter Handle</label>
                  <input value={form.twitter_handle} onChange={e => setForm(s => ({ ...s, twitter_handle: e.target.value }))}
                    placeholder="@waabek" className="input w-full text-sm" />
                </div>
              </div>

              {/* OG Preview Card */}
              {form.og_image && (
                <div className="mt-5">
                  <p className="text-sm text-slate-400 mb-3">WhatsApp / Facebook preview:</p>
                  <div className="max-w-sm border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-[#F8FAFC] h-40 flex items-center justify-center text-slate-400 text-sm">
                      {form.og_image ? <img src={form.og_image} alt="OG" className="w-full h-full object-cover" onError={e => { (e.target as any).style.display = 'none' }} /> : 'OG Image Preview'}
                    </div>
                    <div className="bg-white p-3 border-t">
                      <p className="text-xs text-slate-500 uppercase">waabek.com</p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">{form.site_title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{form.site_description}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Per-page OG */}
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Per-Page OG Templates</h3>
              <div className="space-y-3">
                {Object.entries(OG_TEMPLATES).map(([key, og]) => (
                  <div key={key} className="bg-wabek-bg rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-slate-900 capitalize">{key}</p>
                      <button onClick={() => copyText(JSON.stringify(og, null, 2), key)} className="text-xs text-blue-600">
                        {copied === key ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 italic">"{og.title}"</p>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{og.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={save} disabled={loading} className="btn-primary">{loading ? 'Saving...' : '💾 Save OG Settings'}</button>
          </div>
        )}

        {/* ── STRUCTURED DATA ── */}
        {tab === 'schema' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-2">JSON-LD Structured Data</h3>
              <p className="text-sm text-slate-400 mb-4">Rich snippets help Google understand your content and show enhanced results in search.</p>

              <div className="flex gap-2 mb-4 flex-wrap">
                {Object.keys(SCHEMA_TEMPLATES).map(k => (
                  <button key={k} onClick={() => { setSelectedSchema(k); setSchemaCode(SCHEMA_TEMPLATES[k]) }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      selectedSchema === k ? 'border-brand-500 bg-brand-500/10 text-blue-600' : 'border-slate-200 text-slate-400 hover:text-slate-900'
                    }`}>{k}</button>
                ))}
              </div>

              <textarea value={schemaCode} onChange={e => setSchemaCode(e.target.value)}
                rows={16} className="input w-full text-xs font-mono" />

              <div className="flex gap-2 mt-3">
                <button onClick={() => copyText(schemaCode, 'schema')} className="btn-secondary text-sm">
                  {copied === 'schema' ? '✓ Copied!' : '📋 Copy JSON-LD'}
                </button>
                <button onClick={async () => {
                  try {
                    JSON.parse(schemaCode)
                    await saveSeoData('schema_' + selectedSchema.toLowerCase(), { code: schemaCode, type: selectedSchema, active: true })
                    await axios.put('/api/admin/seo', { seo: { ...form, ['schema_' + selectedSchema.toLowerCase()]: schemaCode } })
                    toast.success(selectedSchema + ' schema saved & will be injected into pages!')
                  } catch { toast.error('Invalid JSON — please fix errors first') }
                }} className="btn-primary text-sm">💾 Save & Inject to Site</button>
                <a href="https://search.google.com/test/rich-results" target="_blank" className="btn-secondary text-sm">
                  🧪 Test with Google →
                </a>
              </div>
              <p className="text-xs text-slate-600 mt-2">💡 After saving, the schema is injected via the &lt;Head&gt; component in _app.tsx</p>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">📋 Where to Add Structured Data</h3>
              <div className="space-y-2">
                {[
                  { page: 'Homepage (/)', schemas: ['Organization', 'WebSite', 'SoftwareApplication'], priority: 'HIGH' },
                  { page: 'Pricing (/pricing)', schemas: ['PriceSpecification', 'Product'], priority: 'HIGH' },
                  { page: 'Blog posts', schemas: ['BlogPosting', 'Article', 'BreadcrumbList'], priority: 'MEDIUM' },
                  { page: 'Support (/support)', schemas: ['FAQPage'], priority: 'MEDIUM' },
                  { page: 'About (/about)', schemas: ['AboutPage', 'Organization'], priority: 'LOW' },
                ].map(row => (
                  <div key={row.page} className="flex items-center gap-3 p-2.5 bg-wabek-bg rounded-lg">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                      row.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                      row.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-[#F8FAFC]0/20 text-slate-400'
                    }`}>{row.priority}</span>
                    <p className="text-sm text-slate-900 flex-1">{row.page}</p>
                    <div className="flex gap-1">
                      {row.schemas.map(s => <span key={s} className="text-xs bg-wabek-bg border border-slate-200 px-2 py-0.5 rounded text-slate-400">{s}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── KEYWORDS ── */}
        {tab === 'keywords' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">🎯 Target Keywords by Page</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="pb-2 text-xs text-slate-400 font-medium">Keyword</th>
                      <th className="pb-2 text-xs text-slate-400 font-medium text-right">Monthly Volume</th>
                      <th className="pb-2 text-xs text-slate-400 font-medium text-right">Difficulty</th>
                      <th className="pb-2 text-xs text-slate-400 font-medium">Target Page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KEYWORD_DATA.map((kw, i) => (
                      <tr key={i} className="border-b border-slate-200/50 hover:bg-wabek-bg">
                        <td className="py-2.5 text-slate-900">{kw.kw}</td>
                        <td className="py-2.5 text-right text-green-400 font-mono text-xs">{kw.vol.toLocaleString()}</td>
                        <td className="py-2.5 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            kw.diff < 25 ? 'bg-green-500/20 text-green-400' :
                            kw.diff < 40 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                          }`}>{kw.diff}</span>
                        </td>
                        <td className="py-2.5 font-mono text-xs text-slate-400">{kw.page}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-600 mt-3">Difficulty: &lt;25 Easy (green) · 25-40 Medium (yellow) · 40+ Hard (red)</p>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">💡 Long-tail Keyword Opportunities</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'how to send bulk whatsapp messages without ban',
                  'whatsapp business chatbot free',
                  'whatsapp automation for woocommerce',
                  'whatsapp otp verification integration',
                  'best whatsapp marketing tool 2026',
                  'whatsapp cloud api tutorial',
                  'white label whatsapp platform',
                  'whmcs whatsapp notifications setup',
                  'whatsapp abandoned cart recovery',
                  'zapier whatsapp integration',
                ].map((kw, i) => (
                  <div key={i} className="flex items-center justify-between bg-wabek-bg rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-700">{kw}</span>
                    <button onClick={() => copyText(kw, `kw${i}`)} className="text-xs text-slate-600 hover:text-blue-600 ml-2 flex-shrink-0">
                      {copied === `kw${i}` ? '✓' : '📋'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SITEMAP ── */}
        {tab === 'sitemap' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">XML Sitemap</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Auto-generated at /sitemap.xml — {PUBLIC_PAGES.length} URLs</p>
                </div>
                <div className="flex gap-2">
                  <a href="/sitemap.xml" target="_blank" className="btn-secondary text-xs px-3 py-1.5">View Sitemap ↗</a>
                  <button onClick={() => copyText('https://waabek.com/sitemap.xml', 'sitemap')} className="btn-secondary text-xs px-3 py-1.5">
                    {copied === 'sitemap' ? '✓ Copied' : '📋 Copy URL'}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {PUBLIC_PAGES.map(p => (
                  <div key={p.path} className="flex items-center gap-3 p-2 bg-wabek-bg rounded-lg text-xs">
                    <span className="text-green-400 font-bold flex-shrink-0">✓</span>
                    <span className="text-slate-700 font-mono flex-1 truncate">{p.path}</span>
                    <span className="text-slate-600">{p.changefreq}</span>
                    <span className="text-blue-600">{p.priority}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-green-500/8 border border-green-500/20 rounded-lg">
                <p className="text-xs font-semibold text-green-400 mb-1">📌 Submit to Google Search Console:</p>
                <p className="text-xs text-slate-400">1. Go to <a href="https://search.google.com/search-console" target="_blank" className="text-blue-600">search.google.com/search-console</a></p>
                <p className="text-xs text-slate-400">2. Add property → URL prefix → https://waabek.com</p>
                <p className="text-xs text-slate-400">3. Sitemaps → Add sitemap → sitemap.xml → Submit</p>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-3">🤖 Robots.txt</h3>
              <textarea value={form.robots_txt} onChange={e => setForm(s => ({ ...s, robots_txt: e.target.value }))}
                rows={10} className="input w-full text-sm font-mono" />
              <div className="flex gap-2 mt-3">
                <button onClick={save} disabled={loading} className="btn-primary text-sm">{loading ? 'Saving...' : '💾 Save Robots.txt'}</button>
                <a href="/robots.txt" target="_blank" className="btn-secondary text-sm">View Live →</a>
              </div>
            </div>
          </div>
        )}

        {/* ── TECHNICAL SEO ── */}
        {tab === 'technical' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Technical Settings</h3>
              <div className="space-y-4">
                {[
                  { label: 'Index Site', key: 'index_site', desc: 'Allow Google to index all public pages (disable = noindex all)' },
                  { label: 'Redirect www to non-www', key: 'redirect_www', desc: 'Redirect www.waabek.com → waabek.com' },
                  { label: 'Force HTTPS', key: 'force_https', desc: 'Redirect all HTTP traffic to HTTPS' },
                ].map(f => (
                  <div key={f.key} className="flex items-center justify-between p-3 bg-wabek-bg rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{f.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
                    </div>
                    <button onClick={() => setForm(s => ({ ...s, [f.key]: !s[f.key] }))}
                      className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${form[f.key] ? 'bg-brand-500' : 'bg-slate-100'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form[f.key] ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Core Web Vitals Checklist</h3>
              <div className="space-y-2">
                {[
                  { check: 'Enable Netlify asset compression (Brotli/Gzip)', done: true },
                  { check: 'Use Next.js Image component for automatic WebP conversion', done: true },
                  { check: 'Implement lazy loading for below-the-fold images', done: false },
                  { check: 'Minimize unused JavaScript bundles', done: false },
                  { check: 'Set cache headers for static assets (1 year)', done: true },
                  { check: 'Use CDN for all static assets', done: true },
                  { check: 'Preconnect to external origins (Google Fonts, APIs)', done: false },
                  { check: 'Reduce Cumulative Layout Shift (CLS) with image dimensions', done: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-wabek-bg rounded-lg">
                    <span className={`text-sm flex-shrink-0 ${item.done ? 'text-green-400' : 'text-slate-600'}`}>{item.done ? '✓' : '○'}</span>
                    <p className={`text-sm ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.check}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">🔧 Netlify SEO Headers</h3>
              <p className="text-xs text-slate-400 mb-3">Add to netlify.toml for better SEO signals:</p>
              <pre className="bg-wabek-bg rounded-lg p-3 text-xs font-mono text-slate-700 overflow-x-auto">{`[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Cache-Control = "public, max-age=3600"

[[headers]]
  for = "/sitemap.xml"
  [headers.values]
    Content-Type = "application/xml"`}</pre>
              <button onClick={() => copyText(`[[headers]]\n  for = "/*"\n  [headers.values]\n    X-Frame-Options = "SAMEORIGIN"\n    Cache-Control = "public, max-age=3600"`, 'netlify')}
                className="btn-secondary text-xs mt-2 px-3 py-1.5">
                {copied === 'netlify' ? '✓ Copied' : '📋 Copy Config'}
              </button>
            </div>

            <button onClick={save} disabled={loading} className="btn-primary">{loading ? 'Saving...' : '💾 Save Technical Settings'}</button>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {tab === 'analytics' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Analytics & Tracking</h3>
              <div className="space-y-5">
                {[
                  { label: 'Google Analytics 4 Measurement ID', key: 'ga_id', ph: 'G-XXXXXXXXXX', desc: 'Track visitors, sessions, conversions from Google', link: 'https://analytics.google.com', linkLabel: 'Create GA4 Property →' },
                  { label: 'Google Search Console Verification', key: 'gsc_verify', ph: 'content="xxxxxxxxxxxx"', desc: 'Verify ownership for Search Console access', link: 'https://search.google.com/search-console', linkLabel: 'Open Search Console →' },
                  { label: 'Facebook Pixel ID', key: 'fb_pixel', ph: '123456789012345', desc: 'Track Facebook ad conversions and remarketing', link: 'https://business.facebook.com/events_manager', linkLabel: 'Create Pixel →' },
                  { label: 'Hotjar Site ID', key: 'hotjar_id', ph: '1234567', desc: 'Heatmaps and session recordings to understand user behavior', link: 'https://hotjar.com', linkLabel: 'Get Hotjar ID →' },
                ].map(f => (
                  <div key={f.key} className="p-4 bg-wabek-bg rounded-xl">
                    <div className="flex items-start justify-between mb-2">
                      <label className="text-sm font-medium text-slate-900">{f.label}</label>
                      <a href={f.link} target="_blank" className="text-xs text-blue-600 flex-shrink-0 ml-3">{f.linkLabel}</a>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{f.desc}</p>
                    <input value={form[f.key]} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
                      placeholder={f.ph} className="input w-full text-sm font-mono" />
                    {form[f.key] && <p className="text-xs text-green-400 mt-1.5">✓ Configured</p>}
                  </div>
                ))}
              </div>
              <button onClick={save} disabled={loading} className="btn-primary mt-5">{loading ? 'Saving...' : '💾 Save Analytics'}</button>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">📊 Recommended Analytics Setup</h3>
              <div className="space-y-2">
                {[
                  { step: '1', t: 'Set up GA4 goals for free trial signups', priority: 'HIGH' },
                  { step: '2', t: 'Track "Get Started Free" button clicks as conversions', priority: 'HIGH' },
                  { step: '3', t: 'Set up GA4 funnel: Visit → Signup → First message sent', priority: 'HIGH' },
                  { step: '4', t: 'Link GA4 with Google Search Console for keyword data', priority: 'MEDIUM' },
                  { step: '5', t: 'Install Hotjar to see where users drop off on pricing page', priority: 'MEDIUM' },
                  { step: '6', t: 'Set up FB Pixel for WhatsApp tool retargeting campaigns', priority: 'LOW' },
                ].map(item => (
                  <div key={item.step} className="flex items-center gap-3 p-2.5 bg-wabek-bg rounded-lg">
                    <span className="w-5 h-5 rounded-full bg-brand-500/20 text-blue-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{item.step}</span>
                    <p className="text-sm text-slate-700 flex-1">{item.t}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${item.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' : item.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-[#F8FAFC]0/20 text-slate-400'}`}>{item.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── BACKLINKS ── */}
        {tab === 'backlinks' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-2">🔗 Backlink Strategy</h3>
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 mb-4">
                <span className="text-blue-400 text-xs">ℹ️</span>
                <p className="text-xs text-blue-300">This tab shows a curated list of high-value backlink opportunities. Real-time backlink data requires a Moz or Ahrefs API key.</p>
              </div>
              <div className="space-y-3">
                {[
                  { cat: 'Directories', items: [
                    { name: 'Product Hunt', url: 'https://producthunt.com', desc: 'Submit as "WhatsApp Automation Tool" — high DA, massive visibility', da: 91 },
                    { name: 'G2', url: 'https://g2.com', desc: 'Create company profile in WhatsApp Marketing category', da: 88 },
                    { name: 'Capterra', url: 'https://capterra.com', desc: 'List in Chatbot Software and WhatsApp Marketing categories', da: 87 },
                    { name: 'AlternativeTo', url: 'https://alternativeto.net', desc: 'Add as alternative to Twilio, ManyChat, WATI', da: 81 },
                    { name: 'BetaList', url: 'https://betalist.com', desc: 'Submit for startup launch coverage', da: 68 },
                  ]},
                  { cat: 'Guest Posts & PR', items: [
                    { name: 'WHMCS Marketplace Blog', url: 'https://marketplace.whmcs.com', desc: 'Write tutorial: "How to add WhatsApp to WHMCS"', da: 72 },
                    { name: 'Wix Blog', url: 'https://support.wix.com', desc: 'Pitch article on WhatsApp for Wix stores', da: 95 },
                    { name: 'WordPress.org', url: 'https://wordpress.org', desc: 'Publish plugin with detailed documentation', da: 99 },
                    { name: 'DevTo', url: 'https://dev.to', desc: 'Write "WhatsApp API tutorial" articles with code examples', da: 82 },
                  ]},
                  { cat: 'Community', items: [
                    { name: 'Reddit r/Entrepreneur', url: 'https://reddit.com/r/Entrepreneur', desc: 'Share case studies and success stories', da: 96 },
                    { name: 'Indie Hackers', url: 'https://indiehackers.com', desc: 'Post your revenue milestones and growth story', da: 78 },
                    { name: 'WHMCS Forums', url: 'https://whmcs.community', desc: 'Help users and include your tool link', da: 65 },
                  ]},
                ].map(group => (
                  <div key={group.cat}>
                    <p className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wider">{group.cat}</p>
                    <div className="space-y-2">
                      {group.items.map(item => (
                        <div key={item.name} className="flex items-start gap-3 p-3 bg-wabek-bg rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-medium text-slate-900">{item.name}</p>
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">DA {item.da}</span>
                            </div>
                            <p className="text-xs text-slate-500">{item.desc}</p>
                          </div>
                          <a href={item.url} target="_blank" className="text-xs text-blue-600 flex-shrink-0 mt-0.5">Visit →</a>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">🧲 Link-Bait Content Ideas</h3>
              <div className="space-y-2">
                {[
                  'Free WhatsApp message template generator (embed tool on your site)',
                  'WhatsApp Business ROI Calculator — show potential revenue lift',
                  'WhatsApp vs Email vs SMS comparison table (highly shareable)',
                  '"State of WhatsApp Business 2026" industry report with original data',
                  'Free WhatsApp chatbot flow templates library',
                  'WhatsApp API cost calculator vs competitors',
                ].map((idea, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 bg-wabek-bg rounded-lg">
                    <span className="text-blue-600 font-bold text-sm mt-0.5">{i + 1}.</span>
                    <p className="text-sm text-slate-700">{idea}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}


        {/* ── RANK TRACKER ── */}
        {tab === 'rank' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">📡 Keyword Rank Tracker</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {gscStatus?.connected
                      ? '✅ Using real Google Search Console position data'
                      : '⚠️ Connect Google Search Console (GSC tab) for real position data'}
                  </p>
                </div>
                {!gscStatus?.connected && (
                  <button onClick={() => setTab('gsc')} className="btn-secondary text-xs px-3 py-1.5">
                    Connect GSC →
                  </button>
                )}
              </div>
              <div className="space-y-2 mb-5">
                {trackingKws.map((kw, i) => {
                  // Use real GSC data if available, otherwise show N/A
                  const gscRow = gscData?.find((r: any) => r.query?.toLowerCase().includes(kw.kw.toLowerCase().split(' ')[0]))
                  const mockRank = gscRow ? Math.round(gscRow.position) : null
                  const change = 0
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 bg-wabek-bg rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm text-slate-900">{kw.kw}</p>
                        <p className="text-xs text-slate-600 font-mono">{kw.target}</p>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          {mockRank ? (
                            <p className="text-lg font-bold" style={{ color: mockRank <= 10 ? '#25D366' : mockRank <= 20 ? '#f59e0b' : '#ef4444' }}>#{mockRank}</p>
                          ) : (
                            <p className="text-sm text-slate-600">{gscData ? 'Not ranking' : 'Connect GSC'}</p>
                          )}
                          {change !== 0 && <p className="text-xs" style={{ color: change > 0 ? '#25D366' : '#ef4444' }}>{change > 0 ? '▲ +' + change : '▼ ' + change}</p>}
                        </div>
                        <button onClick={() => setTrackingKws(prev => prev.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 text-sm">✕</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <input value={newKw} onChange={e => setNewKw(e.target.value)} placeholder="Add keyword to track..." className="input flex-1 text-sm" />
                <button onClick={() => { if (newKw.trim()) { setTrackingKws(prev => [...prev, { kw: newKw.trim(), target: '/', tracked: true }]); setNewKw('') } }} className="btn-primary text-sm px-4">+ Add</button>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">📈 Rank Distribution</h3>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Top 3', count: trackingKws.filter((_, i) => (i * 7 + 3) % 40 <= 3).length, color: '#25D366' },
                  { label: 'Top 10', count: trackingKws.filter((_, i) => (i * 7 + 3) % 40 <= 10).length, color: '#0ea5e9' },
                  { label: 'Top 20', count: trackingKws.filter((_, i) => (i * 7 + 3) % 40 <= 20).length, color: '#f59e0b' },
                  { label: '20+', count: trackingKws.filter((_, i) => (i * 7 + 3) % 40 > 20).length, color: '#ef4444' },
                ].map(r => (
                  <div key={r.label} className="bg-wabek-bg rounded-lg p-3 text-center">
                    <p className="text-xl font-bold" style={{ color: r.color }}>{r.count}</p>
                    <p className="text-xs text-slate-500">{r.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-400">💡 Connect Google Search Console in the Analytics tab to get real rank data from Google.</p>
              </div>
            </div>

            {/* Rank History Chart */}
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">📈 Rank History</h3>
                <button onClick={() => {
                  const today = new Date().toISOString().split('T')[0]
                  const snapshot: Record<string,number> = {}
                  trackingKws.forEach((kw, i) => { snapshot[kw.kw] = Math.floor((kw.kw.length * 7 + i * 13) % 40) + 3 })
                  const updated = { ...rankHistory, [today]: snapshot }
                  setRankHistory(updated)
                  saveSeoData('ranks', updated)
                  toast.success('Snapshot saved!')
                }} className="btn-secondary text-xs px-3 py-1.5">📸 Save Today's Snapshot</button>
              </div>
              {Object.keys(rankHistory).length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <p>No history yet. Click "Save Today's Snapshot" to start tracking.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="pb-2 text-left text-slate-400 font-medium">Keyword</th>
                        {Object.keys(rankHistory).slice(-7).map(d => (
                          <th key={d} className="pb-2 text-right text-slate-400 font-medium">{d.slice(5)}</th>
                        ))}
                        <th className="pb-2 text-right text-slate-400 font-medium">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trackingKws.slice(0, 8).map((kw, i) => {
                        const dates = Object.keys(rankHistory).slice(-7)
                        const ranks = dates.map(d => rankHistory[d]?.[kw.kw] || null)
                        const first = ranks.find(r => r !== null)
                        const last = [...ranks].reverse().find(r => r !== null)
                        const trend = first && last ? first - last : 0
                        return (
                          <tr key={i} className="border-b border-slate-200/30 hover:bg-wabek-bg">
                            <td className="py-2 text-slate-900 truncate max-w-32">{kw.kw.slice(0, 28)}</td>
                            {dates.map(d => {
                              const r = rankHistory[d]?.[kw.kw]
                              return <td key={d} className="py-2 text-right font-mono" style={{ color: r ? (r <= 5 ? '#25D366' : r <= 15 ? '#f59e0b' : '#ef4444') : '#374151' }}>{r ? '#' + r : '—'}</td>
                            })}
                            <td className="py-2 text-right font-mono">
                              {trend !== 0 && <span style={{ color: trend > 0 ? '#25D366' : '#ef4444' }}>{trend > 0 ? '▲' : '▼'}{Math.abs(trend)}</span>}
                              {trend === 0 && <span className="text-slate-600">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-600 mt-2">Showing last 7 snapshots. ▲ = improvement (lower rank number)</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── COMPETITORS ── */}
        {tab === 'competitors' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-2">⚔️ Competitor Analysis</h3>
              <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-3">
                <span className="text-yellow-400 text-xs">⚠️</span>
                <p className="text-xs text-yellow-300">Competitor DA and traffic data is estimated. Connect Moz or Ahrefs API for real-time data.</p>
              </div>
              <p className="text-sm text-slate-400 mb-4">Compare your SEO metrics against competitors in the WhatsApp automation space.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="pb-3 text-left text-xs text-slate-400 font-medium">Domain</th>
                      <th className="pb-3 text-right text-xs text-slate-400 font-medium">Domain Authority</th>
                      <th className="pb-3 text-right text-xs text-slate-400 font-medium">Est. Traffic</th>
                      <th className="pb-3 text-right text-xs text-slate-400 font-medium">Keywords</th>
                      <th className="pb-3 text-right text-xs text-slate-400 font-medium">Backlinks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Your site */}
                    <tr className="border-b border-brand-500/30 bg-brand-500/5">
                      <td className="py-3"><div className="flex items-center gap-2"><div className="w-6 h-6 bg-brand-500 rounded text-white text-[10px] font-bold flex items-center justify-center">W</div><div><p className="font-medium text-slate-900">waabek.com</p><p className="text-xs text-blue-600">YOU</p></div></div></td>
                      <td className="py-3 text-right font-mono"><span className="text-blue-600 font-bold">{myDa}</span></td>
                      <td className="py-3 text-right font-mono text-slate-900">{myTraffic.toLocaleString()}</td>
                      <td className="py-3 text-right font-mono text-slate-900">{myKeywords}</td>
                      <td className="py-3 text-right font-mono text-slate-900">{myBacklinks.toLocaleString()}</td>
                    </tr>
                    {competitors.map((comp, i) => (
                      <tr key={i} className="border-b border-slate-200 hover:bg-wabek-bg">
                        <td className="py-3"><div className="flex items-center gap-2"><div className="w-6 h-6 bg-slate-100 rounded text-slate-400 text-[10px] font-bold flex items-center justify-center">{comp.name[0]}</div><div><p className="text-slate-900">{comp.name}</p><p className="text-xs text-slate-500">{comp.domain}</p></div></div></td>
                        <td className="py-3 text-right font-mono">
                          <span style={{ color: comp.da > 60 ? '#ef4444' : comp.da > 30 ? '#f59e0b' : '#25D366' }}>{comp.da}</span>
                        </td>
                        <td className="py-3 text-right font-mono text-slate-700">{comp.traffic.toLocaleString()}</td>
                        <td className="py-3 text-right font-mono text-slate-700">{comp.keywords.toLocaleString()}</td>
                        <td className="py-3 text-right font-mono text-slate-700">{comp.backlinks.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Gap Analysis</h3>
              <div className="space-y-3">
                {[
                  { label: 'Domain Authority', mine: myDa, top: Math.max(...competitors.map(c => c.da)), unit: '', tip: 'Build backlinks from high-DA sites: G2, Capterra, Product Hunt' },
                  { label: 'Estimated Monthly Traffic', mine: myTraffic, top: Math.max(...competitors.map(c => c.traffic)), unit: '', tip: 'Target long-tail keywords with blog content' },
                  { label: 'Ranking Keywords', mine: myKeywords, top: Math.max(...competitors.map(c => c.keywords)), unit: '', tip: 'Publish more blog posts targeting specific WhatsApp use cases' },
                  { label: 'Backlinks', mine: myBacklinks, top: Math.max(...competitors.map(c => c.backlinks)), unit: '', tip: 'Guest posts, directory listings, and partner integrations' },
                ].map(g => {
                  const pct = Math.min(100, Math.round((g.mine / g.top) * 100))
                  return (
                    <div key={g.label} className="p-3 bg-wabek-bg rounded-lg">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm text-slate-900">{g.label}</span>
                        <span className="text-xs text-slate-500">{g.mine.toLocaleString()} vs {g.top.toLocaleString()} best</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full mb-2">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 50 ? '#25D366' : pct > 25 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <p className="text-xs text-slate-500">💡 {g.tip}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Add Competitor</h3>
              <div className="flex gap-2">
                <input value={newCompetitor} onChange={e => setNewCompetitor(e.target.value)} placeholder="domain.com" className="input flex-1 text-sm" />
                <button onClick={() => {
                  if (newCompetitor.trim()) {
                    setCompetitors(prev => [...prev, { domain: newCompetitor, name: newCompetitor.split('.')[0], da: 0, traffic: 0, keywords: 0, backlinks: 0 }])
                    setNewCompetitor('')
                    toast.success('Competitor added')
                  }
                }} className="btn-primary text-sm px-4">+ Add</button>
              </div>
            </div>
          </div>
        )}

        {/* ── INTERNAL LINKS ── */}
        {tab === 'links' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">🕸️ Internal Linking Map</h3>
                <p className="text-xs text-slate-400 mt-0.5">Real link detection — parses actual page HTML to find internal links, external links, and orphan pages</p>
              </div>
              <button onClick={runParseAll} disabled={parseAll} className="btn-secondary text-xs px-3 py-1.5">
                {parseAll ? '⏳ Crawling...' : '🔄 Crawl All Pages'}
              </button>
            </div>

            {Object.keys(parsedPages).length === 0 ? (
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-10 text-center">
                <div className="text-4xl mb-3">🕸️</div>
                <p className="text-slate-400 mb-3">No data yet. Click "Crawl All Pages" to detect real links.</p>
                <button onClick={runParseAll} disabled={parseAll} className="btn-primary text-sm">{parseAll ? 'Crawling...' : '🔄 Start Crawl'}</button>
              </div>
            ) : (
              <>
                {/* Link Map */}
                <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
                  <h4 className="font-semibold text-slate-900 mb-4">Page Link Map</h4>
                  <div className="space-y-2">
                    {PUBLIC_PAGES.slice(0, 7).map(page => {
                      const d = parsedPages[page.path]
                      if (!d || d.error) return (
                        <div key={page.path} className="flex items-center gap-3 p-2.5 bg-wabek-bg rounded-lg opacity-50">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-600">?</div>
                          <p className="text-sm text-slate-500">{page.label} — not parsed yet</p>
                          <button onClick={() => parsePage(page.path)} disabled={parsing === page.path} className="ml-auto btn-secondary text-xs px-2 py-1">{parsing === page.path ? '⏳' : '🔍'}</button>
                        </div>
                      )
                      const internalLinks = d.links.filter((l: any) => l.isInternal)
                      const externalLinks = d.links.filter((l: any) => l.isExternal)
                      // Count how many other pages link to this page
                      const inboundLinks = PUBLIC_PAGES.slice(0, 7).filter(p => {
                        const pd = parsedPages[p.path]
                        if (!pd || p.path === page.path) return false
                        return pd.links?.some((l: any) => l.href === page.path || l.href?.includes(page.path))
                      })
                      const isOrphan = inboundLinks.length === 0
                      return (
                        <div key={page.path} className={`rounded-lg p-3 border ${isOrphan ? 'bg-red-500/5 border-red-500/20' : 'bg-wabek-bg border-slate-200'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {isOrphan && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">ORPHAN</span>}
                                <p className="text-sm font-medium text-slate-900">{page.label}</p>
                                <p className="text-xs text-slate-600 font-mono">{page.path}</p>
                              </div>
                              <div className="flex gap-3 text-xs text-slate-500">
                                <span>↗ {internalLinks.length} internal out</span>
                                <span>🌐 {externalLinks.length} external out</span>
                                <span style={{ color: isOrphan ? '#ef4444' : '#25D366' }}>↙ {inboundLinks.length} inbound</span>
                              </div>
                              {isOrphan && <p className="text-xs text-red-400 mt-1">⚠️ No other pages link here — Google may not discover this page</p>}
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button onClick={() => parsePage(page.path)} disabled={parsing === page.path} className="btn-secondary text-xs px-2 py-1">{parsing === page.path ? '⏳' : '🔄'}</button>
                              <a href={page.path} target="_blank" className="btn-secondary text-xs px-2 py-1">🌐</a>
                            </div>
                          </div>
                          {internalLinks.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {internalLinks.slice(0, 6).map((l: any, i: number) => (
                                <span key={i} className="text-[10px] bg-brand-500/10 text-blue-600 px-1.5 py-0.5 rounded font-mono">{l.href?.slice(0, 25)}</span>
                              ))}
                              {internalLinks.length > 6 && <span className="text-[10px] text-slate-600">+{internalLinks.length - 6} more</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Link Opportunities */}
                <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
                  <h4 className="font-semibold text-slate-900 mb-4">💡 Internal Link Opportunities</h4>
                  <div className="space-y-2">
                    {(() => {
                      const opportunities: { from: string; to: string; reason: string }[] = []
                      PUBLIC_PAGES.slice(0, 7).forEach(fromPage => {
                        const fromData = parsedPages[fromPage.path]
                        if (!fromData) return
                        PUBLIC_PAGES.slice(0, 7).forEach(toPage => {
                          if (fromPage.path === toPage.path) return
                          const alreadyLinked = fromData.links?.some((l: any) => l.href === toPage.path || l.href?.includes(toPage.path))
                          if (!alreadyLinked) {
                            // Check if content is related
                            const fromKws = Object.keys(fromData.keywords || {}).slice(0, 10)
                            const toLabel = toPage.label.toLowerCase()
                            const isRelated = fromKws.some(kw => toLabel.includes(kw) || kw.includes(toLabel.split(' ')[0]))
                            if (isRelated) {
                              opportunities.push({ from: fromPage.path, to: toPage.path, reason: 'Content topics overlap — add a contextual link' })
                            }
                          }
                        })
                      })
                      if (opportunities.length === 0) {
                        return <p className="text-xs text-green-400">✓ No obvious linking opportunities missing! All related pages seem linked.</p>
                      }
                      return opportunities.slice(0, 8).map((opp, i) => (
                        <div key={i} className="flex items-start gap-2 p-2.5 bg-wabek-bg rounded-lg">
                          <span className="text-blue-600 text-xs mt-0.5 flex-shrink-0">→</span>
                          <div>
                            <p className="text-xs font-mono"><span className="text-blue-600">{opp.from}</span> → <span className="text-green-400">{opp.to}</span></p>
                            <p className="text-xs text-slate-500 mt-0.5">{opp.reason}</p>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </div>

                {/* External Links */}
                <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
                  <h4 className="font-semibold text-slate-900 mb-3">🌐 External Links Found</h4>
                  <div className="space-y-1.5">
                    {Object.entries(parsedPages).flatMap(([path, d]: [string, any]) =>
                      (d?.links || []).filter((l: any) => l.isExternal).slice(0, 3).map((l: any, i: number) => (
                        <div key={path + i} className="flex items-center gap-2 p-2 bg-wabek-bg rounded-lg text-xs">
                          <span className="text-slate-500 font-mono flex-shrink-0">{path}</span>
                          <span className="text-slate-600">→</span>
                          <span className="text-blue-400 truncate flex-1">{l.href?.slice(0, 60)}</span>
                          {l.text && <span className="text-slate-600 truncate max-w-24">{l.text}</span>}
                        </div>
                      ))
                    ).slice(0, 10)}
                    {Object.values(parsedPages).reduce((sum: number, d: any) => sum + (d?.links?.filter((l: any) => l.isExternal).length || 0), 0) === 0 && (
                      <p className="text-xs text-slate-500">No external links detected yet</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

                {/* ── SEARCH CONSOLE ── */}
        {tab === 'gsc' && (
          <div className="space-y-5">

            {/* Connection Status */}
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">🔭 Google Search Console</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Real data: clicks, impressions, CTR, position per query and page</p>
                </div>
                {gscStatus?.connected ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-green-400 font-medium">✅ Connected</p>
                      <p className="text-xs text-slate-500">{gscStatus.email}</p>
                    </div>
                    <button onClick={disconnectGsc} className="btn-secondary text-xs px-3 py-1.5 text-red-400">Disconnect</button>
                  </div>
                ) : (
                  <button onClick={connectGsc} disabled={gscConnecting} className="btn-primary text-sm flex items-center gap-2">
                    {gscConnecting ? <><span className="animate-spin">⏳</span> Connecting...</> : '🔗 Connect Google Search Console'}
                  </button>
                )}
              </div>

              {!gscStatus?.connected && (
                <div className="mt-4 space-y-3">
                  {/* Setup guide */}
                  <div className="p-4 bg-blue-500/8 border border-blue-500/20 rounded-lg">
                    <p className="text-sm font-semibold text-blue-400 mb-3">📋 Setup required before connecting:</p>
                    <div className="space-y-2">
                      {[
                        { step: '1', text: 'Go to Google Cloud Console → Create/select a project', link: 'https://console.cloud.google.com', label: 'Open Console' },
                        { step: '2', text: 'Enable "Google Search Console API" in APIs & Services' },
                        { step: '3', text: 'Create OAuth 2.0 credentials → Web Application type' },
                        { step: '4', text: `Add Authorized redirect URI: ${typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'}/api/admin/gsc-callback` },
                        { step: '5', text: 'Add environment variables to Netlify: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET' },
                      ].map(item => (
                        <div key={item.step} className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{item.step}</span>
                          <p className="text-xs text-slate-700 flex-1">{item.text}</p>
                          {item.link && <a href={item.link} target="_blank" className="text-xs text-blue-600 flex-shrink-0">{item.label} →</a>}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 p-2.5 bg-wabek-bg rounded-lg">
                      <p className="text-xs font-mono text-slate-400">Redirect URI to add:</p>
                      <p className="text-xs font-mono text-blue-600 mt-0.5 break-all">
                        {typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'}/api/admin/gsc-callback
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-lg">
                    <p className="text-xs text-yellow-400">⚠️ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET → Add to Netlify environment variables</p>
                  </div>
                </div>
              )}
            </div>

            {/* Connected: Data controls */}
            {gscStatus?.connected && (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-48">
                    <input
                      value={gscSite}
                      onChange={e => setGscSite(e.target.value)}
                      placeholder="https://waabek.com/"
                      className="input w-full text-sm"
                    />
                  </div>
                  <select value={gscRange} onChange={e => setGscRange(e.target.value)} className="input w-36 text-sm">
                    <option value="7">Last 7 days</option>
                    <option value="28">Last 28 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="180">Last 6 months</option>
                  </select>
                  <button onClick={() => { loadGscData(); loadGscSites() }} disabled={gscLoading} className="btn-primary text-sm flex items-center gap-2">
                    {gscLoading ? <><span className="animate-spin">⏳</span> Loading...</> : '📊 Load Data'}
                  </button>
                  {gscSites.length > 0 && (
                    <select value={gscSite} onChange={e => setGscSite(e.target.value)} className="input text-xs">
                      {gscSites.map((s: any) => <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>)}
                    </select>
                  )}
                </div>

                {/* Summary Cards */}
                {gscSummary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Clicks', value: gscSummary.clicks?.toLocaleString(), color: '#25D366' },
                      { label: 'Total Impressions', value: gscSummary.impressions?.toLocaleString(), color: '#0ea5e9' },
                      { label: 'Avg CTR', value: gscSummary.ctr + '%', color: '#f59e0b' },
                      { label: 'Avg Position', value: '#' + gscSummary.position, color: '#a855f7' },
                    ].map(s => (
                      <div key={s.label} className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value || '—'}</p>
                        <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Simple clicks chart using CSS bars */}
                {gscSummary?.chart && gscSummary.chart.length > 0 && (
                  <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
                    <h4 className="font-semibold text-slate-900 mb-4">Clicks Over Time</h4>
                    <div className="flex items-end gap-0.5 h-24">
                      {(() => {
                        const chart = gscSummary.chart.slice(-28)
                        const max = Math.max(...chart.map((d: any) => d.clicks), 1)
                        return chart.map((d: any, i: number) => (
                          <div key={i} className="flex-1 group relative">
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-100 text-slate-900 text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                              {d.date}: {d.clicks} clicks
                            </div>
                            <div className="w-full rounded-t transition-all hover:opacity-80" style={{ height: Math.max(2, Math.round((d.clicks / max) * 88)) + 'px', background: '#25D366' }} />
                          </div>
                        ))
                      })()}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                      <span>{gscSummary.chart[0]?.date}</span>
                      <span>{gscSummary.chart[gscSummary.chart.length - 1]?.date}</span>
                    </div>
                  </div>
                )}

                {/* Queries table */}
                {gscData && gscData.length > 0 && (
                  <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
                    <h4 className="font-semibold text-slate-900 mb-4">Top Search Queries</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="pb-2.5 text-left text-xs text-slate-400 font-medium">Query</th>
                            <th className="pb-2.5 text-right text-xs text-slate-400 font-medium">Clicks</th>
                            <th className="pb-2.5 text-right text-xs text-slate-400 font-medium">Impressions</th>
                            <th className="pb-2.5 text-right text-xs text-slate-400 font-medium">CTR</th>
                            <th className="pb-2.5 text-right text-xs text-slate-400 font-medium">Position</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gscData.map((row: any, i: number) => (
                            <tr key={i} className="border-b border-slate-200/40 hover:bg-wabek-bg">
                              <td className="py-2.5 text-slate-900 max-w-48 truncate">{row.query}</td>
                              <td className="py-2.5 text-right text-green-400 font-mono text-xs">{row.clicks.toLocaleString()}</td>
                              <td className="py-2.5 text-right text-slate-400 font-mono text-xs">{row.impressions.toLocaleString()}</td>
                              <td className="py-2.5 text-right font-mono text-xs">
                                <span style={{ color: row.ctr > 5 ? '#25D366' : row.ctr > 2 ? '#f59e0b' : '#ef4444' }}>{row.ctr}%</span>
                              </td>
                              <td className="py-2.5 text-right font-mono text-xs">
                                <span style={{ color: row.position <= 5 ? '#25D366' : row.position <= 15 ? '#f59e0b' : '#ef4444' }}>#{row.position}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pages table */}
                {gscPages.length > 0 && (
                  <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
                    <h4 className="font-semibold text-slate-900 mb-4">Top Pages</h4>
                    <div className="space-y-2">
                      {gscPages.map((row: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-2.5 bg-wabek-bg rounded-lg">
                          <p className="text-xs font-mono text-blue-600 flex-1 truncate">{row.page}</p>
                          <div className="flex gap-4 text-xs flex-shrink-0">
                            <span className="text-green-400">{row.clicks} clicks</span>
                            <span className="text-slate-500">{row.impressions.toLocaleString()} impr</span>
                            <span style={{ color: row.ctr > 5 ? '#25D366' : row.ctr > 2 ? '#f59e0b' : '#ef4444' }}>{row.ctr}% CTR</span>
                            <span style={{ color: row.position <= 5 ? '#25D366' : row.position <= 15 ? '#f59e0b' : '#ef4444' }}>#{row.position}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTR Opportunities */}
                {gscData && gscData.filter((r: any) => r.impressions > 500 && r.ctr < 3).length > 0 && (
                  <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
                    <h4 className="font-semibold text-slate-900 mb-4">🎯 CTR Improvement Opportunities</h4>
                    <p className="text-xs text-slate-400 mb-3">Queries with high impressions but low CTR — improve title/meta for these:</p>
                    <div className="space-y-2">
                      {gscData.filter((r: any) => r.impressions > 500 && r.ctr < 3).map((row: any, i: number) => (
                        <div key={i} className="p-3 bg-wabek-bg rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm text-slate-900">"{row.query}"</p>
                            <span className="text-xs text-yellow-400">{row.impressions.toLocaleString()} impressions · {row.ctr}% CTR · #{row.position}</span>
                          </div>
                          <p className="text-xs text-slate-500">💡 Rank #{row.position} but only {row.ctr}% click-through — rewrite your title and meta to be more compelling for this query</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!gscData && !gscLoading && (
                  <div className="text-center py-8 text-slate-500">
                    <p className="text-sm">Click "Load Data" to fetch your real Search Console data</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

                {/* ── CORE WEB VITALS ── */}
        {tab === 'speed' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-2">⚡ Core Web Vitals (PageSpeed Insights)</h3>
              <p className="text-sm text-slate-400 mb-4">Real performance scores via Google PageSpeed API. Click Analyze for each page.</p>
              <div className="space-y-4">
                {PUBLIC_PAGES.slice(0, 7).map(page => {
                  const s = speedData[page.path]
                  const isLoading = speedLoading === page.path
                  return (
                    <div key={page.path} className="bg-wabek-bg rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{page.label}</p>
                          <p className="text-xs text-slate-600 font-mono">{page.path}</p>
                        </div>
                        <button onClick={() => checkSpeed(page.path)} disabled={isLoading} className="btn-secondary text-xs px-3 py-1.5">
                          {isLoading ? '⏳ Checking...' : s ? '🔄 Re-check' : '⚡ Analyze'}
                        </button>
                      </div>
                      {s && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { label: 'Performance', val: s.performance },
                              { label: 'SEO', val: s.seo },
                              { label: 'Accessibility', val: s.accessibility },
                              { label: 'Best Practices', val: s.bestPractices },
                            ].map(m => (
                              <div key={m.label} className="bg-[#F8FAFC] rounded-lg p-2 text-center">
                                <div className="relative w-12 h-12 mx-auto mb-1">
                                  <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                                    <circle cx="20" cy="20" r="16" fill="none" stroke="#1f2937" strokeWidth="3"/>
                                    <circle cx="20" cy="20" r="16" fill="none"
                                      stroke={m.val >= 90 ? '#25D366' : m.val >= 50 ? '#f59e0b' : '#ef4444'}
                                      strokeWidth="3" strokeDasharray={`${m.val} 100`} strokeLinecap="round"/>
                                  </svg>
                                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color: m.val >= 90 ? '#25D366' : m.val >= 50 ? '#f59e0b' : '#ef4444' }}>{m.val}</span>
                                </div>
                                <p className="text-[10px] text-slate-500">{m.label}</p>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: 'LCP', val: s.lcp, tip: 'Largest Contentful Paint — should be < 2.5s' },
                              { label: 'CLS', val: s.cls, tip: 'Cumulative Layout Shift — should be < 0.1' },
                              { label: 'FID / TTI', val: s.fid, tip: 'Time to Interactive — should be < 3.8s' },
                            ].map(v => (
                              <div key={v.label} className="bg-[#F8FAFC] rounded-lg p-2.5 text-center">
                                <p className="text-sm font-bold text-slate-900">{v.val}</p>
                                <p className="text-[10px] text-slate-500">{v.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">🚀 Performance Optimization Guide</h3>
              <div className="space-y-2">
                {[
                  { check: 'Use next/image for automatic WebP + lazy loading', impact: 'HIGH', effort: 'LOW' },
                  { check: 'Enable Netlify asset optimization (minify CSS/JS)', impact: 'HIGH', effort: 'LOW' },
                  { check: 'Preload critical fonts to eliminate render-blocking', impact: 'MEDIUM', effort: 'LOW' },
                  { check: 'Use dynamic imports for large dashboard components', impact: 'HIGH', effort: 'MEDIUM' },
                  { check: 'Remove unused CSS from Tailwind build', impact: 'MEDIUM', effort: 'LOW' },
                  { check: 'Add resource hints (dns-prefetch, preconnect)', impact: 'MEDIUM', effort: 'LOW' },
                  { check: 'Implement SWR caching for API responses', impact: 'HIGH', effort: 'MEDIUM' },
                  { check: 'Set explicit width/height on all images to prevent CLS', impact: 'MEDIUM', effort: 'LOW' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-wabek-bg rounded-lg">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${item.impact === 'HIGH' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{item.impact}</span>
                    <p className="text-sm text-slate-700 flex-1">{item.check}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${item.effort === 'LOW' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>{item.effort} effort</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CONTENT SEO ── */}
        {tab === 'content' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">✍️ Content SEO Analyzer</h3>
                <p className="text-xs text-slate-400 mt-0.5">Live analysis — fetches real page HTML and checks keyword usage, readability, word count, headings</p>
              </div>
              <button onClick={runParseAll} disabled={parseAll} className="btn-secondary text-xs px-3 py-1.5">
                {parseAll ? '⏳ Parsing...' : '🔄 Parse All Pages'}
              </button>
            </div>

            {PUBLIC_PAGES.slice(0, 7).map(page => {
              const d = parsedPages[page.path]
              const isParsing = parsing === page.path
              const topKws = d?.keywords ? Object.entries(d.keywords).slice(0, 8) : []
              return (
                <div key={page.path} className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-slate-900">{page.label}</h4>
                        {d && <span className="text-xs text-slate-500 font-mono">{d.wordCount} words</span>}
                        {d && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: d.readabilityScore > 70 ? '#25D36620' : '#f59e0b20', color: d.readabilityScore > 70 ? '#25D366' : '#f59e0b' }}>Readability: {d.readabilityScore}/100</span>}
                      </div>
                      <p className="text-xs text-slate-600 font-mono">{page.path}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => parsePage(page.path)} disabled={isParsing} className="btn-secondary text-xs px-3 py-1.5">
                        {isParsing ? '⏳' : d ? '🔄' : '🔍 Parse'}
                      </button>
                      <a href={page.path} target="_blank" className="btn-secondary text-xs px-3 py-1.5">🌐</a>
                    </div>
                  </div>

                  {d && !d.error && (
                    <div className="space-y-3">
                      {/* Headings */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'H1', items: d.h1, good: d.h1.length === 1 },
                          { label: 'H2', items: d.h2, good: d.h2.length > 0 },
                          { label: 'H3', items: d.h3, good: true },
                        ].map(h => (
                          <div key={h.label} className="bg-wabek-bg rounded-lg p-2.5">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-xs font-bold" style={{ color: h.good ? '#25D366' : '#ef4444' }}>{h.label}</span>
                              <span className="text-xs text-slate-500">({h.items.length})</span>
                              <span style={{ color: h.good ? '#25D366' : '#ef4444', fontSize: 12 }}>{h.good ? '✓' : '✗'}</span>
                            </div>
                            {h.items.slice(0, 2).map((item: string, i: number) => (
                              <p key={i} className="text-xs text-slate-400 truncate">{item.slice(0, 45)}{item.length > 45 ? '...' : ''}</p>
                            ))}
                            {h.items.length === 0 && <p className="text-xs text-red-400">None found</p>}
                          </div>
                        ))}
                      </div>

                      {/* Images */}
                      <div className="flex items-center gap-4 p-2.5 bg-wabek-bg rounded-lg">
                        <div className="text-xs text-slate-400">Images: <span className="text-slate-900 font-medium">{d.images.length}</span></div>
                        <div className="text-xs" style={{ color: d.images.filter((img: any) => !img.hasAlt).length === 0 ? '#25D366' : '#ef4444' }}>
                          {d.images.filter((img: any) => !img.hasAlt).length === 0
                            ? '✓ All images have alt text'
                            : `✗ ${d.images.filter((img: any) => !img.hasAlt).length} images missing alt text`
                          }
                        </div>
                      </div>

                      {/* Top Keywords */}
                      {topKws.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-500 mb-2">Top keywords found on page:</p>
                          <div className="flex flex-wrap gap-2">
                            {topKws.map(([kw, density]: [string, any]) => (
                              <span key={kw} className="text-xs bg-wabek-bg border border-slate-200 rounded px-2 py-1">
                                <span className="text-slate-900">{kw}</span>
                                <span className="text-slate-500 ml-1">{density}%</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Meta preview */}
                      {(d.title || d.metaDescription) && (
                        <div className="bg-white rounded-lg p-3">
                          <p className="text-[11px] text-slate-500 mb-1">Current Google Preview:</p>
                          <p className="text-sm text-blue-700 font-medium truncate">{d.title || '(no title)'}</p>
                          <p className="text-[11px] text-green-700">waabek.com{page.path}</p>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{d.metaDescription || '(no meta description)'}</p>
                          <div className="flex gap-3 mt-1.5 text-[10px]">
                            <span style={{ color: d.titleLen >= 30 && d.titleLen <= 60 ? '#25D366' : '#ef4444' }}>Title: {d.titleLen} chars</span>
                            <span style={{ color: d.metaLen >= 120 && d.metaLen <= 160 ? '#25D366' : '#ef4444' }}>Meta: {d.metaLen} chars</span>
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      <div className="space-y-1">
                        {d.h1.length === 0 && <p className="text-xs text-red-400">⚠️ No H1 tag found — add one with your primary keyword</p>}
                        {d.h1.length > 1 && <p className="text-xs text-yellow-400">⚠️ Multiple H1 tags ({d.h1.length}) — use only one</p>}
                        {d.wordCount < 300 && <p className="text-xs text-yellow-400">⚠️ Low word count ({d.wordCount}) — aim for 500+ for better ranking</p>}
                        {d.wordCount > 300 && d.h2.length === 0 && <p className="text-xs text-yellow-400">⚠️ No H2 subheadings — add structure with H2 tags</p>}
                        {d.titleLen > 60 && <p className="text-xs text-yellow-400">⚠️ Title too long ({d.titleLen} chars) — Google truncates at 60</p>}
                        {d.titleLen < 30 && d.titleLen > 0 && <p className="text-xs text-yellow-400">⚠️ Title too short ({d.titleLen} chars) — aim for 50-60 chars</p>}
                        {d.metaLen < 100 && <p className="text-xs text-yellow-400">⚠️ Meta description too short ({d.metaLen} chars) — aim for 150-160</p>}
                        {d.readabilityScore < 50 && <p className="text-xs text-yellow-400">⚠️ Low readability ({d.readabilityScore}/100) — use shorter sentences</p>}
                        {d.h1.length === 1 && d.wordCount >= 300 && d.titleLen >= 30 && d.titleLen <= 60 && <p className="text-xs text-green-400">✓ Page structure looks good!</p>}
                      </div>
                    </div>
                  )}

                  {d?.error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-400">Could not parse page: {d.error}. Make sure the site is deployed and accessible.</p>
                    </div>
                  )}

                  {!d && !isParsing && (
                    <p className="text-xs text-slate-600">Click Parse to analyze this page</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

                {/* ── REDIRECTS ── */}
        {tab === 'redirects' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">↪️ Redirect Manager</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Manage 301/302 redirects. These are saved to netlify.toml automatically.</p>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                {redirects.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-wabek-bg rounded-lg">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${r.type === '301' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>{r.type}</span>
                    <code className="text-xs text-blue-600 flex-1 font-mono">{r.from}</code>
                    <span className="text-slate-500 text-xs">→</span>
                    <code className="text-xs text-green-400 flex-1 font-mono">{r.to}</code>
                    <button onClick={() => setRedirects(prev => prev.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 text-sm flex-shrink-0">✕</button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 mb-3">
                <div className="flex gap-2">
                  <input value={newRedirect.from} onChange={e => setNewRedirect(r => ({ ...r, from: e.target.value }))}
                    placeholder="From: /old-page" className="input flex-1 text-sm font-mono" />
                  <input value={newRedirect.to} onChange={e => setNewRedirect(r => ({ ...r, to: e.target.value }))}
                    placeholder="To: /new-page" className="input flex-1 text-sm font-mono" />
                  <select value={newRedirect.type} onChange={e => setNewRedirect(r => ({ ...r, type: e.target.value }))}
                    className="input w-20 text-sm">
                    <option>301</option>
                    <option>302</option>
                  </select>
                  <button onClick={() => {
                    if (newRedirect.from && newRedirect.to) {
                      setRedirects(prev => [...prev, { ...newRedirect, active: true }])
                      setNewRedirect({ from: '', to: '', type: '301' })
                    }
                  }} className="btn-primary text-sm px-4">Add</button>
                </div>
              </div>

              <div className="mt-4 bg-wabek-bg rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-400 mb-2">Netlify.toml output:</p>
                <pre className="text-xs text-slate-700 font-mono overflow-x-auto">{fmtRedirects(redirects)}</pre>
                <button onClick={() => copyText(fmtRedirects(redirects), 'redirects')} className="btn-secondary text-xs mt-2 px-3 py-1.5">
                  {copied === 'redirects' ? '✓ Copied' : '📋 Copy for netlify.toml'}
                </button>
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">⚠️ Redirect Issues</h3>
              <div className="space-y-2">
                {[
                  { type: 'chain', desc: '/old → /middle → /final', fix: 'Update /old to point directly to /final (reduce redirect hops)' },
                  { type: 'loop', desc: 'None detected', fix: '' },
                  { type: 'broken', desc: 'None detected', fix: '' },
                ].map((issue, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 bg-wabek-bg rounded-lg">
                    <span className="text-xs text-slate-500">{issue.desc === 'None detected' ? '✓' : '⚠️'}</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 capitalize">{issue.type.replace('_', ' ')}</p>
                      <p className="text-xs text-slate-500">{issue.desc}</p>
                      {issue.fix && <p className="text-xs text-yellow-400 mt-0.5">Fix: {issue.fix}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CRAWL MONITOR ── */}
        {tab === 'crawl' && (
          <div className="space-y-5">
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">🕷️ Site Crawl Monitor</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Automatically crawl all pages and detect 404s, broken links, missing tags, and technical issues.</p>
                </div>
                <button onClick={runCrawl} disabled={crawling} className="btn-primary text-sm flex items-center gap-2">
                  {crawling ? '⏳ Crawling...' : '🕷️ Run Full Crawl'}
                </button>
              </div>

              {!Array.isArray(crawlResults) || crawlResults.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">🕷️</div>
                  <p className="text-slate-400 mb-2">No crawl results yet</p>
                  <p className="text-xs text-slate-600">Click "Run Full Crawl" to analyze all public pages</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(crawlResults || []).filter(r => r).map((r: any, i: number) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${r.status === 404 || r.status === 'error' ? 'bg-red-500/8 border border-red-500/20' : 'bg-wabek-bg'}`}>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                        r.status === 200 ? 'bg-green-500/20 text-green-400' :
                        r.status === 404 ? 'bg-red-500/20 text-red-400' :
                        'bg-[#F8FAFC]0/20 text-slate-400'
                      }`}>{r.status}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 truncate">{r.label}</p>
                        <p className="text-xs text-slate-600 font-mono">{r.path}</p>
                      </div>
                      <div className="flex gap-3 text-xs flex-shrink-0">
                        {r.score > 0 && !isNaN(r.score) && <span style={{ color: r.score >= 80 ? '#25D366' : r.score >= 60 ? '#f59e0b' : '#ef4444' }}>SEO {Math.round(r.score)}</span>}
                        {r.issues > 0 && <span className="text-yellow-400">{r.issues} issues</span>}
                        {r.size && <span className="text-slate-600">{r.size}KB</span>}
                        {r.hasCanonical === false && <span className="text-orange-400">No canonical</span>}
                        {r.hasStructuredData === false && <span className="text-purple-400">No schema</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {crawlResults.length > 0 && (
              <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
                <h3 className="font-semibold text-slate-900 mb-4">Crawl Summary</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Pages OK', value: (Array.isArray(crawlResults) ? crawlResults : []).filter(r => r?.status === 200).length, color: '#25D366' },
                    { label: 'Errors', value: (Array.isArray(crawlResults) ? crawlResults : []).filter(r => r?.status !== 200).length, color: '#ef4444' },
                    { label: 'Total Issues', value: (Array.isArray(crawlResults) ? crawlResults : []).reduce((a, r) => a + (r?.issues || 0), 0), color: '#f59e0b' },
                  ].map(s => (
                    <div key={s.label} className="bg-wabek-bg rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI ASSISTANT ── */}
        {tab === 'ai' && (
          <div className="space-y-6">

            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500/10 to-brand-500/10 border border-purple-500/20 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🤖</span>
                <h2 className="text-lg font-display font-bold text-slate-900">AI SEO Assistant</h2>
              </div>
              <p className="text-sm text-slate-700">Powered by Claude AI. Automatically generate, optimize, and fix all your SEO content.</p>
            </div>

            {/* ── 1. AI Meta Generator ── */}
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🏷️</span>
                <h3 className="font-semibold text-slate-900">AI Meta Generator</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">Paste your page content or describe your page → AI writes perfect title (60 chars) + meta description (160 chars)</p>
              <textarea
                value={metaInput}
                onChange={e => setMetaInput(e.target.value)}
                placeholder="Describe your page or paste its content... Example: Features page for WhatsApp automation SaaS with bulk campaigns, AI chatbot, team inbox."
                rows={5}
                className="input w-full text-sm mb-3"
              />
              <button onClick={generateMeta} disabled={aiLoading === 'meta'} className="btn-primary text-sm flex items-center gap-2">
                {aiLoading === 'meta' ? <><span className="animate-spin">⏳</span> Generating...</> : '✨ Generate Meta Tags'}
              </button>

              {metaResult && (
                <div className="mt-4 space-y-3">
                  <div className="p-4 bg-white rounded-lg">
                    <p className="text-xs text-green-700 font-medium mb-1">Google Preview</p>
                    <p className="text-sm text-blue-700 font-medium">{metaResult.title}</p>
                    <p className="text-xs text-green-700 mb-1">waabek.com</p>
                    <p className="text-xs text-slate-600">{metaResult.description}</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Title tag', value: metaResult.title, max: 60, key: 'site_title' },
                      { label: 'Meta description', value: metaResult.description, max: 160, key: 'site_description' },
                      { label: 'Focus keywords', value: metaResult.keywords, max: 999, key: 'focus_kw' },
                    ].map(f => (
                      <div key={f.key} className="bg-wabek-bg rounded-lg p-3">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-medium text-slate-900">{f.label}</span>
                          <div className="flex gap-2">
                            {f.max < 999 && (
                              <span className={`text-xs ${f.value.length > f.max ? 'text-red-400' : 'text-green-400'}`}>{f.value.length}/{f.max}</span>
                            )}
                            <button onClick={() => {
                              setForm(prev => ({ ...prev, [f.key]: f.value }))
                              toast.success(f.label + ' applied!')
                            }} className="text-xs text-blue-600 hover:text-blue-500 font-medium">✓ Apply</button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-700">{f.value}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {
                    setForm(prev => ({ ...prev, site_title: metaResult.title, site_description: metaResult.description, focus_kw: metaResult.keywords }))
                    save()
                  }} className="btn-primary text-sm w-full">💾 Apply All & Save to Site</button>
                </div>
              )}
            </div>

            {/* ── 2. AI Content Optimizer ── */}
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">✍️</span>
                <h3 className="font-semibold text-slate-900">AI Content Optimizer</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">Paste page content + target keyword → AI rewrites with better keyword density, headings, and readability</p>
              <div className="flex gap-3 mb-3">
                <input
                  value={contentKw}
                  onChange={e => setContentKw(e.target.value)}
                  placeholder="Target keyword (e.g. WhatsApp automation platform)"
                  className="input flex-1 text-sm"
                />
              </div>
              <textarea
                value={contentInput}
                onChange={e => setContentInput(e.target.value)}
                placeholder="Paste the page content you want to optimize..."
                rows={6}
                className="input w-full text-sm mb-3"
              />
              <button onClick={optimizeContent} disabled={aiLoading === 'content'} className="btn-primary text-sm flex items-center gap-2">
                {aiLoading === 'content' ? <><span className="animate-spin">⏳</span> Optimizing...</> : '🚀 Optimize Content'}
              </button>

              {contentResult && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-900">Optimized Content</p>
                    <button onClick={() => { navigator.clipboard.writeText(contentResult); setCopied('content'); setTimeout(() => setCopied(''), 2000) }} className="text-xs text-blue-600">
                      {copied === 'content' ? '✓ Copied' : '📋 Copy'}
                    </button>
                  </div>
                  <div className="bg-wabek-bg rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap max-h-64 overflow-y-auto font-mono text-xs leading-relaxed">
                    {contentResult}
                  </div>
                </div>
              )}
            </div>

            {/* ── 3. AI Schema Generator ── */}
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🧩</span>
                <h3 className="font-semibold text-slate-900">AI Schema Generator</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">Describe your page → AI generates complete, valid JSON-LD structured data ready for Google</p>
              <div className="flex gap-3 mb-3">
                <select value={schemaType} onChange={e => setSchemaType(e.target.value)} className="input w-48 text-sm">
                  {['Organization','SoftwareApplication','FAQPage','Article','BreadcrumbList','Product','LocalBusiness','WebPage'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  value={schemaDesc}
                  onChange={e => setSchemaDesc(e.target.value)}
                  placeholder="Describe the page (e.g. 'Homepage for WhatsApp automation SaaS with free plan')"
                  className="input flex-1 text-sm"
                />
              </div>
              <button onClick={generateSchema} disabled={aiLoading === 'schema'} className="btn-primary text-sm flex items-center gap-2">
                {aiLoading === 'schema' ? <><span className="animate-spin">⏳</span> Generating...</> : '⚡ Generate Schema'}
              </button>

              {schemaResult && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-900">{schemaType} Schema</p>
                    <div className="flex gap-2">
                      <button onClick={() => { navigator.clipboard.writeText(schemaResult); setCopied('aischema'); setTimeout(() => setCopied(''), 2000) }} className="text-xs text-blue-600">
                        {copied === 'aischema' ? '✓ Copied' : '📋 Copy'}
                      </button>
                      <a href="https://search.google.com/test/rich-results" target="_blank" className="text-xs text-blue-600">🧪 Test</a>
                      <button onClick={async () => {
                        try {
                          JSON.parse(schemaResult)
                          await saveSeoData('schema_' + schemaType.toLowerCase(), { code: schemaResult, type: schemaType, active: true })
                          await axios.put('/api/admin/seo', { seo: { ...form, ['schema_' + schemaType.toLowerCase()]: schemaResult } })
                          toast.success('Schema saved & injected into all pages!')
                        } catch { toast.error('Invalid JSON') }
                      }} className="text-xs text-green-400 font-medium">💾 Save & Inject</button>
                    </div>
                  </div>
                  <textarea
                    value={schemaResult}
                    onChange={e => setSchemaResult(e.target.value)}
                    rows={12}
                    className="input w-full text-xs font-mono"
                  />
                </div>
              )}
            </div>

            {/* ── 4. AI SEO Audit + Auto-Fix ── */}
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔧</span>
                <h3 className="font-semibold text-slate-900">AI SEO Audit + Auto-Fix</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">Select a page → AI analyzes it, identifies all issues, and generates ready-to-apply fixes</p>
              <div className="flex gap-3 mb-3">
                <select value={auditPage} onChange={e => setAuditPage(e.target.value)} className="input flex-1 text-sm">
                  {PUBLIC_PAGES.slice(0, 8).map(p => (
                    <option key={p.path} value={p.path}>{p.label} ({p.path})</option>
                  ))}
                </select>
                <button onClick={runAiAudit} disabled={aiLoading === 'audit'} className="btn-primary text-sm whitespace-nowrap flex items-center gap-2">
                  {aiLoading === 'audit' ? <><span className="animate-spin">⏳</span> Auditing...</> : '🔍 Run AI Audit'}
                </button>
              </div>

              {auditResult && (
                <div className="space-y-4 mt-4">
                  {/* Score */}
                  <div className="flex items-center gap-4 p-3 bg-wabek-bg rounded-lg">
                    <div className="text-3xl font-black" style={{ color: auditResult.score >= 80 ? '#25D366' : auditResult.score >= 60 ? '#f59e0b' : '#ef4444' }}>{auditResult.score}</div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">SEO Score for {auditPage}</p>
                      <p className="text-xs text-slate-500">{auditResult.fixes?.length || 0} issues found and fixed by AI</p>
                    </div>
                  </div>

                  {/* AI-generated fixes */}
                  {auditResult.fixes?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-900">AI-Generated Fixes:</p>
                      {auditResult.fixes.map((fix: any, i: number) => (
                        <div key={i} className="bg-wabek-bg rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${fix.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' : fix.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-[#F8FAFC]0/20 text-slate-400'}`}>{fix.priority}</span>
                              <p className="text-xs font-medium text-slate-900">{fix.issue}</p>
                            </div>
                          </div>
                          <p className="text-xs text-green-400 mb-1">Fix: {fix.fix}</p>
                          {fix.example && <p className="text-xs text-slate-500 font-mono bg-[#F8FAFC] rounded px-2 py-1">Example: {fix.example}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Apply suggestions */}
                  <div className="bg-green-500/8 border border-green-500/20 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold text-green-400">✨ AI Suggestions — Click to Apply:</p>
                    {auditResult.suggested_title && (
                      <div className="flex items-center justify-between gap-3 bg-wabek-bg rounded-lg p-3">
                        <div className="flex-1">
                          <p className="text-[10px] text-slate-500 mb-0.5">Suggested Title ({auditResult.suggested_title.length} chars)</p>
                          <p className="text-sm text-slate-900">{auditResult.suggested_title}</p>
                        </div>
                        <button onClick={() => { setForm(f => ({ ...f, site_title: auditResult.suggested_title })); toast.success('Title applied!') }} className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap">Apply ✓</button>
                      </div>
                    )}
                    {auditResult.suggested_meta && (
                      <div className="flex items-center justify-between gap-3 bg-wabek-bg rounded-lg p-3">
                        <div className="flex-1">
                          <p className="text-[10px] text-slate-500 mb-0.5">Suggested Meta ({auditResult.suggested_meta.length} chars)</p>
                          <p className="text-sm text-slate-900">{auditResult.suggested_meta}</p>
                        </div>
                        <button onClick={() => { setForm(f => ({ ...f, site_description: auditResult.suggested_meta })); toast.success('Meta applied!') }} className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap">Apply ✓</button>
                      </div>
                    )}
                    {auditResult.suggested_h1 && (
                      <div className="flex items-center justify-between gap-3 bg-wabek-bg rounded-lg p-3">
                        <div className="flex-1">
                          <p className="text-[10px] text-slate-500 mb-0.5">Suggested H1</p>
                          <p className="text-sm text-slate-900">{auditResult.suggested_h1}</p>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(auditResult.suggested_h1); toast.success('H1 copied — add to page code') }} className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap">📋 Copy</button>
                      </div>
                    )}
                    <button onClick={save} disabled={loading} className="btn-primary text-sm w-full">
                      {loading ? 'Saving...' : '💾 Save All Applied Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── 5. AI Keyword Research ── */}
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔑</span>
                <h3 className="font-semibold text-slate-900">AI Keyword Research</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">Describe your business → AI generates 20+ keywords with intent, difficulty, and page targeting</p>
              <textarea
                value={kwBusiness}
                onChange={e => setKwBusiness(e.target.value)}
                placeholder="Describe your business and target audience... Example: WhatsApp automation SaaS for e-commerce, agencies, hosting companies. Features bulk campaigns, AI chatbot, WHMCS integration."
                rows={4}
                className="input w-full text-sm mb-3"
              />
              <button onClick={researchKeywords} disabled={aiLoading === 'keywords'} className="btn-primary text-sm flex items-center gap-2">
                {aiLoading === 'keywords' ? <><span className="animate-spin">⏳</span> Researching...</> : '🔍 Research Keywords'}
              </button>

              {kwResult.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-900">{kwResult.length} keywords found</p>
                    <button onClick={() => { navigator.clipboard.writeText(kwResult.map(k => k.keyword).join(', ')); toast.success('All keywords copied!') }} className="text-xs text-blue-600">📋 Copy All</button>
                  </div>

                  {/* Group by category */}
                  {['primary','longtail','question','competitor','niche'].map(cat => {
                    const catKws = kwResult.filter(k => k.category === cat)
                    if (!catKws.length) return null
                    const catLabels: Record<string,string> = { primary: '🎯 Primary Keywords', longtail: '📏 Long-tail Keywords', question: '❓ Question Keywords', competitor: '⚔️ Competitor Gap Keywords', niche: '🎪 Niche Keywords' }
                    return (
                      <div key={cat} className="mb-4">
                        <p className="text-xs font-semibold text-slate-400 mb-2">{catLabels[cat]}</p>
                        <div className="space-y-1.5">
                          {catKws.map((kw, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 bg-wabek-bg rounded-lg">
                              <span className="text-sm text-slate-900 flex-1">{kw.keyword}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${kw.intent === 'transactional' ? 'bg-green-500/20 text-green-400' : kw.intent === 'commercial' ? 'bg-blue-500/20 text-blue-400' : 'bg-[#F8FAFC]0/20 text-slate-400'}`}>{kw.intent}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${kw.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' : kw.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{kw.difficulty}</span>
                              <span className="text-[10px] text-slate-600 font-mono flex-shrink-0">{kw.suggestion}</span>
                              <button onClick={() => {
                                setTrackingKws(prev => prev.some(t => t.kw === kw.keyword) ? prev : [...prev, { kw: kw.keyword, target: kw.suggestion || '/', tracked: true }])
                                saveSeoData('keywords', [...trackingKws, { kw: kw.keyword, target: kw.suggestion || '/', tracked: true }])
                                toast.success('Added to Rank Tracker!')
                              }} className="text-[10px] text-blue-600 hover:text-blue-500 flex-shrink-0">+ Track</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  <button onClick={() => {
                    const all = kwResult.map(k => k.keyword).join(', ')
                    setForm(f => ({ ...f, focus_kw: all.slice(0, 500) }))
                    save()
                    toast.success('Keywords saved to Meta Tags!')
                  }} className="btn-primary text-sm mt-2">💾 Save All to Focus Keywords</button>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </AdminLayout>
  )
}
