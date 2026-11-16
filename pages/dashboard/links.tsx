import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowTopRightOnSquareIcon, ChartBarIcon, ClipboardDocumentIcon, CursorArrowRaysIcon, EllipsisHorizontalIcon,
  LinkIcon, PlusIcon, TrashIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  AreaChart, Button, Card, ConfirmDialog, DataTable, Dropdown, EmptyState, Field, Input, Modal, PageHeader,
  SearchInput, Skeleton, StatCard, Table, TBody, TD, TH, THead, TR,
} from '@/components/ui'
import { LoadError } from '@/components/analytics/LoadError'
import { apiError, formatDateTime, formatDay } from '@/components/analytics/format'
import { tc } from '@/components/campaigns/shared'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/links'
import common from '@/locales/dashboard/common-a'

interface TrackedLink {
  id: string; title: string | null; original_url: string; short_code: string; click_count: number | null; created_at: string
}
interface LinkClick { id: string; clicked_at: string; contact_phone?: string | null; country?: string | null; user_agent?: string | null }

function copyText(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success(tc('copied')), () => toast.error(tc('copy_failed')))
}

function deviceOf(ua: string | null | undefined, other: string): string {
  if (!ua) return '—'
  if (/iphone|ipad|ios/i.test(ua)) return 'iOS'
  if (/android/i.test(ua)) return 'Android'
  if (/windows/i.test(ua)) return 'Windows'
  if (/mac os/i.test(ua)) return 'macOS'
  if (/linux/i.test(ua)) return 'Linux'
  return other
}

/** Click details for one link (GET /api/links/:id — latest 100 clicks). */
function LinkStatsModal({ link, shortUrl, onClose }: { link: TrackedLink | null; shortUrl: string; onClose: () => void }) {
  const { t, fmtNumber, locale } = useT(messages)
  const { t: tcm } = useT(common)
  const formatNumber = (n: number) => fmtNumber(Number(n) || 0)
  const { data, isLoading, isError, refetch } = useQuery<{ link: TrackedLink; clicks: LinkClick[] }>(
    ['tracked-link', link?.id],
    () => axios.get(`/api/links/${link!.id}`).then(r => r.data),
    { enabled: !!link },
  )
  const clicks = data?.clicks || []

  // Clicks per day over the last 14 days, from the clicks the API returns.
  const daily = useMemo(() => {
    const days: { key: string; label: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      days.push({ key: d.toISOString().slice(0, 10), label: formatDay(d, locale), count: 0 })
    }
    for (const c of clicks) {
      const day = days.find(d => d.key === c.clicked_at?.slice(0, 10))
      if (day) day.count++
    }
    return days
  }, [clicks, locale])

  return (
    <Modal open={!!link} onClose={onClose} size="lg" icon={ChartBarIcon}
      title={link?.title || t('untitled')}
      description={<span dir="ltr" className="font-mono text-xs">{shortUrl}</span>}
      footer={<Button variant="secondary" onClick={onClose}>{tcm('close')}</Button>}>
      {isError ? <LoadError size="sm" onRetry={() => refetch()} /> : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-card border border-line bg-surface-2 p-4">
              <p className="text-xs text-muted">{t('total_clicks')}</p>
              <p className="tabular mt-1 text-2xl font-bold text-ink">{formatNumber(link?.click_count || 0)}</p>
            </div>
            <div className="rounded-card border border-line bg-surface-2 p-4">
              <p className="text-xs text-muted">{t('last_click')}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{isLoading ? '…' : clicks[0] ? formatDateTime(clicks[0].clicked_at, locale) : t('no_clicks')}</p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t('daily_title')}</h3>
            {isLoading ? <Skeleton className="h-40 w-full" /> : (
              <AreaChart height={160} labels={daily.map(d => d.label)} series={[{ name: t('clicks_series'), data: daily.map(d => d.count) }]} showLegend={false} ariaLabel={t('daily_aria')} />
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t('recent_title')}</h3>
            {isLoading ? <Skeleton lines={4} /> : clicks.length === 0 ? (
              <EmptyState size="sm" icon={CursorArrowRaysIcon} title={t('no_clicks')} description={t('no_clicks_desc')} />
            ) : (
              <div className="overflow-hidden rounded-card border border-line">
                <Table minWidth={420} dense caption={t('recent_title')}>
                  <THead><TR><TH>{t('th_time')}</TH><TH>{t('th_device')}</TH><TH>{t('th_country')}</TH></TR></THead>
                  <TBody>
                    {clicks.slice(0, 20).map(c => (
                      <TR key={c.id}>
                        <TD className="tabular text-[13px]">{formatDateTime(c.clicked_at, locale)}</TD>
                        <TD className="text-[13px]">{deviceOf(c.user_agent, t('other_device'))}</TD>
                        <TD className="text-[13px]">{c.country || '—'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
            {clicks.length >= 100 && <p className="mt-2 text-xs text-muted">{t('last_100')}</p>}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function LinksPage() {
  const { t, fmtNumber, fmtDate } = useT(messages)
  const { t: tcm } = useT(common)
  const formatNumber = (n: number) => fmtNumber(Number(n) || 0)
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ original_url: '', title: '' })
  const [urlError, setUrlError] = useState('')
  const [search, setSearch] = useState('')
  const [statsFor, setStatsFor] = useState<TrackedLink | null>(null)
  const [toDelete, setToDelete] = useState<TrackedLink | null>(null)

  const { data, isLoading, isError, refetch } = useQuery<{ links: TrackedLink[] }>('tracked-links', () => axios.get('/api/links').then(r => r.data))
  const links = data?.links || []
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'
  const shortUrlOf = (l: TrackedLink) => `${appUrl}/l/${l.short_code}`

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return links
    return links.filter(l => (l.title || '').toLowerCase().includes(q) || l.original_url.toLowerCase().includes(q) || l.short_code.toLowerCase().includes(q))
  }, [links, search])

  const totalClicks = links.reduce((s, l) => s + (l.click_count || 0), 0)
  const top = links.reduce<TrackedLink | null>((best, l) => (!best || (l.click_count || 0) > (best.click_count || 0) ? l : best), null)

  const closeForm = () => { setShowForm(false); setForm({ original_url: '', title: '' }); setUrlError('') }

  const createMut = useMutation(
    (body: { original_url: string; title: string }) => axios.post('/api/links', body),
    {
      onSuccess: (r) => {
        qc.invalidateQueries('tracked-links')
        closeForm()
        const url = r.data.short_url as string
        navigator.clipboard?.writeText(url).catch(() => undefined)
        toast.success(t('created_toast', { url }))
      },
      onError: (e: unknown) => void toast.error(apiError(e, t('create_failed'))),
    },
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/links/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('tracked-links'); setToDelete(null); toast.success(t('deleted')) },
      onError: (e: unknown) => void toast.error(apiError(e, t('delete_failed'))),
    },
  )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const u = new URL(form.original_url.trim())
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol')
    } catch {
      setUrlError(t('url_invalid'))
      return
    }
    createMut.mutate({ original_url: form.original_url.trim(), title: form.title })
  }

  return (
    <DashboardLayout title={t('page_title')}>
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={<Button icon={PlusIcon} onClick={() => setShowForm(true)}>{t('new_link')}</Button>}
        />

        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <StatCard loading={isLoading} label={t('stat_links')} value={formatNumber(links.length)} icon={LinkIcon} />
          <StatCard loading={isLoading} label={t('total_clicks')} value={formatNumber(totalClicks)} icon={CursorArrowRaysIcon} />
          <StatCard loading={isLoading} label={t('stat_top')} icon={ChartBarIcon}
            value={top && (top.click_count || 0) > 0 ? formatNumber(top.click_count || 0) : '—'}
            sub={top && (top.click_count || 0) > 0 ? (top.title || `/${top.short_code}`) : t('no_clicks')} />
        </div>

        <Card padding="none">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <h2 className="text-base font-semibold text-ink">{t('all_links')}</h2>
            <SearchInput value={search} onChange={setSearch} placeholder={t('search_ph')} size="sm" wrapperClassName="w-full sm:w-72" aria-label={t('search_aria')} />
          </div>
          {isError ? <LoadError onRetry={() => refetch()} /> : (
            <DataTable<TrackedLink>
              rows={filtered}
              loading={isLoading}
              rowKey={l => l.id}
              minWidth={720}
              caption={t('stat_links')}
              onRowClick={l => setStatsFor(l)}
              empty={search ? (
                <EmptyState size="sm" icon={LinkIcon} title={t('no_results')} description={t('no_results_desc')} />
              ) : (
                <EmptyState icon={LinkIcon} title={t('empty_title')}
                  description={t('empty_desc')}
                  action={<Button icon={PlusIcon} onClick={() => setShowForm(true)}>{t('empty_action')}</Button>} />
              )}
              columns={[
                {
                  key: 'title', header: t('col_link'),
                  cell: l => (
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chip text-brand-ink"><LinkIcon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{l.title || t('untitled')}</p>
                        <p className="max-w-[280px] truncate text-xs text-muted" dir="ltr">{l.original_url}</p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'short', header: t('col_short'),
                  cell: l => (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <code dir="ltr" className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs text-link">/l/{l.short_code}</code>
                      <Button size="icon-sm" variant="ghost" icon={ClipboardDocumentIcon} aria-label={t('copy_short')} onClick={() => copyText(shortUrlOf(l))} />
                    </div>
                  ),
                },
                { key: 'created', header: t('col_created'), cell: l => <span className="text-[13px] text-muted">{fmtDate(l.created_at)}</span> },
                { key: 'clicks', header: t('col_clicks'), align: 'end', cell: l => <span className="tabular text-base font-semibold text-ink">{formatNumber(l.click_count || 0)}</span> },
                {
                  key: 'actions', header: <span className="sr-only">{t('col_actions')}</span>, align: 'end',
                  cell: l => (
                    <div onClick={e => e.stopPropagation()}>
                      <Dropdown label={t('link_options')} triggerClassName="h-9 w-9 justify-center text-muted hover:bg-surface-3 hover:text-ink"
                        trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
                        items={[
                          { label: t('click_stats'), icon: ChartBarIcon, onClick: () => setStatsFor(l) },
                          { label: t('copy_short'), icon: ClipboardDocumentIcon, onClick: () => copyText(shortUrlOf(l)) },
                          { label: t('open_target'), icon: ArrowTopRightOnSquareIcon, onClick: () => window.open(l.original_url, '_blank', 'noopener,noreferrer') },
                          { label: tcm('delete'), icon: TrashIcon, danger: true, divider: true, onClick: () => setToDelete(l) },
                        ]} />
                    </div>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>

      <Modal open={showForm} onClose={closeForm} icon={LinkIcon} title={t('new_link')}
        description={t('form_desc')}
        footer={(
          <>
            <Button variant="secondary" onClick={closeForm}>{tcm('cancel')}</Button>
            <Button type="submit" form="link-form" loading={createMut.isLoading} disabled={!form.original_url.trim()} icon={LinkIcon}>{t('create_copy')}</Button>
          </>
        )}>
        <form id="link-form" onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t('f_url')} required error={urlError || undefined}>
            <Input type="url" dir="ltr" value={form.original_url} placeholder="https://example.com/your-page"
              onChange={e => { setForm(f => ({ ...f, original_url: e.target.value })); setUrlError('') }} />
          </Field>
          <Field label={t('f_title')} hint={t('f_title_hint')}>
            <Input value={form.title} maxLength={200} placeholder={t('f_title_ph')} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </Field>
        </form>
      </Modal>

      <LinkStatsModal link={statsFor} shortUrl={statsFor ? shortUrlOf(statsFor) : ''} onClose={() => setStatsFor(null)} />

      <ConfirmDialog destructive open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id) }}
        title={t('delete_title')} description={t('delete_desc')}
        confirmLabel={tcm('delete')} cancelLabel={tcm('cancel')} loading={deleteMut.isLoading} />
    </DashboardLayout>
  )
}
