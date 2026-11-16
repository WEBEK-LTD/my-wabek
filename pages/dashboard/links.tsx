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
  SearchInput, Skeleton, StatCard, Table, TBody, TD, TH, THead, TR, formatNumber,
} from '@/components/ui'
import { LoadError } from '@/components/analytics/LoadError'
import { apiError, formatDate, formatDateTime, formatDay } from '@/components/analytics/format'

interface TrackedLink {
  id: string; title: string | null; original_url: string; short_code: string; click_count: number | null; created_at: string
}
interface LinkClick { id: string; clicked_at: string; contact_phone?: string | null; country?: string | null; user_agent?: string | null }

function copyText(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success('تم النسخ'), () => toast.error('تعذّر النسخ'))
}

function deviceOf(ua?: string | null): string {
  if (!ua) return '—'
  if (/iphone|ipad|ios/i.test(ua)) return 'iOS'
  if (/android/i.test(ua)) return 'Android'
  if (/windows/i.test(ua)) return 'Windows'
  if (/mac os/i.test(ua)) return 'macOS'
  if (/linux/i.test(ua)) return 'Linux'
  return 'أخرى'
}

/** Click details for one link (GET /api/links/:id — latest 100 clicks). */
function LinkStatsModal({ link, shortUrl, onClose }: { link: TrackedLink | null; shortUrl: string; onClose: () => void }) {
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
      days.push({ key: d.toISOString().slice(0, 10), label: formatDay(d), count: 0 })
    }
    for (const c of clicks) {
      const day = days.find(d => d.key === c.clicked_at?.slice(0, 10))
      if (day) day.count++
    }
    return days
  }, [clicks])

  return (
    <Modal open={!!link} onClose={onClose} size="lg" icon={ChartBarIcon}
      title={link?.title || 'رابط بلا عنوان'}
      description={<span dir="ltr" className="font-mono text-xs">{shortUrl}</span>}
      footer={<Button variant="secondary" onClick={onClose}>إغلاق</Button>}>
      {isError ? <LoadError size="sm" onRetry={() => refetch()} /> : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-card border border-line bg-surface-2 p-4">
              <p className="text-xs text-muted">إجمالي النقرات</p>
              <p className="tabular mt-1 text-2xl font-bold text-ink">{formatNumber(link?.click_count || 0)}</p>
            </div>
            <div className="rounded-card border border-line bg-surface-2 p-4">
              <p className="text-xs text-muted">آخر نقرة</p>
              <p className="mt-1 text-sm font-semibold text-ink">{isLoading ? '…' : clicks[0] ? formatDateTime(clicks[0].clicked_at) : 'لا توجد نقرات بعد'}</p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">النقرات اليومية · آخر 14 يومًا</h3>
            {isLoading ? <Skeleton className="h-40 w-full" /> : (
              <AreaChart height={160} labels={daily.map(d => d.label)} series={[{ name: 'نقرات', data: daily.map(d => d.count) }]} showLegend={false} ariaLabel="النقرات اليومية" />
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">أحدث النقرات</h3>
            {isLoading ? <Skeleton lines={4} /> : clicks.length === 0 ? (
              <EmptyState size="sm" icon={CursorArrowRaysIcon} title="لا توجد نقرات بعد" description="شارك الرابط المختصر في رسائلك لتبدأ بتتبّع النقرات." />
            ) : (
              <div className="overflow-hidden rounded-card border border-line">
                <Table minWidth={420} dense caption="أحدث النقرات">
                  <THead><TR><TH>الوقت</TH><TH>الجهاز</TH><TH>الدولة</TH></TR></THead>
                  <TBody>
                    {clicks.slice(0, 20).map(c => (
                      <TR key={c.id}>
                        <TD className="tabular text-[13px]">{formatDateTime(c.clicked_at)}</TD>
                        <TD className="text-[13px]">{deviceOf(c.user_agent)}</TD>
                        <TD className="text-[13px]">{c.country || '—'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
            {clicks.length >= 100 && <p className="mt-2 text-xs text-muted">تعرض الإحصاءات اليومية آخر 100 نقرة.</p>}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function LinksPage() {
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
        toast.success(`أُنشئ الرابط ونُسخ: ${url}`)
      },
      onError: (e: unknown) => void toast.error(apiError(e, 'تعذّر إنشاء الرابط')),
    },
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/links/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('tracked-links'); setToDelete(null); toast.success('حُذف الرابط') },
      onError: (e: unknown) => void toast.error(apiError(e, 'تعذّر حذف الرابط')),
    },
  )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const u = new URL(form.original_url.trim())
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol')
    } catch {
      setUrlError('أدخل رابطًا صالحًا يبدأ بـ https:// أو http://')
      return
    }
    createMut.mutate({ original_url: form.original_url.trim(), title: form.title })
  }

  return (
    <DashboardLayout title="Link Tracker">
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="التكاملات"
          title="تتبّع الروابط"
          description="أنشئ روابط مختصرة لرسائلك وحملاتك، واعرف عدد من نقر عليها ومتى."
          actions={<Button icon={PlusIcon} onClick={() => setShowForm(true)}>رابط مختصر جديد</Button>}
        />

        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <StatCard loading={isLoading} label="الروابط المتتبَّعة" value={formatNumber(links.length)} icon={LinkIcon} />
          <StatCard loading={isLoading} label="إجمالي النقرات" value={formatNumber(totalClicks)} icon={CursorArrowRaysIcon} />
          <StatCard loading={isLoading} label="الأكثر نقرًا" icon={ChartBarIcon}
            value={top && (top.click_count || 0) > 0 ? formatNumber(top.click_count || 0) : '—'}
            sub={top && (top.click_count || 0) > 0 ? (top.title || `/${top.short_code}`) : 'لا توجد نقرات بعد'} />
        </div>

        <Card padding="none">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <h2 className="text-base font-semibold text-ink">جميع الروابط</h2>
            <SearchInput value={search} onChange={setSearch} placeholder="ابحث بالعنوان أو الرابط" size="sm" wrapperClassName="w-full sm:w-72" aria-label="بحث في الروابط" />
          </div>
          {isError ? <LoadError onRetry={() => refetch()} /> : (
            <DataTable<TrackedLink>
              rows={filtered}
              loading={isLoading}
              rowKey={l => l.id}
              minWidth={720}
              caption="الروابط المتتبَّعة"
              onRowClick={l => setStatsFor(l)}
              empty={search ? (
                <EmptyState size="sm" icon={LinkIcon} title="لا توجد نتائج" description="جرّب كلمة بحث أخرى." />
              ) : (
                <EmptyState icon={LinkIcon} title="لا توجد روابط متتبَّعة بعد"
                  description="أنشئ رابطًا مختصرًا وضعه في رسائل واتساب لتعرف من ينقر عليه."
                  action={<Button icon={PlusIcon} onClick={() => setShowForm(true)}>إنشاء أول رابط</Button>} />
              )}
              columns={[
                {
                  key: 'title', header: 'الرابط',
                  cell: l => (
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chip text-brand-ink"><LinkIcon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{l.title || 'رابط بلا عنوان'}</p>
                        <p className="max-w-[280px] truncate text-xs text-muted" dir="ltr">{l.original_url}</p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'short', header: 'الرابط المختصر',
                  cell: l => (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <code dir="ltr" className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs text-link">/l/{l.short_code}</code>
                      <Button size="icon-sm" variant="ghost" icon={ClipboardDocumentIcon} aria-label="نسخ الرابط المختصر" onClick={() => copyText(shortUrlOf(l))} />
                    </div>
                  ),
                },
                { key: 'created', header: 'أُنشئ', cell: l => <span className="text-[13px] text-muted">{formatDate(l.created_at)}</span> },
                { key: 'clicks', header: 'النقرات', align: 'end', cell: l => <span className="tabular text-base font-semibold text-ink">{formatNumber(l.click_count || 0)}</span> },
                {
                  key: 'actions', header: <span className="sr-only">إجراءات</span>, align: 'end',
                  cell: l => (
                    <div onClick={e => e.stopPropagation()}>
                      <Dropdown label="خيارات الرابط" triggerClassName="h-9 w-9 justify-center text-muted hover:bg-surface-3 hover:text-ink"
                        trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
                        items={[
                          { label: 'إحصاءات النقرات', icon: ChartBarIcon, onClick: () => setStatsFor(l) },
                          { label: 'نسخ الرابط المختصر', icon: ClipboardDocumentIcon, onClick: () => copyText(shortUrlOf(l)) },
                          { label: 'فتح الوجهة', icon: ArrowTopRightOnSquareIcon, onClick: () => window.open(l.original_url, '_blank', 'noopener,noreferrer') },
                          { label: 'حذف', icon: TrashIcon, danger: true, divider: true, onClick: () => setToDelete(l) },
                        ]} />
                    </div>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>

      <Modal open={showForm} onClose={closeForm} icon={LinkIcon} title="رابط مختصر جديد"
        description="سيُنسخ الرابط المختصر تلقائيًا بعد إنشائه."
        footer={(
          <>
            <Button variant="secondary" onClick={closeForm}>إلغاء</Button>
            <Button type="submit" form="link-form" loading={createMut.isLoading} disabled={!form.original_url.trim()} icon={LinkIcon}>إنشاء ونسخ</Button>
          </>
        )}>
        <form id="link-form" onSubmit={submit} className="flex flex-col gap-4">
          <Field label="الرابط الأصلي" required error={urlError || undefined}>
            <Input type="url" dir="ltr" value={form.original_url} placeholder="https://example.com/your-page"
              onChange={e => { setForm(f => ({ ...f, original_url: e.target.value })); setUrlError('') }} />
          </Field>
          <Field label="العنوان" hint="اختياري — يساعدك على تمييز الرابط لاحقًا.">
            <Input value={form.title} maxLength={200} placeholder="صفحة تخفيضات الصيف" onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </Field>
        </form>
      </Modal>

      <LinkStatsModal link={statsFor} shortUrl={statsFor ? shortUrlOf(statsFor) : ''} onClose={() => setStatsFor(null)} />

      <ConfirmDialog destructive open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id) }}
        title="حذف الرابط؟" description="سيتوقف الرابط المختصر عن العمل وتُحذف إحصاءات نقراته. لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف" loading={deleteMut.isLoading} />
    </DashboardLayout>
  )
}
