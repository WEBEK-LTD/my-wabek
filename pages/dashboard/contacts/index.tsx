import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import {
  ArrowDownTrayIcon, ArrowUpTrayIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisHorizontalIcon, EnvelopeIcon,
  FunnelIcon, NoSymbolIcon, PhoneIcon, PlusIcon, RectangleGroupIcon, TagIcon, TrashIcon, UserGroupIcon, UserIcon,
  XMarkIcon, CheckCircleIcon, ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Avatar, Badge, Button, Card, Checkbox, ConfirmDialog, DataTable, Dropdown, EmptyState, Field, Input, Modal, PageHeader,
  SearchInput, cn,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { ImportWizard } from '@/components/contacts/ImportWizard'
import { Segment, segmentTags } from '@/components/contacts/segmentRules'
import { LoadError } from '@/components/analytics/LoadError'
import { apiError, downloadCSV, todayStamp } from '@/components/analytics/format'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/contacts'
import common from '@/locales/dashboard/common-a'

interface Contact {
  id: string; phone: string; name: string | null; email: string | null; tags: string[] | null
  is_blocked: boolean; opted_out: boolean; created_at: string
}
interface ContactsResponse { contacts: Contact[]; total: number; page: number }
type BulkAction = 'delete' | 'block' | 'unblock' | 'add_tag'

const PAGE_SIZE = 100

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

function contactsUrl(search: string, tags: string[], page: number, limit = PAGE_SIZE) {
  const p = new URLSearchParams({ search, limit: String(limit), page: String(page) })
  if (tags.length) p.set('tags', tags.join(','))
  return `/api/contacts?${p.toString()}`
}

function StatusBadge({ c }: { c: Contact }) {
  const { t } = useT(messages)
  if (c.is_blocked) return <Badge tone="danger" dot>{t('st_blocked')}</Badge>
  if (c.opted_out) return <Badge tone="warning" dot>{t('st_opted_out')}</Badge>
  return <Badge tone="success" dot>{t('st_active')}</Badge>
}

export default function ContactsPage() {
  const { t, fmtNumber, fmtDate } = useT(messages)
  const { t: tc } = useT(common)
  const formatNumber = (n: number) => fmtNumber(Number(n) || 0)
  const qc = useQueryClient()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search.trim())
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [bulkTagOpen, setBulkTagOpen] = useState(false)
  const [bulkTag, setBulkTag] = useState('')
  const [segmentOpen, setSegmentOpen] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [toDelete, setToDelete] = useState<Contact | null>(null)
  const [exporting, setExporting] = useState(false)

  // ?tag=vip (e.g. from the segments page) pre-filters the list.
  useEffect(() => {
    const q = router.query.tag
    if (typeof q === 'string' && q) setTagFilter(q.split(',').map(s => s.trim()).filter(Boolean))
  }, [router.query.tag])

  useEffect(() => { setPage(1); setSelected(new Set()) }, [debounced, tagFilter])
  useEffect(() => { setSelected(new Set()) }, [page])

  const { data, isLoading, isFetching, isError, refetch } = useQuery<ContactsResponse>(
    ['contacts', debounced, tagFilter.join(','), page],
    () => axios.get(contactsUrl(debounced, tagFilter, page)).then(r => r.data),
    { keepPreviousData: true },
  )
  const contacts = data?.contacts || []
  const total = data?.total || 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Remember every tag seen so the filter chips stay stable while filtering.
  useEffect(() => {
    if (!contacts.length) return
    setKnownTags(prev => {
      const s = new Set(prev)
      contacts.forEach(c => (c.tags || []).forEach(tag => s.add(tag)))
      return s.size === prev.length ? prev : Array.from(s).sort((a, b) => a.localeCompare(b))
    })
  }, [contacts])
  const filterTags = useMemo(() => Array.from(new Set([...tagFilter, ...knownTags])), [tagFilter, knownTags])

  const { data: segData } = useQuery<{ segments: Segment[] }>('segments', () => axios.get('/api/segments').then(r => r.data), { enabled: segmentOpen })
  const segments = segData?.segments || []

  const invalidate = () => { qc.invalidateQueries('contacts'); qc.invalidateQueries('segments') }

  /* ── Single contact ─────────────────────────────── */
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ phone: string; name: string; email: string; tags: string }>()
  const createMut = useMutation(
    (body: object) => axios.post('/api/contacts', body),
    {
      onSuccess: () => { invalidate(); reset(); setShowAdd(false); toast.success(t('added_toast')) },
      onError: (e: unknown) => {
        const status = (e as { response?: { status?: number } })?.response?.status
        toast.error(status === 409 ? t('exists') : apiError(e, t('add_failed')))
      },
    },
  )
  const onSubmit = (f: { phone: string; name: string; email: string; tags: string }) => {
    createMut.mutate({
      phone: f.phone.trim(), name: f.name || undefined, email: f.email || undefined,
      tags: f.tags ? f.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
    })
  }

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/contacts/${id}`),
    {
      onSuccess: () => { invalidate(); setToDelete(null); toast.success(t('deleted_toast')) },
      onError: (e: unknown) => { toast.error(apiError(e, t('delete_failed'))) },
    },
  )

  /* ── Bulk ───────────────────────────────────────── */
  const bulkMut = useMutation(
    async ({ action, tags }: { action: BulkAction; tags?: string[] }) => {
      const ids = Array.from(selected)
      if (action === 'add_tag') {
        for (const tag of tags || []) await axios.post('/api/contacts/bulk', { ids, action, tag })
      } else {
        await axios.post('/api/contacts/bulk', { ids, action })
      }
      return { action, count: ids.length, tags }
    },
    {
      onSuccess: ({ action, count, tags }) => {
        invalidate()
        const n = formatNumber(count)
        const msg: Record<BulkAction, string> = {
          delete: t('bulk_deleted', { n }), block: t('bulk_blocked', { n }), unblock: t('bulk_unblocked', { n }),
          add_tag: t('bulk_tagged', { tags: (tags || []).join(t('list_sep')), n }),
        }
        toast.success(msg[action])
        if (action === 'delete') setSelected(new Set())
        setBulkTagOpen(false); setBulkTag(''); setSegmentOpen(false); setConfirmBulkDelete(false)
      },
      onError: (e: unknown) => { toast.error(apiError(e, t('action_failed'))) },
    },
  )

  /* ── Export (all pages for the current filters) ─── */
  const exportCSV = async () => {
    setExporting(true)
    try {
      const all: Contact[] = []
      for (let p = 1; p <= 100; p++) {
        const { data: d } = await axios.get<ContactsResponse>(contactsUrl(debounced, tagFilter, p, 200))
        all.push(...(d.contacts || []))
        if (!d.contacts?.length || all.length >= (d.total || 0)) break
      }
      downloadCSV(`wabek-contacts-${todayStamp()}.csv`, [
        ['phone', 'name', 'email', 'tags'],
        ...all.map(c => [c.phone, c.name || '', c.email || '', (c.tags || []).join(';')]),
      ])
      toast.success(t('exported', { n: formatNumber(all.length) }))
    } catch (e) {
      toast.error(apiError(e, t('export_failed')))
    } finally {
      setExporting(false)
    }
  }

  /* ── Selection ──────────────────────────────────── */
  const pageIds = contacts.map(c => c.id)
  const allOnPage = pageIds.length > 0 && pageIds.every(id => selected.has(id))
  const someOnPage = pageIds.some(id => selected.has(id))
  const toggle = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(pageIds))
  const selectedContacts = contacts.filter(c => selected.has(c.id))
  const anyBlocked = selectedContacts.some(c => c.is_blocked)

  const toggleTag = (tag: string) => setTagFilter(prev => (prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag]))
  const clearFilters = () => {
    setSearch(''); setTagFilter([])
    if (router.query.tag) router.replace('/dashboard/contacts', undefined, { shallow: true })
  }
  const filtering = !!debounced || tagFilter.length > 0

  const columns: Column<Contact>[] = [
    {
      key: 'select',
      header: (
        <Checkbox aria-label={t('select_all_aria')} checked={allOnPage}
          ref={el => { if (el) el.indeterminate = !allOnPage && someOnPage }} onChange={toggleAll} />
      ),
      headerClassName: 'w-12',
      cell: c => (
        <div onClick={e => e.stopPropagation()}>
          <Checkbox aria-label={t('select_x', { name: c.name || c.phone })} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
        </div>
      ),
    },
    {
      key: 'name', header: t('col_contact'),
      cell: c => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={c.name || c.phone} size="sm" />
          <div className="min-w-0">
            <p className={cn('truncate font-medium', c.name ? 'text-ink' : 'text-muted')}>{c.name || t('no_name')}</p>
            {c.email && <p className="truncate text-xs text-muted" dir="ltr">{c.email}</p>}
          </div>
        </div>
      ),
    },
    { key: 'phone', header: t('col_phone'), cell: c => <span dir="ltr" className="tabular font-mono text-[13px]">{c.phone}</span> },
    {
      key: 'tags', header: t('col_tags'),
      cell: c => {
        const tags = c.tags || []
        if (!tags.length) return <span className="text-muted">—</span>
        return (
          <div className="flex max-w-[240px] flex-wrap gap-1">
            {tags.slice(0, 3).map(tag => <Badge key={tag} tone="brand" size="sm">{tag}</Badge>)}
            {tags.length > 3 && <Badge tone="neutral" size="sm"><span dir="ltr">+{tags.length - 3}</span></Badge>}
          </div>
        )
      },
    },
    { key: 'status', header: t('col_status'), cell: c => <StatusBadge c={c} /> },
    { key: 'created', header: t('col_added'), cell: c => <span className="text-[13px] text-muted">{fmtDate(c.created_at)}</span> },
    {
      key: 'actions', header: <span className="sr-only">{t('col_actions')}</span>, align: 'end',
      cell: c => (
        <div onClick={e => e.stopPropagation()}>
          <Dropdown label={t('options_for', { name: c.name || c.phone })} triggerClassName="h-9 w-9 justify-center text-muted hover:bg-surface-3 hover:text-ink"
            trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
            items={[
              { label: t('open_profile'), icon: ArrowTopRightOnSquareIcon, href: `/dashboard/contacts/${c.id}` },
              { label: tc('delete'), icon: TrashIcon, danger: true, divider: true, onClick: () => setToDelete(c) },
            ]} />
        </div>
      ),
    },
  ]

  return (
    <DashboardLayout title={t('page_title')}>
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={(
            <>
              <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={exportCSV} loading={exporting} disabled={!total}>{t('export')}</Button>
              <Button variant="secondary" icon={ArrowUpTrayIcon} onClick={() => setShowImport(true)}>{t('import_csv')}</Button>
              <Button icon={PlusIcon} onClick={() => setShowAdd(true)}>{t('new_contact')}</Button>
            </>
          )}
        />

        <Card padding="none" className="overflow-visible">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput value={search} onChange={setSearch} placeholder={t('search_ph')} wrapperClassName="w-full sm:max-w-sm sm:flex-1" aria-label={t('search_aria')} />
              <p className="text-sm text-muted" aria-live="polite">
                {isLoading ? '…' : <span className="tabular">{t(filtering ? 'count_match' : 'count', { n: formatNumber(total) })}</span>}
              </p>
              {filtering && <Button variant="ghost" size="sm" icon={XMarkIcon} onClick={clearFilters}>{t('clear_filters')}</Button>}
            </div>
            {filterTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('tag_filter_aria')}>
                <FunnelIcon className="h-4 w-4 text-muted" aria-hidden="true" />
                <span className="me-1 text-xs text-muted">{t('tags_label')}</span>
                {filterTags.slice(0, 16).map(tag => {
                  const on = tagFilter.includes(tag)
                  return (
                    <button key={tag} type="button" aria-pressed={on} onClick={() => toggleTag(tag)}
                      className={cn('inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition',
                        on ? 'border-transparent bg-brand-gradient text-[#04282C]' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink')}>
                      {on ? <CheckCircleIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <TagIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                      {tag}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-y border-line bg-chip/70 px-5 py-2.5 backdrop-blur sm:px-6">
              <span className="text-sm font-semibold text-chip-ink tabular">{t('selected_n', { n: formatNumber(selected.size) })}</span>
              <span className="mx-1 h-5 w-px bg-line-strong" aria-hidden="true" />
              <Button size="sm" variant="secondary" icon={TagIcon} onClick={() => setBulkTagOpen(true)}>{t('add_tag')}</Button>
              <Button size="sm" variant="secondary" icon={RectangleGroupIcon} onClick={() => setSegmentOpen(true)}>{t('add_to_segment')}</Button>
              <Button size="sm" variant="secondary" icon={NoSymbolIcon} loading={bulkMut.isLoading && (bulkMut.variables?.action === 'block' || bulkMut.variables?.action === 'unblock')}
                onClick={() => bulkMut.mutate({ action: anyBlocked ? 'unblock' : 'block' })}>
                {anyBlocked ? t('unblock') : t('block')}
              </Button>
              <Button size="sm" variant="danger-soft" icon={TrashIcon} onClick={() => setConfirmBulkDelete(true)}>{tc('delete')}</Button>
              <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setSelected(new Set())}>{t('clear_selection')}</Button>
            </div>
          )}

          {isError ? <LoadError onRetry={() => refetch()} /> : (
            <div className={cn('transition-opacity', isFetching && !isLoading && 'opacity-60')}>
              <DataTable<Contact>
                rows={contacts}
                loading={isLoading}
                skeletonRows={8}
                rowKey={c => c.id}
                minWidth={720}
                caption={t('table_caption')}
                onRowClick={c => router.push(`/dashboard/contacts/${c.id}`)}
                columns={columns}
                empty={filtering ? (
                  <EmptyState size="sm" icon={UserGroupIcon} title={t('no_match_title')} description={t('no_match_desc')}
                    action={<Button size="sm" variant="secondary" onClick={clearFilters}>{t('clear_filters')}</Button>} />
                ) : (
                  <EmptyState icon={UserGroupIcon} title={t('empty_title')}
                    description={t('empty_desc')}
                    action={<><Button icon={ArrowUpTrayIcon} onClick={() => setShowImport(true)}>{t('import_csv')}</Button><Button variant="secondary" icon={PlusIcon} onClick={() => setShowAdd(true)}>{t('add_manually')}</Button></>} />
                )}
              />
            </div>
          )}

          {total > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3 text-sm text-muted sm:px-6">
              <span className="tabular">{t('range', { from: formatNumber((page - 1) * PAGE_SIZE + 1), to: formatNumber(Math.min(page * PAGE_SIZE, total)), total: formatNumber(total) })}</span>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="secondary" icon={ChevronRightIcon} disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="[&>svg]:ltr:rotate-180">{t('prev')}</Button>
                <span className="tabular px-2">{formatNumber(page)} / {formatNumber(pages)}</span>
                <Button size="sm" variant="secondary" iconEnd={ChevronLeftIcon} disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="[&>svg]:ltr:rotate-180">{t('next')}</Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Add contact */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} icon={UserIcon} title={t('new_contact')}
        footer={<><Button variant="secondary" onClick={() => setShowAdd(false)}>{tc('cancel')}</Button><Button type="submit" form="add-contact" loading={createMut.isLoading}>{t('add')}</Button></>}>
        <form id="add-contact" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label={t('f_phone')} required hint={t('f_phone_hint')} error={errors.phone ? t('f_phone_error') : undefined}>
            <Input dir="ltr" type="tel" icon={PhoneIcon} placeholder="+966501234567" {...register('phone', { required: true, minLength: 5 })} />
          </Field>
          <Field label={t('f_name')}><Input icon={UserIcon} placeholder={t('f_name_ph')} {...register('name')} /></Field>
          <Field label={t('f_email')}><Input dir="ltr" type="email" icon={EnvelopeIcon} placeholder="ahmed@example.com" {...register('email')} /></Field>
          <Field label={t('f_tags')} hint={t('f_tags_hint')}><Input icon={TagIcon} placeholder={t('f_tags_ph')} {...register('tags')} /></Field>
        </form>
      </Modal>

      <ImportWizard open={showImport} onClose={() => setShowImport(false)} onImported={invalidate} />

      {/* Bulk: add tag */}
      <Modal open={bulkTagOpen} onClose={() => setBulkTagOpen(false)} size="sm" icon={TagIcon} title={t('add_tag')}
        description={t('bulk_tag_desc', { n: formatNumber(selected.size) })}
        footer={<><Button variant="secondary" onClick={() => setBulkTagOpen(false)}>{tc('cancel')}</Button><Button type="submit" form="bulk-tag" loading={bulkMut.isLoading} disabled={!bulkTag.trim()}>{t('add')}</Button></>}>
        <form id="bulk-tag" className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); if (bulkTag.trim()) bulkMut.mutate({ action: 'add_tag', tags: [bulkTag.trim()] }) }}>
          <Field label={t('f_tag')}><Input value={bulkTag} maxLength={100} onChange={e => setBulkTag(e.target.value)} placeholder="vip" autoFocus /></Field>
          {knownTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {knownTags.slice(0, 12).map(tag => (
                <button key={tag} type="button" onClick={() => setBulkTag(tag)} className={cn('rounded-full border px-2.5 py-1 text-xs transition', bulkTag === tag ? 'border-brand-teal bg-chip text-chip-ink' : 'border-line text-muted hover:text-ink')}>{tag}</button>
              ))}
            </div>
          )}
        </form>
      </Modal>

      {/* Bulk: add to segment */}
      <Modal open={segmentOpen} onClose={() => setSegmentOpen(false)} icon={RectangleGroupIcon} title={t('add_to_segment')}
        description={t('seg_desc')}
        footer={<Button variant="secondary" onClick={() => setSegmentOpen(false)}>{tc('close')}</Button>}>
        {segments.length === 0 ? (
          <EmptyState size="sm" icon={RectangleGroupIcon} title={t('seg_empty_title')} description={t('seg_empty_desc')}
            action={<Button size="sm" href="/dashboard/segments">{t('create_segment')}</Button>} />
        ) : (
          <ul className="flex flex-col gap-2">
            {segments.map(seg => {
              const tags = segmentTags(seg)
              return (
                <li key={seg.id} className="flex items-center gap-3 rounded-card border border-line p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{seg.name}</p>
                    <p className="text-xs text-muted">
                      {tags ? <>{t('seg_tags_added')} {tags.map(tag => <Badge key={tag} tone="brand" size="sm" className="ms-1">{tag}</Badge>)}</> : t('seg_not_tags')}
                    </p>
                  </div>
                  <Button size="sm" disabled={!tags} loading={bulkMut.isLoading && bulkMut.variables?.action === 'add_tag'}
                    onClick={() => tags && bulkMut.mutate({ action: 'add_tag', tags })}>{t('add')}</Button>
                </li>
              )
            })}
          </ul>
        )}
      </Modal>

      <ConfirmDialog destructive open={confirmBulkDelete} onClose={() => setConfirmBulkDelete(false)} onConfirm={() => bulkMut.mutate({ action: 'delete' })}
        title={t('bulk_delete_title', { n: formatNumber(selected.size) })} description={t('bulk_delete_desc')}
        confirmLabel={tc('delete')} cancelLabel={tc('cancel')} loading={bulkMut.isLoading && bulkMut.variables?.action === 'delete'} />

      <ConfirmDialog destructive open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id) }}
        title={t('delete_title')} description={toDelete ? t('delete_desc', { name: toDelete.name || toDelete.phone }) : undefined}
        confirmLabel={tc('delete')} cancelLabel={tc('cancel')} loading={deleteMut.isLoading} />
    </DashboardLayout>
  )
}
