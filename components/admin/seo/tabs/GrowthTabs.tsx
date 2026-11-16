import React, { useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  ArrowTopRightOnSquareIcon, ArrowUturnRightIcon, CameraIcon, ExclamationTriangleIcon, KeyIcon, LightBulbIcon, LinkIcon, PlusIcon, SignalIcon, TrashIcon, TrophyIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/20/solid'
import { Badge, Button, Input, Select, StatCard, Table, TBody, TD, TH, THead, TR, cn } from '@/components/ui'
import { useAdminT } from '../../i18n'
import { CopyButton, Notice } from '../../shared'
import { KEYWORD_DATA, LONGTAIL } from '../data'
import { fmtRedirects, type SeoState } from '../useSeoAdmin'
import { ListRow, SeoCard } from '../ui'
import messages from '@/locales/admin/seo/growth'

const rankTone = (r: number | null) => (r == null ? 'text-muted' : r <= 10 ? 'text-success' : r <= 20 ? 'text-warning' : 'text-danger')

/* ── Keywords ── */
export function KeywordsTab({ s }: { s: SeoState }) {
  const { t, fmtNumber } = useAdminT(messages)
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" padding="none" headerClassName="px-5 pt-5 sm:px-6" icon={KeyIcon} title={t('targetKeywordsPage')}
        subtitle={t('volumeDifficultyManualEstimates')}>
        <Table minWidth={520} dense caption={t('targetKeywords')}>
          <THead><TR><TH>{t('keyword')}</TH><TH align="end">{t('monthlyVolumeEst')}</TH><TH align="end">{t('difficulty')}</TH><TH>{t('targetPage')}</TH><TH><span className="sr-only">{t('track')}</span></TH></TR></THead>
          <TBody>
            {KEYWORD_DATA.map(k => (
              <TR key={k.kw}>
                <TD><span dir="ltr" lang="en" className="text-ink">{k.kw}</span></TD>
                <TD align="end"><span className="tabular font-mono text-xs text-success">{fmtNumber(k.vol)}</span></TD>
                <TD align="end"><Badge size="sm" tone={k.diff < 25 ? 'success' : k.diff < 40 ? 'warning' : 'danger'}>{k.diff}</Badge></TD>
                <TD><span dir="ltr" className="font-mono text-xs text-muted">{k.page}</span></TD>
                <TD align="end"><Button size="xs" variant="ghost" icon={PlusIcon} disabled={s.trackingKws.some(t => t.kw === k.kw)} onClick={() => { s.trackKeyword(k.kw, k.page); toast.success(t('addedRankTracker')) }}>{t('track')}</Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="px-5 pb-5 text-xs text-muted sm:px-6">{t('difficulty25Easy25')}</p>
      </SeoCard>
      <SeoCard className="xl:col-span-2" icon={LightBulbIcon} title={t('longTailOpportunities')}>
        <ul className="space-y-1.5">
          {LONGTAIL.map(kw => <li key={kw}><ListRow end={<CopyButton text={kw} />}><span dir="ltr" lang="en" className="block text-start text-xs text-ink">{kw}</span></ListRow></li>)}
        </ul>
      </SeoCard>
    </div>
  )
}

/* ── Rank tracker ── */
export function RankTab({ s }: { s: SeoState }) {
  const { t, fmtNumber } = useAdminT(messages)
  const connected = !!s.gscStatus?.connected
  const ranks = s.trackingKws.map(k => s.gscRank(k.kw))
  const known = ranks.filter((r): r is number => r != null)
  const dist = [
    { label: t('top3'), n: known.filter(r => r <= 3).length, tone: 'success' as const },
    { label: t('top10'), n: known.filter(r => r <= 10).length, tone: 'brand' as const },
    { label: t('top20'), n: known.filter(r => r <= 20).length, tone: 'warning' as const },
    { label: '20+', n: known.filter(r => r > 20).length, tone: 'danger' as const },
  ]
  const dates = Object.keys(s.rankHistory).sort().slice(-7)

  return (
    <div className="space-y-5">
      {!connected && (
        <Notice tone="warning" icon={ExclamationTriangleIcon} title={t('positionsComeGoogleSearch')}>
          <span>{t('connectSearchConsoleLoad')}</span>{' '}
          <button type="button" className="font-semibold underline" onClick={() => s.setTab('gsc')}>{t('connectGsc')}</button>
        </Notice>
      )}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {dist.map(d => <StatCard key={d.label} label={d.label} value={s.gscData ? fmtNumber(d.n) : '—'} sub={s.gscData ? t('data', { knownCount: known.length }) : t('loadGscData')} />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <SeoCard icon={SignalIcon} title={t('keywordRankTracker')} subtitle={connected ? t('realPositionsSearchConsole') : undefined}>
          <ul className="space-y-2">
            {s.trackingKws.map((k, i) => {
              const r = ranks[i]
              return (
                <li key={k.kw + i}>
                  <ListRow end={
                    <div className="flex items-center gap-3">
                      {r ? <span className={cn('tabular text-lg font-bold', rankTone(r))} dir="ltr">#{r}</span> : <span className="text-xs text-muted">{s.gscData ? t('notRanking') : '—'}</span>}
                      <Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={t('remove', { kw: k.kw })} onClick={() => s.setTrackingKws(prev => prev.filter((_, j) => j !== i))} />
                    </div>
                  }>
                    <p dir="ltr" lang="en" className="text-start text-sm text-ink">{k.kw}</p>
                    <p dir="ltr" className="text-start font-mono text-2xs text-muted">{k.target}</p>
                  </ListRow>
                </li>
              )
            })}
          </ul>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (s.newKw.trim()) { s.trackKeyword(s.newKw.trim()); s.setNewKw('') } }}>
            <Input dir="ltr" wrapperClassName="flex-1" value={s.newKw} onChange={e => s.setNewKw(e.target.value)} placeholder={t('addKeywordTrack')} aria-label={t('newKeyword')} />
            <Button type="submit" icon={PlusIcon} disabled={!s.newKw.trim()}>{t('add')}</Button>
          </form>
        </SeoCard>

        <SeoCard icon={CameraIcon} title={t('rankHistory')} subtitle={t('snapshotsRealSearchConsole')}
          action={<Button size="sm" variant="secondary" icon={CameraIcon} disabled={!s.gscData} onClick={s.saveRankSnapshot}>{t('saveTodaySSnapshot')}</Button>}>
          {dates.length === 0 ? (
            <p className="rounded-xl bg-surface-2 px-4 py-8 text-center text-sm text-muted">{t('noHistoryYetLoad')}</p>
          ) : (
            <>
              <Table minWidth={420} dense caption={t('rankHistory')}>
                <THead><TR><TH>{t('keyword')}</TH>{dates.map(d => <TH key={d} align="end"><span dir="ltr">{d.slice(5)}</span></TH>)}<TH align="end">{t('trend')}</TH></TR></THead>
                <TBody>
                  {s.trackingKws.slice(0, 8).map(k => {
                    const rs = dates.map(d => s.rankHistory[d]?.[k.kw] || null)
                    const first = rs.find(r => r !== null)
                    const last = [...rs].reverse().find(r => r !== null)
                    const trend = first && last ? first - last : 0
                    return (
                      <TR key={k.kw}>
                        <TD><span dir="ltr" lang="en" className="block max-w-[160px] truncate text-xs text-ink">{k.kw}</span></TD>
                        {rs.map((r, i) => <TD key={i} align="end"><span className={cn('tabular font-mono text-xs', rankTone(r))} dir="ltr">{r ? '#' + r : '—'}</span></TD>)}
                        <TD align="end"><span className={cn('tabular font-mono text-xs', trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-muted')} dir="ltr">{trend === 0 ? '—' : (trend > 0 ? '▲' : '▼') + Math.abs(trend)}</span></TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
              <p className="text-2xs text-muted">{t('last7SnapshotsImprovement')}</p>
            </>
          )}
        </SeoCard>
      </div>
    </div>
  )
}

/* ── Competitors ── */
export function CompetitorsTab({ s }: { s: SeoState }) {
  const { t, fmtNumber } = useAdminT(messages)
  const best = useMemo(() => ({
    da: Math.max(0, ...s.competitors.map(c => c.da || 0)),
    traffic: Math.max(0, ...s.competitors.map(c => c.traffic || 0)),
    keywords: Math.max(0, ...s.competitors.map(c => c.keywords || 0)),
    backlinks: Math.max(0, ...s.competitors.map(c => c.backlinks || 0)),
  }), [s.competitors])
  const gaps = [
    { label: t('domainAuthority'), v: best.da, tip: t('buildBacklinksHighDa') },
    { label: t('estimatedMonthlyTraffic'), v: best.traffic, tip: t('targetLongTailKeywords') },
    { label: t('rankingKeywords'), v: best.keywords, tip: t('publishPostsTargetingSpecific') },
    { label: t('backlinks'), v: best.backlinks, tip: t('guestPostsDirectoryListings') },
  ]
  const add = () => {
    const d = s.newCompetitor.trim()
    if (!d) return
    s.setCompetitors(prev => [...prev, { domain: d, name: d.split('.')[0], da: 0, traffic: 0, keywords: 0, backlinks: 0 }])
    s.setNewCompetitor('')
    toast.success(t('competitorAdded'))
  }
  return (
    <div className="space-y-5">
      <Notice tone="warning" icon={ExclamationTriangleIcon}>
        {t('competitorFiguresManuallyEntered')}
      </Notice>
      <SeoCard padding="none" headerClassName="px-5 pt-5 sm:px-6" icon={TrophyIcon} title={t('competitorAnalysis')}>
        <Table minWidth={640} dense caption={t('competitors')}>
          <THead><TR><TH>{t('domain')}</TH><TH align="end">DA</TH><TH align="end">{t('trafficEst')}</TH><TH align="end">{t('keywords')}</TH><TH align="end">{t('backlinks2')}</TH><TH><span className="sr-only">{t('actions')}</span></TH></TR></THead>
          <TBody>
            <TR selected>
              <TD><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-2xs font-bold text-[#04282C]">W</span><div><p dir="ltr" className="text-start font-medium text-ink">waabek.com</p><p className="text-2xs text-link">{t('you')}</p></div></div></TD>
              <TD align="end" className="text-muted">—</TD><TD align="end" className="text-muted">—</TD><TD align="end" className="text-muted">—</TD><TD align="end" className="text-muted">—</TD><TD />
            </TR>
            {s.competitors.map((c, i) => (
              <TR key={c.domain + i}>
                <TD><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3 text-2xs font-bold text-muted">{c.name?.[0]?.toUpperCase()}</span><div><p className="text-ink">{c.name}</p><p dir="ltr" className="text-start text-2xs text-muted">{c.domain}</p></div></div></TD>
                <TD align="end"><span className={cn('tabular font-mono', c.da > 60 ? 'text-danger' : c.da > 30 ? 'text-warning' : 'text-success')}>{c.da || '—'}</span></TD>
                <TD align="end" className="tabular font-mono text-body">{c.traffic ? fmtNumber(c.traffic) : '—'}</TD>
                <TD align="end" className="tabular font-mono text-body">{c.keywords ? fmtNumber(c.keywords) : '—'}</TD>
                <TD align="end" className="tabular font-mono text-body">{c.backlinks ? fmtNumber(c.backlinks) : '—'}</TD>
                <TD align="end"><Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={t('remove2', { domain: c.domain })} onClick={() => s.setCompetitors(prev => prev.filter((_, j) => j !== i))} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <form className="flex gap-2 px-5 pb-5 sm:px-6" onSubmit={e => { e.preventDefault(); add() }}>
          <Input dir="ltr" wrapperClassName="flex-1" value={s.newCompetitor} onChange={e => s.setNewCompetitor(e.target.value)} placeholder="domain.com" aria-label={t('competitorDomain')} />
          <Button type="submit" icon={PlusIcon} disabled={!s.newCompetitor.trim()}>{t('addCompetitor')}</Button>
        </form>
      </SeoCard>
      <SeoCard title={t('closingGap')} subtitle={t('highestValueAmongListed')}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {gaps.map(g => (
            <div key={g.label} className="rounded-xl bg-surface-2 p-3.5">
              <div className="flex items-baseline justify-between gap-2"><span className="text-sm text-ink">{g.label}</span><span className="tabular text-xs text-muted">{t('best')} {fmtNumber(g.v)}</span></div>
              <p className="mt-1.5 text-xs text-muted">{g.tip}</p>
            </div>
          ))}
        </div>
      </SeoCard>
    </div>
  )
}

/* ── Backlinks ── */
export function BacklinksTab() {
  const { t } = useAdminT(messages)
  const groups = [
    { cat: t('directories'), items: [
      { name: 'Product Hunt', url: 'https://producthunt.com', desc: t('submitAsWhatsappAutomation'), da: 91 },
      { name: 'G2', url: 'https://g2.com', desc: t('companyProfileWhatsappMarketing'), da: 88 },
      { name: 'Capterra', url: 'https://capterra.com', desc: t('chatbotSoftwareWhatsappMarketing'), da: 87 },
      { name: 'AlternativeTo', url: 'https://alternativeto.net', desc: t('addAsAlternativeTwilio'), da: 81 },
      { name: 'BetaList', url: 'https://betalist.com', desc: t('startupLaunchCoverage'), da: 68 },
    ] },
    { cat: t('guestPostsPr'), items: [
      { name: 'WHMCS Marketplace Blog', url: 'https://marketplace.whmcs.com', desc: t('tutorialHowAddWhatsapp'), da: 72 },
      { name: 'Wix Blog', url: 'https://support.wix.com', desc: t('pitchArticleWhatsappWix'), da: 95 },
      { name: 'WordPress.org', url: 'https://wordpress.org', desc: t('publishPluginDetailedDocs'), da: 99 },
      { name: 'DEV', url: 'https://dev.to', desc: t('whatsappApiTutorialsCode'), da: 82 },
    ] },
    { cat: t('community'), items: [
      { name: 'Reddit r/Entrepreneur', url: 'https://reddit.com/r/Entrepreneur', desc: t('shareCaseStudies'), da: 96 },
      { name: 'Indie Hackers', url: 'https://indiehackers.com', desc: t('postGrowthMilestones'), da: 78 },
      { name: 'WHMCS Forums', url: 'https://whmcs.community', desc: t('helpUsersIncludeTool'), da: 65 },
    ] },
  ]
  const ideas = [
    t('freeWhatsappMessageTemplate'),
    t('whatsappBusinessRoiCalculator'),
    t('whatsappVsEmailVs'),
    t('stateWhatsappBusiness2026'),
    t('freeChatbotFlowTemplate'),
    t('whatsappApiCostCalculator'),
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" icon={LinkIcon} title={t('backlinkStrategy')}>
        <Notice tone="info">{t('curatedListLinkOpportunities')}</Notice>
        {groups.map(g => (
          <div key={g.cat} className="space-y-2">
            <p className="eyebrow">{g.cat}</p>
            {g.items.map(it => (
              <ListRow key={it.name} end={<Button size="xs" variant="ghost" href={it.url} external iconEnd={ArrowTopRightOnSquareIcon}>{t('visit')}</Button>}>
                <div className="flex items-center gap-2"><p className="text-sm font-medium text-ink">{it.name}</p><Badge size="sm" tone="brand">DA ~{it.da}</Badge></div>
                <p className="text-xs text-muted">{it.desc}</p>
              </ListRow>
            ))}
          </div>
        ))}
      </SeoCard>
      <SeoCard className="xl:col-span-2" icon={LightBulbIcon} title={t('linkBaitContentIdeas')}>
        <ol className="space-y-2">{ideas.map((x, i) => <li key={i}><ListRow><div className="flex gap-2.5"><span className="tabular font-bold text-brand-ink">{i + 1}.</span><p className="text-sm text-ink">{x}</p></div></ListRow></li>)}</ol>
      </SeoCard>
    </div>
  )
}

/* ── Redirects ── */
export function RedirectsTab({ s }: { s: SeoState }) {
  const { t } = useAdminT(messages)
  // Real checks over the configured list.
  const issues = useMemo(() => {
    const byFrom = new Map(s.redirects.map(r => [r.from, r]))
    const chains: string[] = []
    const loops: string[] = []
    for (const r of s.redirects) {
      const seen = new Set([r.from])
      let cur = byFrom.get(r.to)
      const path = [r.from, r.to]
      while (cur) {
        if (seen.has(cur.from) || seen.has(cur.to)) { loops.push(path.join(' → ')); break }
        seen.add(cur.from); path.push(cur.to); cur = byFrom.get(cur.to)
      }
      if (path.length > 2 && !loops.includes(path.join(' → '))) chains.push(path.join(' → '))
    }
    const dupes = s.redirects.filter((r, i) => s.redirects.findIndex(x => x.from === r.from) !== i).map(r => r.from)
    return { chains, loops: [...new Set(loops)], dupes: [...new Set(dupes)] }
  }, [s.redirects])
  const add = () => {
    if (!s.newRedirect.from || !s.newRedirect.to) return
    s.setRedirects(prev => [...prev, { ...s.newRedirect, active: true }])
    s.setNewRedirect({ from: '', to: '', type: '301' })
  }
  const out = fmtRedirects(s.redirects)
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" icon={ArrowUturnRightIcon} title={t('redirectManager')} subtitle={t('listSavedDatabaseCopy')}>
        <ul className="space-y-2">
          {s.redirects.map((r, i) => (
            <li key={i} dir="ltr" className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5">
              <Badge size="sm" tone={r.type === '301' ? 'success' : 'brand'}>{r.type}</Badge>
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-link">{r.from}</code>
              <span className="text-xs text-muted">→</span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-success">{r.to}</code>
              <Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={t('delete', { from: r.from })} onClick={() => s.setRedirects(prev => prev.filter((_, j) => j !== i))} />
            </li>
          ))}
          {!s.redirects.length && <li className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">{t('noRedirects')}</li>}
        </ul>
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_96px_auto]" onSubmit={e => { e.preventDefault(); add() }}>
          <Input dir="ltr" className="font-mono" value={s.newRedirect.from} onChange={e => s.setNewRedirect(r => ({ ...r, from: e.target.value }))} placeholder="/old-page" aria-label={t('from')} />
          <Input dir="ltr" className="font-mono" value={s.newRedirect.to} onChange={e => s.setNewRedirect(r => ({ ...r, to: e.target.value }))} placeholder="/new-page" aria-label={t('to')} />
          <Select value={s.newRedirect.type} onChange={e => s.setNewRedirect(r => ({ ...r, type: e.target.value }))} options={[{ value: '301', label: '301' }, { value: '302', label: '302' }]} aria-label={t('type')} />
          <Button type="submit" icon={PlusIcon} disabled={!s.newRedirect.from || !s.newRedirect.to}>{t('add')}</Button>
        </form>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold text-muted">{t('netlifyTomlOutput')}</p><CopyButton size="xs" text={out} label={t('copy')} /></div>
          <pre dir="ltr" className="max-h-64 overflow-auto rounded-xl bg-surface-2 p-3 text-start font-mono text-xs text-body">{out || '—'}</pre>
        </div>
      </SeoCard>
      <SeoCard className="xl:col-span-2" icon={ExclamationTriangleIcon} title={t('redirectIssues')} subtitle={t('computedCurrentList')}>
        {[
          { k: t('chains'), items: issues.chains, fix: t('pointFirstUrlStraight') },
          { k: t('loops'), items: issues.loops, fix: t('removeOneRedirectBreak') },
          { k: t('duplicateSources'), items: issues.dupes, fix: t('keepSingleRedirectPer') },
        ].map(row => (
          <div key={row.k} className="rounded-xl bg-surface-2 p-3.5">
            <div className="flex items-center gap-2">
              {row.items.length ? <ExclamationTriangleIcon className="h-4 w-4 text-warning" aria-hidden="true" /> : <CheckCircleIcon className="h-4 w-4 text-success" aria-hidden="true" />}
              <p className="text-sm font-medium text-ink">{row.k}</p>
              <span className="ms-auto text-xs text-muted">{row.items.length ? row.items.length : t('none')}</span>
            </div>
            {row.items.length > 0 && <><ul dir="ltr" className="mt-2 space-y-0.5 text-start font-mono text-2xs text-body">{row.items.map(x => <li key={x}>{x}</li>)}</ul><p className="mt-1.5 text-xs text-warning">{row.fix}</p></>}
          </div>
        ))}
      </SeoCard>
    </div>
  )
}
