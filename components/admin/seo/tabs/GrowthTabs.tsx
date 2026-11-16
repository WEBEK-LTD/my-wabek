import React, { useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  ArrowTopRightOnSquareIcon, ArrowUturnRightIcon, CameraIcon, ExclamationTriangleIcon, KeyIcon, LightBulbIcon, LinkIcon, PlusIcon, SignalIcon, TrashIcon, TrophyIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/20/solid'
import { Badge, Button, Input, Select, StatCard, Table, TBody, TD, TH, THead, TR, cn, formatNumber } from '@/components/ui'
import { useAdminT } from '../../i18n'
import { CopyButton, Notice } from '../../shared'
import { KEYWORD_DATA, LONGTAIL } from '../data'
import { fmtRedirects, type SeoState } from '../useSeoAdmin'
import { ListRow, SeoCard } from '../ui'

const rankTone = (r: number | null) => (r == null ? 'text-muted' : r <= 10 ? 'text-success' : r <= 20 ? 'text-warning' : 'text-danger')

/* ── Keywords ── */
export function KeywordsTab({ s }: { s: SeoState }) {
  const { tr } = useAdminT()
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" padding="none" headerClassName="px-5 pt-5 sm:px-6" icon={KeyIcon} title={tr('الكلمات المستهدفة لكل صفحة', 'Target keywords by page')}
        subtitle={tr('الحجم والصعوبة تقديرات يدوية وليست بيانات مباشرة.', 'Volume and difficulty are manual estimates, not live data.')}>
        <Table minWidth={520} dense caption={tr('الكلمات المستهدفة', 'Target keywords')}>
          <THead><TR><TH>{tr('الكلمة', 'Keyword')}</TH><TH align="end">{tr('الحجم الشهري (تقدير)', 'Monthly volume (est.)')}</TH><TH align="end">{tr('الصعوبة', 'Difficulty')}</TH><TH>{tr('الصفحة', 'Target page')}</TH><TH><span className="sr-only">{tr('تتبّع', 'Track')}</span></TH></TR></THead>
          <TBody>
            {KEYWORD_DATA.map(k => (
              <TR key={k.kw}>
                <TD><span dir="ltr" className="text-ink">{k.kw}</span></TD>
                <TD align="end"><span className="tabular font-mono text-xs text-success">{formatNumber(k.vol)}</span></TD>
                <TD align="end"><Badge size="sm" tone={k.diff < 25 ? 'success' : k.diff < 40 ? 'warning' : 'danger'}>{k.diff}</Badge></TD>
                <TD><span dir="ltr" className="font-mono text-xs text-muted">{k.page}</span></TD>
                <TD align="end"><Button size="xs" variant="ghost" icon={PlusIcon} disabled={s.trackingKws.some(t => t.kw === k.kw)} onClick={() => { s.trackKeyword(k.kw, k.page); toast.success(tr('أُضيفت إلى متتبّع الترتيب', 'Added to rank tracker')) }}>{tr('تتبّع', 'Track')}</Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="px-5 pb-5 text-xs text-muted sm:px-6">{tr('الصعوبة: أقل من 25 سهلة · 25-40 متوسطة · فوق 40 صعبة', 'Difficulty: <25 easy · 25-40 medium · 40+ hard')}</p>
      </SeoCard>
      <SeoCard className="xl:col-span-2" icon={LightBulbIcon} title={tr('فرص الكلمات الطويلة', 'Long-tail opportunities')}>
        <ul className="space-y-1.5">
          {LONGTAIL.map(kw => <li key={kw}><ListRow end={<CopyButton text={kw} />}><span dir="ltr" className="block text-start text-xs text-ink">{kw}</span></ListRow></li>)}
        </ul>
      </SeoCard>
    </div>
  )
}

/* ── Rank tracker ── */
export function RankTab({ s }: { s: SeoState }) {
  const { tr } = useAdminT()
  const connected = !!s.gscStatus?.connected
  const ranks = s.trackingKws.map(k => s.gscRank(k.kw))
  const known = ranks.filter((r): r is number => r != null)
  const dist = [
    { label: tr('أفضل 3', 'Top 3'), n: known.filter(r => r <= 3).length, tone: 'success' as const },
    { label: tr('أفضل 10', 'Top 10'), n: known.filter(r => r <= 10).length, tone: 'brand' as const },
    { label: tr('أفضل 20', 'Top 20'), n: known.filter(r => r <= 20).length, tone: 'warning' as const },
    { label: '20+', n: known.filter(r => r > 20).length, tone: 'danger' as const },
  ]
  const dates = Object.keys(s.rankHistory).sort().slice(-7)

  return (
    <div className="space-y-5">
      {!connected && (
        <Notice tone="warning" icon={ExclamationTriangleIcon} title={tr('المراكز تأتي من Google Search Console', 'Positions come from Google Search Console')}>
          <span>{tr('اربط Search Console وحمّل البيانات لرؤية المراكز الفعلية.', 'Connect Search Console and load data to see real positions.')}</span>{' '}
          <button type="button" className="font-semibold underline" onClick={() => s.setTab('gsc')}>{tr('ربط GSC', 'Connect GSC')}</button>
        </Notice>
      )}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {dist.map(d => <StatCard key={d.label} label={d.label} value={s.gscData ? formatNumber(d.n) : '—'} sub={s.gscData ? tr(`من ${known.length} كلمة معروفة`, `of ${known.length} with data`) : tr('حمّل بيانات GSC', 'Load GSC data')} />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <SeoCard icon={SignalIcon} title={tr('متتبّع الترتيب', 'Keyword rank tracker')} subtitle={connected ? tr('مراكز فعلية من Search Console', 'Real positions from Search Console') : undefined}>
          <ul className="space-y-2">
            {s.trackingKws.map((k, i) => {
              const r = ranks[i]
              return (
                <li key={k.kw + i}>
                  <ListRow end={
                    <div className="flex items-center gap-3">
                      {r ? <span className={cn('tabular text-lg font-bold', rankTone(r))} dir="ltr">#{r}</span> : <span className="text-xs text-muted">{s.gscData ? tr('غير مصنّفة', 'Not ranking') : '—'}</span>}
                      <Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={tr(`إزالة ${k.kw}`, `Remove ${k.kw}`)} onClick={() => s.setTrackingKws(prev => prev.filter((_, j) => j !== i))} />
                    </div>
                  }>
                    <p dir="ltr" className="text-start text-sm text-ink">{k.kw}</p>
                    <p dir="ltr" className="text-start font-mono text-2xs text-muted">{k.target}</p>
                  </ListRow>
                </li>
              )
            })}
          </ul>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (s.newKw.trim()) { s.trackKeyword(s.newKw.trim()); s.setNewKw('') } }}>
            <Input dir="ltr" wrapperClassName="flex-1" value={s.newKw} onChange={e => s.setNewKw(e.target.value)} placeholder={tr('أضف كلمة للتتبّع…', 'Add keyword to track…')} aria-label={tr('كلمة جديدة', 'New keyword')} />
            <Button type="submit" icon={PlusIcon} disabled={!s.newKw.trim()}>{tr('إضافة', 'Add')}</Button>
          </form>
        </SeoCard>

        <SeoCard icon={CameraIcon} title={tr('سجل الترتيب', 'Rank history')} subtitle={tr('لقطات من مراكز Search Console الفعلية', 'Snapshots of real Search Console positions')}
          action={<Button size="sm" variant="secondary" icon={CameraIcon} disabled={!s.gscData} onClick={s.saveRankSnapshot}>{tr('حفظ لقطة اليوم', 'Save today’s snapshot')}</Button>}>
          {dates.length === 0 ? (
            <p className="rounded-xl bg-surface-2 px-4 py-8 text-center text-sm text-muted">{tr('لا يوجد سجل بعد. حمّل بيانات GSC ثم احفظ لقطة.', 'No history yet. Load GSC data, then save a snapshot.')}</p>
          ) : (
            <>
              <Table minWidth={420} dense caption={tr('سجل الترتيب', 'Rank history')}>
                <THead><TR><TH>{tr('الكلمة', 'Keyword')}</TH>{dates.map(d => <TH key={d} align="end"><span dir="ltr">{d.slice(5)}</span></TH>)}<TH align="end">{tr('الاتجاه', 'Trend')}</TH></TR></THead>
                <TBody>
                  {s.trackingKws.slice(0, 8).map(k => {
                    const rs = dates.map(d => s.rankHistory[d]?.[k.kw] || null)
                    const first = rs.find(r => r !== null)
                    const last = [...rs].reverse().find(r => r !== null)
                    const trend = first && last ? first - last : 0
                    return (
                      <TR key={k.kw}>
                        <TD><span dir="ltr" className="block max-w-[160px] truncate text-xs text-ink">{k.kw}</span></TD>
                        {rs.map((r, i) => <TD key={i} align="end"><span className={cn('tabular font-mono text-xs', rankTone(r))} dir="ltr">{r ? '#' + r : '—'}</span></TD>)}
                        <TD align="end"><span className={cn('tabular font-mono text-xs', trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-muted')} dir="ltr">{trend === 0 ? '—' : (trend > 0 ? '▲' : '▼') + Math.abs(trend)}</span></TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
              <p className="text-2xs text-muted">{tr('آخر 7 لقطات. ▲ تحسّن (رقم ترتيب أقل).', 'Last 7 snapshots. ▲ = improvement (lower position).')}</p>
            </>
          )}
        </SeoCard>
      </div>
    </div>
  )
}

/* ── Competitors ── */
export function CompetitorsTab({ s }: { s: SeoState }) {
  const { tr } = useAdminT()
  const best = useMemo(() => ({
    da: Math.max(0, ...s.competitors.map(c => c.da || 0)),
    traffic: Math.max(0, ...s.competitors.map(c => c.traffic || 0)),
    keywords: Math.max(0, ...s.competitors.map(c => c.keywords || 0)),
    backlinks: Math.max(0, ...s.competitors.map(c => c.backlinks || 0)),
  }), [s.competitors])
  const gaps = [
    { label: tr('سلطة النطاق', 'Domain authority'), v: best.da, tip: tr('ابنِ روابط من مواقع قوية: G2 وCapterra وProduct Hunt', 'Build backlinks from high-DA sites: G2, Capterra, Product Hunt') },
    { label: tr('الزيارات الشهرية التقديرية', 'Estimated monthly traffic'), v: best.traffic, tip: tr('استهدف كلمات طويلة بمحتوى المدونة', 'Target long-tail keywords with blog content') },
    { label: tr('الكلمات المصنّفة', 'Ranking keywords'), v: best.keywords, tip: tr('انشر مقالات لحالات استخدام واتساب محددة', 'Publish posts targeting specific WhatsApp use cases') },
    { label: tr('الروابط الخلفية', 'Backlinks'), v: best.backlinks, tip: tr('مقالات ضيف وأدلة وتكاملات شركاء', 'Guest posts, directory listings and partner integrations') },
  ]
  const add = () => {
    const d = s.newCompetitor.trim()
    if (!d) return
    s.setCompetitors(prev => [...prev, { domain: d, name: d.split('.')[0], da: 0, traffic: 0, keywords: 0, backlinks: 0 }])
    s.setNewCompetitor('')
    toast.success(tr('أُضيف المنافس', 'Competitor added'))
  }
  return (
    <div className="space-y-5">
      <Notice tone="warning" icon={ExclamationTriangleIcon}>
        {tr('أرقام المنافسين تقديرات مُدخلة يدويًا وليست بيانات مباشرة. اربط Moz أو Ahrefs للحصول على أرقام فعلية — ولذلك لا نعرض أرقامًا لموقعك هنا.',
          'Competitor figures are manually entered estimates, not live data. Connect Moz or Ahrefs for real numbers — which is also why no figures are shown for your own site.')}
      </Notice>
      <SeoCard padding="none" headerClassName="px-5 pt-5 sm:px-6" icon={TrophyIcon} title={tr('تحليل المنافسين', 'Competitor analysis')}>
        <Table minWidth={640} dense caption={tr('المنافسون', 'Competitors')}>
          <THead><TR><TH>{tr('النطاق', 'Domain')}</TH><TH align="end">DA</TH><TH align="end">{tr('الزيارات (تقدير)', 'Traffic (est.)')}</TH><TH align="end">{tr('الكلمات', 'Keywords')}</TH><TH align="end">{tr('الروابط', 'Backlinks')}</TH><TH><span className="sr-only">{tr('إجراءات', 'Actions')}</span></TH></TR></THead>
          <TBody>
            <TR selected>
              <TD><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient text-2xs font-bold text-[#04282C]">W</span><div><p dir="ltr" className="text-start font-medium text-ink">waabek.com</p><p className="text-2xs text-link">{tr('موقعك', 'You')}</p></div></div></TD>
              <TD align="end" className="text-muted">—</TD><TD align="end" className="text-muted">—</TD><TD align="end" className="text-muted">—</TD><TD align="end" className="text-muted">—</TD><TD />
            </TR>
            {s.competitors.map((c, i) => (
              <TR key={c.domain + i}>
                <TD><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3 text-2xs font-bold text-muted">{c.name?.[0]?.toUpperCase()}</span><div><p className="text-ink">{c.name}</p><p dir="ltr" className="text-start text-2xs text-muted">{c.domain}</p></div></div></TD>
                <TD align="end"><span className={cn('tabular font-mono', c.da > 60 ? 'text-danger' : c.da > 30 ? 'text-warning' : 'text-success')}>{c.da || '—'}</span></TD>
                <TD align="end" className="tabular font-mono text-body">{c.traffic ? formatNumber(c.traffic) : '—'}</TD>
                <TD align="end" className="tabular font-mono text-body">{c.keywords ? formatNumber(c.keywords) : '—'}</TD>
                <TD align="end" className="tabular font-mono text-body">{c.backlinks ? formatNumber(c.backlinks) : '—'}</TD>
                <TD align="end"><Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={tr(`إزالة ${c.domain}`, `Remove ${c.domain}`)} onClick={() => s.setCompetitors(prev => prev.filter((_, j) => j !== i))} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <form className="flex gap-2 px-5 pb-5 sm:px-6" onSubmit={e => { e.preventDefault(); add() }}>
          <Input dir="ltr" wrapperClassName="flex-1" value={s.newCompetitor} onChange={e => s.setNewCompetitor(e.target.value)} placeholder="domain.com" aria-label={tr('نطاق المنافس', 'Competitor domain')} />
          <Button type="submit" icon={PlusIcon} disabled={!s.newCompetitor.trim()}>{tr('إضافة منافس', 'Add competitor')}</Button>
        </form>
      </SeoCard>
      <SeoCard title={tr('سدّ الفجوة', 'Closing the gap')} subtitle={tr('أعلى قيمة لدى المنافسين المدرجين، مع خطوة عملية لكل مؤشر.', 'The highest value among listed competitors, with a next step for each metric.')}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {gaps.map(g => (
            <div key={g.label} className="rounded-xl bg-surface-2 p-3.5">
              <div className="flex items-baseline justify-between gap-2"><span className="text-sm text-ink">{g.label}</span><span className="tabular text-xs text-muted">{tr('الأعلى:', 'Best:')} {formatNumber(g.v)}</span></div>
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
  const { tr } = useAdminT()
  const groups = [
    { cat: tr('الأدلة', 'Directories'), items: [
      { name: 'Product Hunt', url: 'https://producthunt.com', desc: tr('أدرجه كأداة أتمتة واتساب — ظهور كبير', 'Submit as a WhatsApp automation tool — high visibility'), da: 91 },
      { name: 'G2', url: 'https://g2.com', desc: tr('ملف شركة في فئة تسويق واتساب', 'Company profile in the WhatsApp Marketing category'), da: 88 },
      { name: 'Capterra', url: 'https://capterra.com', desc: tr('فئتا برامج الروبوت وتسويق واتساب', 'Chatbot Software and WhatsApp Marketing categories'), da: 87 },
      { name: 'AlternativeTo', url: 'https://alternativeto.net', desc: tr('أضفه بديلًا لـ Twilio وManyChat وWATI', 'Add as an alternative to Twilio, ManyChat, WATI'), da: 81 },
      { name: 'BetaList', url: 'https://betalist.com', desc: tr('تغطية إطلاق الشركات الناشئة', 'Startup launch coverage'), da: 68 },
    ] },
    { cat: tr('مقالات الضيف والعلاقات', 'Guest posts & PR'), items: [
      { name: 'WHMCS Marketplace Blog', url: 'https://marketplace.whmcs.com', desc: tr('دليل: إضافة واتساب إلى WHMCS', 'Tutorial: how to add WhatsApp to WHMCS'), da: 72 },
      { name: 'Wix Blog', url: 'https://support.wix.com', desc: tr('مقال عن واتساب لمتاجر Wix', 'Pitch an article on WhatsApp for Wix stores'), da: 95 },
      { name: 'WordPress.org', url: 'https://wordpress.org', desc: tr('انشر الإضافة مع توثيق مفصّل', 'Publish the plugin with detailed docs'), da: 99 },
      { name: 'DEV', url: 'https://dev.to', desc: tr('مقالات تعليمية عن واجهة واتساب مع أمثلة', 'WhatsApp API tutorials with code examples'), da: 82 },
    ] },
    { cat: tr('المجتمعات', 'Community'), items: [
      { name: 'Reddit r/Entrepreneur', url: 'https://reddit.com/r/Entrepreneur', desc: tr('شارك دراسات الحالة', 'Share case studies'), da: 96 },
      { name: 'Indie Hackers', url: 'https://indiehackers.com', desc: tr('شارك محطات النمو', 'Post growth milestones'), da: 78 },
      { name: 'WHMCS Forums', url: 'https://whmcs.community', desc: tr('ساعد المستخدمين وأدرج أداتك', 'Help users and include your tool'), da: 65 },
    ] },
  ]
  const ideas = [
    tr('مولّد قوالب رسائل واتساب مجاني (أداة مضمّنة)', 'Free WhatsApp message template generator (embeddable tool)'),
    tr('حاسبة عائد واتساب للأعمال', 'WhatsApp Business ROI calculator'),
    tr('جدول مقارنة واتساب والبريد وSMS', 'WhatsApp vs Email vs SMS comparison table'),
    tr('تقرير «حالة واتساب للأعمال 2026» ببيانات أصلية', '“State of WhatsApp Business 2026” report with original data'),
    tr('مكتبة قوالب تدفقات روبوت مجانية', 'Free chatbot flow template library'),
    tr('حاسبة تكلفة واتساب API مقارنة بالمنافسين', 'WhatsApp API cost calculator vs competitors'),
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <SeoCard className="xl:col-span-3" icon={LinkIcon} title={tr('استراتيجية الروابط الخلفية', 'Backlink strategy')}>
        <Notice tone="info">{tr('قائمة مختارة بفرص الروابط. قيم DA تقريبية؛ البيانات المباشرة تحتاج مفتاح Moz أو Ahrefs.', 'A curated list of link opportunities. DA values are approximate; live data needs a Moz or Ahrefs key.')}</Notice>
        {groups.map(g => (
          <div key={g.cat} className="space-y-2">
            <p className="eyebrow">{g.cat}</p>
            {g.items.map(it => (
              <ListRow key={it.name} end={<Button size="xs" variant="ghost" href={it.url} external iconEnd={ArrowTopRightOnSquareIcon}>{tr('زيارة', 'Visit')}</Button>}>
                <div className="flex items-center gap-2"><p className="text-sm font-medium text-ink">{it.name}</p><Badge size="sm" tone="brand">DA ~{it.da}</Badge></div>
                <p className="text-xs text-muted">{it.desc}</p>
              </ListRow>
            ))}
          </div>
        ))}
      </SeoCard>
      <SeoCard className="xl:col-span-2" icon={LightBulbIcon} title={tr('أفكار محتوى جاذب للروابط', 'Link-bait content ideas')}>
        <ol className="space-y-2">{ideas.map((x, i) => <li key={i}><ListRow><div className="flex gap-2.5"><span className="tabular font-bold text-brand-ink">{i + 1}.</span><p className="text-sm text-ink">{x}</p></div></ListRow></li>)}</ol>
      </SeoCard>
    </div>
  )
}

/* ── Redirects ── */
export function RedirectsTab({ s }: { s: SeoState }) {
  const { tr } = useAdminT()
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
      <SeoCard className="xl:col-span-3" icon={ArrowUturnRightIcon} title={tr('مدير التحويلات', 'Redirect manager')} subtitle={tr('تُحفظ القائمة في قاعدة البيانات؛ انسخ الناتج إلى netlify.toml لتفعيلها.', 'The list is saved to the database; copy the output into netlify.toml to apply it.')}>
        <ul className="space-y-2">
          {s.redirects.map((r, i) => (
            <li key={i} dir="ltr" className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5">
              <Badge size="sm" tone={r.type === '301' ? 'success' : 'brand'}>{r.type}</Badge>
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-link">{r.from}</code>
              <span className="text-xs text-muted">→</span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-success">{r.to}</code>
              <Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={tr(`حذف ${r.from}`, `Delete ${r.from}`)} onClick={() => s.setRedirects(prev => prev.filter((_, j) => j !== i))} />
            </li>
          ))}
          {!s.redirects.length && <li className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">{tr('لا توجد تحويلات', 'No redirects')}</li>}
        </ul>
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_96px_auto]" onSubmit={e => { e.preventDefault(); add() }}>
          <Input dir="ltr" className="font-mono" value={s.newRedirect.from} onChange={e => s.setNewRedirect(r => ({ ...r, from: e.target.value }))} placeholder="/old-page" aria-label={tr('من', 'From')} />
          <Input dir="ltr" className="font-mono" value={s.newRedirect.to} onChange={e => s.setNewRedirect(r => ({ ...r, to: e.target.value }))} placeholder="/new-page" aria-label={tr('إلى', 'To')} />
          <Select value={s.newRedirect.type} onChange={e => s.setNewRedirect(r => ({ ...r, type: e.target.value }))} options={[{ value: '301', label: '301' }, { value: '302', label: '302' }]} aria-label={tr('النوع', 'Type')} />
          <Button type="submit" icon={PlusIcon} disabled={!s.newRedirect.from || !s.newRedirect.to}>{tr('إضافة', 'Add')}</Button>
        </form>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold text-muted">{tr('ناتج netlify.toml', 'netlify.toml output')}</p><CopyButton size="xs" text={out} label={tr('نسخ', 'Copy')} /></div>
          <pre dir="ltr" className="max-h-64 overflow-auto rounded-xl bg-surface-2 p-3 text-start font-mono text-xs text-body">{out || '—'}</pre>
        </div>
      </SeoCard>
      <SeoCard className="xl:col-span-2" icon={ExclamationTriangleIcon} title={tr('مشكلات التحويل', 'Redirect issues')} subtitle={tr('محسوبة من القائمة الحالية', 'Computed from the current list')}>
        {[
          { k: tr('سلاسل تحويل', 'Chains'), items: issues.chains, fix: tr('اجعل أول رابط يشير مباشرة إلى الوجهة النهائية', 'Point the first URL straight at the final destination') },
          { k: tr('حلقات', 'Loops'), items: issues.loops, fix: tr('أزل أحد التحويلات لكسر الحلقة', 'Remove one redirect to break the loop') },
          { k: tr('مصادر مكررة', 'Duplicate sources'), items: issues.dupes, fix: tr('احتفظ بتحويل واحد لكل مسار', 'Keep a single redirect per path') },
        ].map(row => (
          <div key={row.k} className="rounded-xl bg-surface-2 p-3.5">
            <div className="flex items-center gap-2">
              {row.items.length ? <ExclamationTriangleIcon className="h-4 w-4 text-warning" aria-hidden="true" /> : <CheckCircleIcon className="h-4 w-4 text-success" aria-hidden="true" />}
              <p className="text-sm font-medium text-ink">{row.k}</p>
              <span className="ms-auto text-xs text-muted">{row.items.length ? row.items.length : tr('لا يوجد', 'None')}</span>
            </div>
            {row.items.length > 0 && <><ul dir="ltr" className="mt-2 space-y-0.5 text-start font-mono text-2xs text-body">{row.items.map(x => <li key={x}>{x}</li>)}</ul><p className="mt-1.5 text-xs text-warning">{row.fix}</p></>}
          </div>
        ))}
      </SeoCard>
    </div>
  )
}
