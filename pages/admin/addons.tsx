import React, { useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useQuery } from 'react-query'
import axios from 'axios'
import {
  ArrowDownTrayIcon, CheckBadgeIcon, ChevronDownIcon, CubeIcon, InformationCircleIcon,
  KeyIcon, ShieldCheckIcon, UsersIcon, WrenchScrewdriverIcon, ArrowPathIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'
import {
  Badge, Button, Card, CardHeader, DataTable, EmptyState, PageHeader, ProgressBar, StatCard, TabPanel, Tabs, cn,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { useAdminT } from '@/components/admin/i18n'
import { CopyButton, ErrorState, InfoTile, Notice, Pagination, Steps } from '@/components/admin/shared'
import messages from '@/locales/admin/addons'
import manifest from '@/lib/generated/addons.json'

type AddonId = 'wordpress' | 'whmcs'
type MsgKey = keyof typeof messages.en

interface ChangelogEntry { version: string; date: string | null; notes: string | null; sections: { title: string; items: string[] }[] }
interface AddonManifest {
  id: string; name: string; version: string; download: string
  size: number | null; sha256: string | null; changelog: ChangelogEntry[]
}

interface ClientStats { active7: number; active30: number; total: number; versions: { version: string; count: number }[] }
interface InstallRow {
  user_id: string; email: string | null; name: string | null; client: AddonId
  version: string; site: string | null; first_seen: string; last_seen: string
}
interface UsageResponse {
  available: boolean
  stats: Record<AddonId, ClientStats>
  apiKeysUsed30: number | null
  items: InstallRow[]
  total: number
  page: number
  pageSize: number
}

const ADDONS = (manifest.addons as AddonManifest[]).filter((a): a is AddonManifest & { id: AddonId } => a.id === 'wordpress' || a.id === 'whmcs')
const NAME_KEY: Record<AddonId, MsgKey> = { wordpress: 'nameWordpress', whmcs: 'nameWhmcs' }
const STEPS: Record<AddonId, { install: MsgKey[]; update: MsgKey[]; compat: MsgKey[] }> = {
  wordpress: {
    install: ['wpStep1', 'wpStep2', 'wpStep3', 'wpStep4', 'wpStep5'],
    update: ['wpUpdate1', 'wpUpdate2'],
    compat: ['wpCompat1', 'wpCompat2', 'wpCompat3', 'wpCompat4'],
  },
  whmcs: {
    install: ['whStep1', 'whStep2', 'whStep3', 'whStep4', 'whStep5'],
    update: ['whUpdate1', 'whUpdate2'],
    compat: ['whCompat1', 'whCompat2', 'whCompat3', 'whCompat4'],
  },
}
const SECTION_KEY: Record<string, MsgKey> = {
  added: 'sec_added', changed: 'sec_changed', fixed: 'sec_fixed', security: 'sec_security',
  removed: 'sec_removed', deprecated: 'sec_deprecated',
}
const EXPANDED = 3

function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map(n => parseInt(n, 10) || 0)
  const pb = b.split(/[.+-]/).map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d
  }
  return 0
}

/** `code` and **bold** from the CHANGELOG.md lines, as React nodes (no HTML injection). */
function InlineMd({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('`') && p.endsWith('`') && p.length > 1) return <code key={i} className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[0.85em] text-ink">{p.slice(1, -1)}</code>
        if (p.startsWith('**') && p.endsWith('**') && p.length > 3) return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
        return <React.Fragment key={i}>{p}</React.Fragment>
      })}
    </>
  )
}

export default function AdminAddonsPage() {
  const { t, lang, locale, fmtNumber, fmtDate, fmtDateTime } = useAdminT(messages)
  const [active, setActive] = useState<AddonId>('wordpress')
  const [page, setPage] = useState(1)
  const [showOlder, setShowOlder] = useState(false)

  const addon = ADDONS.find(a => a.id === active) || ADDONS[0]
  const name = (id: AddonId) => t(NAME_KEY[id])

  const { data, isLoading, isError, refetch, isFetching } = useQuery<UsageResponse>(
    ['admin-addons', active, page],
    () => axios.get('/api/admin/addons', { params: { client: active, page } }).then(r => r.data),
    { keepPreviousData: true },
  )
  const stats = data?.stats

  const fmtSize = useMemo(() => {
    let nf: Intl.NumberFormat
    try { nf = new Intl.NumberFormat(locale, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 }) } catch { nf = new Intl.NumberFormat('en-GB') }
    return (bytes: number | null) => (bytes === null ? '—' : nf.format(Math.round(bytes / 1024)))
  }, [locale])

  const switchAddon = (id: string) => { setActive(id as AddonId); setPage(1); setShowOlder(false) }

  const sectionTitle = (title: string) => {
    const key = SECTION_KEY[title.trim().toLowerCase().split(/\s/)[0]]
    return key ? t(key) : (title || t('sec_other'))
  }

  const cols: Column<InstallRow>[] = [
    {
      key: 'account', header: t('colAccount'),
      cell: r => (
        <div className="min-w-0">
          <p className="max-w-[220px] truncate text-sm font-medium text-ink">{r.name || '—'}</p>
          <p dir="ltr" className="max-w-[220px] truncate text-start text-xs text-muted">{r.email || r.user_id}</p>
        </div>
      ),
    },
    { key: 'site', header: t('colSite'), cell: r => r.site ? <span dir="ltr" className="font-mono text-xs text-body">{r.site}</span> : <span className="text-muted">—</span> },
    {
      key: 'version', header: t('colVersion'),
      cell: r => {
        const outdated = compareVersions(r.version, addon.version) < 0
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span dir="ltr" className="tabular font-mono text-xs text-ink">{r.version}</span>
            <Badge size="sm" tone={outdated ? 'warning' : 'success'}>{outdated ? t('updateAvailable') : t('latest')}</Badge>
          </span>
        )
      },
    },
    { key: 'last', header: t('colLastSeen'), cell: r => <span className="tabular whitespace-nowrap text-xs text-muted">{fmtDateTime(r.last_seen)}</span> },
    { key: 'first', header: t('colFirstSeen'), hideBelow: 'lg', cell: r => <span className="tabular whitespace-nowrap text-xs text-muted">{fmtDate(r.first_seen)}</span> },
  ]

  const changelog = addon.changelog
  const visible = showOlder ? changelog : changelog.slice(0, EXPANDED)
  const olderCount = Math.max(0, changelog.length - EXPANDED)
  const versions = stats?.[active]?.versions || []
  const versionMax = Math.max(1, ...versions.map(v => v.count))

  return (
    <AdminLayout title={t('title')}>
      <PageHeader className="mb-6" eyebrow={t('eyebrow')} title={t('title')} description={t('description')}
        actions={<Button variant="secondary" size="sm" icon={ArrowPathIcon} loading={isFetching} onClick={() => refetch()}>{t('refresh')}</Button>} />

      {data && !data.available && <Notice tone="warning" icon={InformationCircleIcon} className="mb-4">{t('migrationMissing')}</Notice>}

      <div className="mb-6 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {ADDONS.map(a => (
          <React.Fragment key={a.id}>
            <StatCard loading={isLoading} icon={CubeIcon} label={t('active7', { name: name(a.id) })} value={fmtNumber(stats?.[a.id]?.active7 ?? 0)} />
            <StatCard loading={isLoading} icon={UsersIcon} label={t('active30', { name: name(a.id) })} value={fmtNumber(stats?.[a.id]?.active30 ?? 0)}
              sub={t('totalEver', { n: fmtNumber(stats?.[a.id]?.total ?? 0) })} />
          </React.Fragment>
        ))}
        <StatCard loading={isLoading} icon={KeyIcon} label={t('apiKeys30')} value={data?.apiKeysUsed30 === null ? '—' : fmtNumber(data?.apiKeysUsed30 ?? 0)} sub={t('apiKeysSub')} />
      </div>

      <Tabs idPrefix="addon" className="mb-5" value={active} onChange={switchAddon}
        tabs={ADDONS.map(a => ({ id: a.id, label: name(a.id), count: stats?.[a.id]?.active30 }))} />

      <TabPanel idPrefix="addon" id={active} active={active} className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader icon={CubeIcon} title={t('latestRelease')} subtitle={<span dir="ltr">{addon.name}</span>}
              action={<Badge tone="brand"><span dir="ltr" className="tabular">v{addon.version}</span></Badge>} />
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              <InfoTile label={t('version')} value={<span dir="ltr" className="tabular font-mono">{addon.version}</span>} />
              <InfoTile label={t('built')} value={<span className="tabular">{fmtDate(manifest.generatedAt)}</span>} />
              <InfoTile label={t('size')} value={<span className="tabular">{fmtSize(addon.size)}</span>} />
            </div>
            {addon.sha256 ? (
              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-line-soft bg-surface-2 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">{t('checksum')}</p>
                  <p dir="ltr" className="mt-0.5 break-all text-start font-mono text-2xs text-body">{addon.sha256}</p>
                </div>
                <CopyButton text={addon.sha256} label={t('copyChecksum')} />
              </div>
            ) : <Notice tone="danger" className="mt-2.5">{t('noZip')}</Notice>}
            <div className="mt-4">
              <Button icon={ArrowDownTrayIcon} href={addon.download} external download disabled={!addon.size}>{t('downloadVersion', { version: addon.version })}</Button>
            </div>
          </Card>

          <Card>
            <CardHeader icon={DocumentTextIcon} title={t('changelog')} />
            {lang !== 'en' && <p className="mt-1 text-xs text-muted">{t('notesInEnglish')}</p>}
            <div className="mt-4 space-y-5">
              {visible.map((entry, i) => (
                <article key={entry.version} className={cn(i > 0 && 'border-t border-line-soft pt-5')}>
                  <header className="flex flex-wrap items-center gap-2">
                    <h3 dir="ltr" className="tabular text-base font-semibold text-ink">v{entry.version}</h3>
                    {i === 0 && <Badge size="sm" tone="success" icon={CheckBadgeIcon}>{t('current')}</Badge>}
                    {entry.date && <span className="tabular text-xs text-muted">{fmtDate(entry.date + 'T12:00:00Z')}</span>}
                  </header>
                  {entry.notes && <p lang="en" dir="ltr" className="mt-2 text-start text-sm text-body"><InlineMd text={entry.notes} /></p>}
                  {entry.sections.map((s, j) => (
                    <div key={j} className="mt-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{sectionTitle(s.title)}</p>
                      <ul lang="en" dir="ltr" className="list-disc space-y-1.5 ps-5 text-start text-sm leading-relaxed text-body">
                        {s.items.map((it, k) => <li key={k}><InlineMd text={it} /></li>)}
                      </ul>
                    </div>
                  ))}
                </article>
              ))}
            </div>
            {olderCount > 0 && (
              <div className="mt-4 border-t border-line-soft pt-3">
                <Button variant="ghost" size="sm" iconEnd={ChevronDownIcon} className={cn(showOlder && '[&_svg]:rotate-180')}
                  aria-expanded={showOlder} onClick={() => setShowOlder(v => !v)}>
                  {showOlder ? t('hideOlder') : t('showOlder', { n: fmtNumber(olderCount) })}
                </Button>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader icon={WrenchScrewdriverIcon} title={t('install')} />
            <Steps className="mt-4" items={STEPS[active].install.map(k => t(k))} />
            <p className="mb-2 mt-5 text-sm font-semibold text-ink">{t('updating')}</p>
            <ul className="list-disc space-y-1.5 ps-5 text-sm leading-relaxed text-body">
              {STEPS[active].update.map(k => <li key={k}>{t(k)}</li>)}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={ShieldCheckIcon} title={t('compatibility')} />
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-body">
              {STEPS[active].compat.map(k => (
                <li key={k} className="flex gap-2"><CheckBadgeIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" /><span>{t(k)}</span></li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader icon={UsersIcon} title={t('versionsInUse')} />
            {versions.length ? (
              <div className="mt-4 space-y-3">
                {versions.map(v => (
                  <ProgressBar key={v.version} value={v.count} max={versionMax} size="sm"
                    label={<span dir="ltr" className="tabular font-mono">{v.version}</span>}
                    valueText={fmtNumber(v.count)} />
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-muted">{t('noUsageYet')}</p>}
            <p className="mt-4 text-xs leading-relaxed text-muted">{t('usageNote')}</p>
          </Card>
        </div>
      </TabPanel>

      <Card padding="none" className="mt-5">
        <CardHeader className="p-4" title={t('accountsUsing', { name: name(active) })}
          action={data ? <Badge tone="neutral" className="tabular">{t('totalEver', { n: fmtNumber(data.total) })}</Badge> : undefined} />
        {isError ? <div className="p-4"><ErrorState onRetry={() => refetch()} /></div> : (
          <div className={cn('transition-opacity', isFetching && !isLoading && 'opacity-70')}>
            <DataTable rows={data?.items} loading={isLoading} skeletonRows={6} rowKey={r => r.user_id + r.client} columns={cols} minWidth={680} dense
              caption={t('accountsUsing', { name: name(active) })}
              empty={<EmptyState size="sm" icon={CubeIcon} title={t('noInstalls')} description={t('noInstallsHint')} />} />
          </div>
        )}
        <Pagination page={page} total={data?.total || 0} pageSize={data?.pageSize || 25} onChange={setPage} />
      </Card>
    </AdminLayout>
  )
}
