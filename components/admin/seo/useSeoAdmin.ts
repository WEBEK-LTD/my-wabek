/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAdminT, useApiError } from '../i18n'
import {
  DEFAULT_COMPETITORS, DEFAULT_FORM, DEFAULT_REDIRECTS, DEFAULT_TRACKING, PUBLIC_PAGES, SCHEMA_TEMPLATES,
} from './data'
import messages from '@/locales/admin/seo/actions'

export type SeoForm = typeof DEFAULT_FORM & Record<string, any>
export interface Redirect { from: string; to: string; type: string; active?: boolean }
export interface TrackedKw { kw: string; target: string; tracked?: boolean }
export interface Competitor { domain: string; name: string; da: number; traffic: number; keywords: number; backlinks: number }

const origin = () => (typeof window !== 'undefined' ? window.location.origin : '')

/**
 * All state and server calls of the SEO manager (formerly inline in
 * pages/admin/seo.tsx). Tabs receive the returned object.
 */
export function useSeoAdmin() {
  const { t, tn } = useAdminT(messages)
  const apiError = useApiError()
  const [tab, setTab] = useState('overview')
  const [pageScores, setPageScores] = useState<Record<string, any>>({})
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analyzeAll, setAnalyzeAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedSchema, setSelectedSchema] = useState('Organization')
  const [schemaCode, setSchemaCode] = useState(SCHEMA_TEMPLATES.Organization)
  const [form, setForm] = useState<SeoForm>(DEFAULT_FORM as SeoForm)
  const [formLoaded, setFormLoaded] = useState(false)
  // Auto-save effects only run after the stored data has been loaded, so the
  // defaults never overwrite what is in the database on first render.
  const hydrated = useRef(false)

  /* ── Persistence helpers ── */
  const loadSeoData = async (type: string) => {
    try { const { data } = await axios.get('/api/admin/seo-data?type=' + type); return data.data } catch { return null }
  }
  const saveSeoData = async (type: string, data: any) => {
    try { await axios.post('/api/admin/seo-data', { type, data }) } catch { /* best effort */ }
  }

  /* ── Google Search Console ── */
  const [gscStatus, setGscStatus] = useState<any>(null)
  const [gscLoading, setGscLoading] = useState(false)
  const [gscData, setGscData] = useState<any[] | null>(null)
  const [gscPages, setGscPages] = useState<any[]>([])
  const [gscSummary, setGscSummary] = useState<any>(null)
  const [gscSites, setGscSites] = useState<any[]>([])
  const [gscSite, setGscSite] = useState('https://waabek.com/')
  const [gscRange, setGscRange] = useState('28')
  const [gscConnecting, setGscConnecting] = useState(false)

  const loadGscStatus = async () => {
    try { const { data } = await axios.get('/api/admin/gsc-oauth'); setGscStatus(data) } catch { /* not connected */ }
  }
  const connectGsc = async () => {
    setGscConnecting(true)
    try {
      const { data } = await axios.post('/api/admin/gsc-oauth', { action: 'connect' })
      if (data.url) window.location.href = data.url
      else toast.error(apiError.text(data.error) || t('connectionFailed'))
    } catch (e: any) { toast.error(apiError(e, t('failedStartOauth'))) }
    setGscConnecting(false)
  }
  const disconnectGsc = async () => {
    await axios.post('/api/admin/gsc-oauth', { action: 'disconnect' })
    setGscStatus({ connected: false })
    setGscData(null)
    setGscSummary(null)
    toast.success(t('disconnectedGoogleSearchConsole'))
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
    } catch (e: any) { toast.error(apiError(e, t('failedLoadGscData'))) }
    setGscLoading(false)
  }
  const loadGscSites = async () => {
    try { const { data } = await axios.get('/api/admin/gsc-data?type=sites'); setGscSites(data.sites || []) } catch { /* ignore */ }
  }

  // OAuth result in the URL (?gsc_success / ?gsc_error)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('gsc_success')) {
      toast.success(t('connectedGoogleSearchConsole'))
      window.history.replaceState({}, '', window.location.pathname)
      loadGscStatus()
      setTab('gsc')
      setTimeout(() => loadGscData(), 1000)
    }
    if (params.get('gsc_error')) {
      toast.error(t('gscConnectionFailed', { error: apiError.text(params.get('gsc_error')) }))
      window.history.replaceState({}, '', window.location.pathname)
    }
    loadGscStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── HTML parse (links/content) ── */
  const [parsedPages, setParsedPages] = useState<Record<string, any>>({})
  const [parsing, setParsing] = useState<string | null>(null)
  const [parseAll, setParseAll] = useState(false)
  const parsePage = async (path: string) => {
    setParsing(path)
    try {
      const { data } = await axios.post('/api/admin/seo-parse', { url: origin() + path })
      setParsedPages(prev => { const updated = { ...prev, [path]: data }; saveSeoData('parsed_pages', updated); return updated })
    } catch (e) { console.error('Parse failed', e) }
    setParsing(null)
  }
  const runParseAll = async () => {
    setParseAll(true)
    for (const page of PUBLIC_PAGES.slice(0, 7)) {
      await parsePage(page.path)
      await new Promise(r => setTimeout(r, 200))
    }
    setParseAll(false)
    toast.success(t('allPagesParsed'))
  }

  /* ── AI assistant ── */
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [metaInput, setMetaInput] = useState('')
  const [metaResult, setMetaResult] = useState<{ title: string; description: string; keywords: string } | null>(null)
  const [contentInput, setContentInput] = useState('')
  const [contentKw, setContentKw] = useState('')
  const [contentResult, setContentResult] = useState('')
  const [schemaDesc, setSchemaDesc] = useState('')
  const [schemaType, setSchemaType] = useState('Organization')
  const [schemaResult, setSchemaResult] = useState('')
  const [auditPage, setAuditPage] = useState('/')
  const [auditResult, setAuditResult] = useState<any>(null)
  const [kwBusiness, setKwBusiness] = useState('')
  const [kwResult, setKwResult] = useState<any[]>([])

  /* ── Rank tracking / competitors / redirects ── */
  const [rankHistory, setRankHistory] = useState<Record<string, Record<string, number>>>({})
  const [trackingKws, setTrackingKws] = useState<TrackedKw[]>(DEFAULT_TRACKING)
  const [newKw, setNewKw] = useState('')
  const [competitors, setCompetitors] = useState<Competitor[]>(DEFAULT_COMPETITORS)
  const [newCompetitor, setNewCompetitor] = useState('')
  const [redirects, setRedirects] = useState<Redirect[]>(DEFAULT_REDIRECTS)
  const [newRedirect, setNewRedirect] = useState({ from: '', to: '', type: '301' })

  /* ── Crawl ── */
  const [crawlResults, setCrawlResults] = useState<any[]>([])
  const [crawling, setCrawling] = useState(false)
  const runCrawl = async () => {
    setCrawling(true)
    const results: any[] = []
    for (const page of PUBLIC_PAGES.slice(0, 10)) {
      try {
        const res = await axios.post('/api/admin/seo-analyze', { url: origin() + page.path })
        results.push({
          path: page.path, label: page.label,
          status: (res.data?.score != null && res.data.score > 0) ? 200 : (res.data?.status || 200),
          score: res.data?.score || 0, issues: res.data?.issues?.length || 0, size: res.data?.sizeKB || 0,
          hasCanonical: res.data?.hasCanonical ?? true, hasStructuredData: res.data?.hasStructuredData ?? false,
        })
      } catch {
        results.push({ path: page.path, label: page.label, status: 'error', score: 0, issues: 1 })
      }
      await new Promise(r => setTimeout(r, 100))
    }
    setCrawlResults(results)
    setCrawling(false)
    toast.success(t('crawlComplete'))
  }

  /* ── PageSpeed ── */
  const [speedData, setSpeedData] = useState<Record<string, any>>({})
  const [speedLoading, setSpeedLoading] = useState<string | null>(null)
  const checkSpeed = async (path: string) => {
    setSpeedLoading(path)
    try {
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(origin() + path)}&strategy=mobile`
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
        } }))
      } else {
        setSpeedData(prev => ({ ...prev, [path]: { error: true, status: res.status } }))
      }
    } catch {
      setSpeedData(prev => ({ ...prev, [path]: { error: true } }))
    }
    setSpeedLoading(null)
  }

  /* ── Initial load ── */
  useEffect(() => {
    const tasks: Promise<unknown>[] = [
      axios.get('/api/admin/seo').then(r => { if (r.data?.seo) setForm(f => ({ ...f, ...r.data.seo })) }).catch(() => {}).finally(() => setFormLoaded(true)),
      loadSeoData('page_scores').then(d => {
        if (!d) return
        const cleaned: Record<string, any> = {}
        const valid = new Set(PUBLIC_PAGES.map(p => p.path))
        Object.entries(d).forEach(([k, v]) => {
          const path = k.startsWith('http') ? k.replace(/^https?:\/\/[^/]+/, '') : k
          if (valid.has(path)) cleaned[path] = v
        })
        setPageScores(cleaned)
      }),
      loadSeoData('redirects').then(d => { if (d) setRedirects(d) }),
      loadSeoData('crawl').then(d => {
        if (!d) return
        const arr = Array.isArray(d) ? d : Object.values(d)
        setCrawlResults(arr.filter((r: any) => r && typeof r === 'object'))
      }),
      loadSeoData('keywords').then(d => { if (d) setTrackingKws(d) }),
      loadSeoData('competitors').then(d => { if (d) setCompetitors(d) }),
      loadSeoData('ranks').then(d => { if (d) setRankHistory(d) }),
      loadSeoData('parsed_pages').then(d => { if (d) setParsedPages(d) }),
    ]
    Promise.allSettled(tasks).then(() => { setTimeout(() => { hydrated.current = true }, 0) })
  }, [])

  /* ── Auto-save (after hydration) ── */
  useEffect(() => { if (hydrated.current && Object.keys(pageScores).length > 0) saveSeoData('page_scores', pageScores) }, [pageScores])
  useEffect(() => { if (hydrated.current && redirects.length > 0) saveSeoData('redirects', redirects) }, [redirects])
  useEffect(() => { if (hydrated.current && crawlResults.length > 0) saveSeoData('crawl', crawlResults) }, [crawlResults])
  useEffect(() => { if (hydrated.current) saveSeoData('keywords', trackingKws) }, [trackingKws])
  useEffect(() => { if (hydrated.current) saveSeoData('competitors', competitors) }, [competitors])

  /* ── Analyzer ── */
  const analyzePage = async (path: string) => {
    setAnalyzing(path)
    try {
      const { data } = await axios.post('/api/admin/seo-analyze', { url: origin() + path })
      setPageScores(prev => ({ ...prev, [path]: data }))
    } catch {
      // Keep the failure visible instead of inventing scores.
      setPageScores(prev => ({ ...prev, [path]: {
        error: true, score: null, indexed: false,
        issues: [t('couldNotFetchPage')],
      } }))
    }
    setAnalyzing(null)
  }
  const runAnalyzeAll = async () => {
    setAnalyzeAll(true)
    for (const p of PUBLIC_PAGES) {
      await analyzePage(p.path)
      await new Promise(r => setTimeout(r, 150))
    }
    setAnalyzeAll(false)
    toast.success(t('analyzedPages', { PUBLIC_PAGESCount: PUBLIC_PAGES.length }))
  }

  /** Saves the whole seo_settings object; pass `next` when the state update hasn't landed yet. */
  const save = async (next?: SeoForm) => {
    setSaving(true)
    try {
      await axios.put('/api/admin/seo', { seo: next || form })
      toast.success(t('seoSettingsSaved'))
    } catch { toast.error(t('saveFailed')) }
    finally { setSaving(false) }
  }
  const applyAndSave = (patch: Partial<SeoForm>) => { const next = { ...form, ...patch } as SeoForm; setForm(next); return save(next) }

  const saveSchema = async (type: string, code: string) => {
    try {
      JSON.parse(code)
      await saveSeoData('schema_' + type.toLowerCase(), { code, type, active: true })
      const next = { ...form, ['schema_' + type.toLowerCase()]: code } as SeoForm
      await axios.put('/api/admin/seo', { seo: next })
      setForm(next)
      toast.success(t('schemaSavedWillInjected', { type }))
    } catch { toast.error(t('invalidJsonPleaseFix')) }
  }

  /* ── AI helpers ── */
  const callClaude = async (prompt: string, maxTokens = 800): Promise<string> => {
    const res = await fetch('/api/ai/seo-assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, maxTokens }) })
    if (!res.ok) throw new Error('AI request failed')
    const data = await res.json()
    return data.result || ''
  }

  const generateMeta = async () => {
    if (!metaInput.trim()) return void toast.error(t('pleaseProvidePageContent'))
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
      setMetaResult(JSON.parse(raw.replace(/```json|```/g, '').trim()))
      toast.success(t('metaTagsGenerated'))
    } catch { toast.error(t('generationFailedTryAgain')) }
    setAiLoading(null)
  }

  const optimizeContent = async () => {
    if (!contentInput.trim() || !contentKw.trim()) return void toast.error(t('pleaseProvideContentTarget'))
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
      setContentResult(await callClaude(prompt, 1200))
      toast.success(t('contentOptimized'))
    } catch { toast.error(t('optimizationFailedTryAgain')) }
    setAiLoading(null)
  }

  const generateSchema = async () => {
    if (!schemaDesc.trim()) return void toast.error(t('pleaseDescribePage'))
    setAiLoading('schema')
    try {
      const schemaExamples: Record<string, string> = {
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
      const clean = (await callClaude(prompt, 600)).replace(/```json|```/g, '').trim()
      JSON.parse(clean)
      setSchemaResult(clean)
      toast.success(t('schemaGenerated'))
    } catch { toast.error(t('schemaGenerationFailedTry')) }
    setAiLoading(null)
  }

  const runAiAudit = async () => {
    setAiLoading('audit')
    try {
      const { data: analysis } = await axios.post('/api/admin/seo-analyze', { url: origin() + auditPage })
      const issues = analysis.issues || []
      const issuesText = issues.map((iss: string, i: number) => (i + 1) + '. ' + iss).join('\n')
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
      const result = JSON.parse((await callClaude(prompt, 1000)).replace(/```json|```/g, '').trim())
      result.analysis = analysis
      setAuditResult(result)
      toast.success(t('aiAuditComplete'))
    } catch { toast.error(t('auditFailedMakeSure')) }
    setAiLoading(null)
  }

  const researchKeywords = async () => {
    if (!kwBusiness.trim()) return void toast.error(t('pleaseDescribeBusiness'))
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
      const result = JSON.parse((await callClaude(prompt, 1500)).replace(/```json|```/g, '').trim())
      setKwResult(result)
      toast.success(tn('keywordsGenerated', result.length, { n: result.length }))
    } catch { toast.error(t('keywordResearchFailedTry')) }
    setAiLoading(null)
  }

  const trackKeyword = (kw: string, target = '/') => setTrackingKws(prev => (prev.some(t => t.kw === kw) ? prev : [...prev, { kw, target, tracked: true }]))

  /* ── Derived ── */
  const validPaths = new Set(PUBLIC_PAGES.map(p => p.path))
  const analyzedEntries = Object.entries(pageScores).filter(([k, v]) => (validPaths.has(k) || k.startsWith('/')) && v && !v.error)
  const analyzed = Math.min(analyzedEntries.length, PUBLIC_PAGES.length)
  const avgScore = analyzed > 0 ? Math.round(analyzedEntries.reduce((a, [, b]) => a + (Number(b.score) || 0), 0) / analyzed) : null
  const indexed = analyzedEntries.filter(([, p]) => p.indexed).length
  const issues = analyzedEntries.reduce((a, [, p]) => a + (p.issues?.length || 0), 0)

  /** Real positions from GSC for tracked keywords (null when unknown). */
  const gscRank = (kw: string): number | null => {
    const row = gscData?.find((r: any) => r.query?.toLowerCase().includes(kw.toLowerCase().split(' ')[0]))
    return row ? Math.round(row.position) : null
  }
  const saveRankSnapshot = () => {
    if (!gscData) { toast.error(t('loadSearchConsoleData')); return }
    const date = new Date().toISOString().split('T')[0]
    const snapshot: Record<string, number> = {}
    trackingKws.forEach(k => { const r = gscRank(k.kw); if (r) snapshot[k.kw] = r })
    if (!Object.keys(snapshot).length) { toast.error(t('noKnownPositionsTracked')); return }
    const updated = { ...rankHistory, [date]: snapshot }
    setRankHistory(updated)
    saveSeoData('ranks', updated)
    toast.success(t('snapshotSaved'))
  }

  return {
    tab, setTab, form, setForm, formLoaded, saving, save, applyAndSave,
    pageScores, analyzing, analyzeAll, analyzePage, runAnalyzeAll, analyzed, avgScore, indexed, issues,
    selectedSchema, setSelectedSchema, schemaCode, setSchemaCode, saveSchema,
    gscStatus, gscLoading, gscData, gscPages, gscSummary, gscSites, gscSite, setGscSite, gscRange, setGscRange, gscConnecting,
    connectGsc, disconnectGsc, loadGscData, loadGscSites, gscRank,
    parsedPages, parsing, parseAll, parsePage, runParseAll,
    aiLoading, metaInput, setMetaInput, metaResult, contentInput, setContentInput, contentKw, setContentKw, contentResult, setContentResult,
    schemaDesc, setSchemaDesc, schemaType, setSchemaType, schemaResult, setSchemaResult, auditPage, setAuditPage, auditResult,
    kwBusiness, setKwBusiness, kwResult, generateMeta, optimizeContent, generateSchema, runAiAudit, researchKeywords,
    rankHistory, saveRankSnapshot, trackingKws, setTrackingKws, newKw, setNewKw, trackKeyword,
    competitors, setCompetitors, newCompetitor, setNewCompetitor,
    redirects, setRedirects, newRedirect, setNewRedirect,
    crawlResults, crawling, runCrawl, speedData, speedLoading, checkSpeed,
  }
}

export type SeoState = ReturnType<typeof useSeoAdmin>

export const fmtRedirects = (rs: Redirect[]) =>
  rs.map(r => '[[redirects]]\n  from = "' + r.from + '"\n  to = "' + r.to + '"\n  status = ' + r.type).join('\n\n')
