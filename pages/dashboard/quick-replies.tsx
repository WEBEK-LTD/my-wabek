import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { BoltIcon, ClipboardDocumentIcon, PencilSquareIcon, PlusIcon, TrashIcon, CommandLineIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, PageHeader, SearchInput, Skeleton, Textarea, Tooltip, cn,
} from '@/components/ui'
import { LoadError } from '@/components/analytics/LoadError'
import { apiError } from '@/components/analytics/format'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/quick-replies'
import common from '@/locales/dashboard/common-a'

interface QuickReply { id: string; title: string; message: string; shortcut: string | null; use_count: number | null }
interface FormState { title: string; message: string; shortcut: string }

const EMPTY: FormState = { title: '', message: '', shortcut: '' }

/** Shortcuts are stored as "/key"; older rows may lack the slash. */
const keyOf = (shortcut: string | null | undefined) => (shortcut || '').trim().replace(/^\/+/, '')
const displayShortcut = (shortcut: string | null | undefined) => (keyOf(shortcut) ? `/${keyOf(shortcut)}` : '')

/** WhatsApp-style bubble preview of a reply. */
function BubblePreview({ text, className }: { text: string; className?: string }) {
  const { t } = useT(messages)
  return (
    <div className={cn('rounded-card bg-surface-2 p-3', className)}>
      <div className="ms-auto w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-se-sm bg-chip px-3.5 py-2 text-sm leading-relaxed text-ink shadow-sm" dir="auto">
        {text || <span className="text-muted">{t('preview_empty')}</span>}
      </div>
    </div>
  )
}

function ReplyForm({ initial, saving, onCancel, onSave, taken }: {
  initial: FormState; saving: boolean; onCancel: () => void; onSave: (f: FormState) => void; taken: (key: string) => boolean
}) {
  const { t } = useT(messages)
  const { t: tc } = useT(common)
  const [form, setForm] = useState<FormState>(initial)
  const key = keyOf(form.shortcut)
  const keyError = key && !/^[\p{L}\p{N}_-]+$/u.test(key) ? t('key_invalid') : key && taken(key) ? t('key_taken') : ''
  const valid = form.title.trim() && form.message.trim() && !keyError

  return (
    <form
      className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]"
      onSubmit={e => { e.preventDefault(); if (valid) onSave(form) }}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('f_title')} required>
            <Input value={form.title} maxLength={200} placeholder={t('f_title_ph')} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          </Field>
          <Field label={t('f_shortcut')} hint={t('f_shortcut_hint')} error={keyError || undefined}>
            <div dir="ltr">
              <Input value={key} maxLength={49} placeholder="hi" startAdornment={<span className="font-mono text-muted">/</span>}
                className="font-mono" onChange={e => setForm(f => ({ ...f, shortcut: e.target.value.replace(/\s+/g, '') }))} />
            </div>
          </Field>
        </div>
        <Field label={t('f_message')} required>
          <Textarea rows={5} maxLength={4096} showCount value={form.message} placeholder={t('f_message_ph')}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={saving} disabled={!valid}>{tc('save')}</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>{tc('cancel')}</Button>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">{t('preview')}</p>
        <BubblePreview text={form.message} />
      </div>
    </form>
  )
}

export default function QuickRepliesPage() {
  const { t, fmtNumber } = useT(messages)
  const { t: tc } = useT(common)
  const formatNumber = (n: number) => fmtNumber(Number(n) || 0)
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [toDelete, setToDelete] = useState<QuickReply | null>(null)

  const { data, isLoading, isError, refetch } = useQuery<{ replies: QuickReply[] }>('quick-replies', () => axios.get('/api/quick-replies').then(r => r.data))
  const replies = data?.replies || []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^\//, '')
    if (!q) return replies
    return replies.filter(r => r.title.toLowerCase().includes(q) || r.message.toLowerCase().includes(q) || keyOf(r.shortcut).toLowerCase().includes(q))
  }, [replies, search])

  const saveMut = useMutation(
    ({ id, body }: { id: string | null; body: { title: string; message: string; shortcut: string | null } }) =>
      id ? axios.put(`/api/quick-replies/${id}`, body) : axios.post('/api/quick-replies', body),
    {
      onSuccess: (_r, vars) => {
        qc.invalidateQueries('quick-replies')
        setCreating(false); setEditingId(null)
        toast.success(vars.id ? t('updated') : t('created'))
      },
      onError: (e: unknown) => void toast.error(apiError(e, t('save_failed'))),
    },
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/quick-replies/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('quick-replies'); setToDelete(null); toast.success(t('deleted')) },
      onError: (e: unknown) => void toast.error(apiError(e, t('delete_failed'))),
    },
  )

  const save = (id: string | null) => (f: FormState) => {
    const key = keyOf(f.shortcut)
    saveMut.mutate({ id, body: { title: f.title.trim(), message: f.message, shortcut: key ? `/${key}` : null } })
  }
  const takenBy = (exceptId: string | null) => (key: string) =>
    replies.some(r => r.id !== exceptId && keyOf(r.shortcut).toLowerCase() === key.toLowerCase())

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast.success(t('copied')), () => toast.error(t('copy_failed')))

  return (
    <DashboardLayout title={t('page_title')}>
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={!creating && <Button icon={PlusIcon} onClick={() => { setCreating(true); setEditingId(null) }}>{t('new_reply')}</Button>}
        />

        {creating && (
          <Card padding="lg" className="border-brand-teal/40">
            <h2 className="mb-4 text-base font-semibold text-ink">{t('new_reply')}</h2>
            <ReplyForm initial={EMPTY} saving={saveMut.isLoading} onCancel={() => setCreating(false)} onSave={save(null)} taken={takenBy(null)} />
          </Card>
        )}

        {isError ? (
          <Card><LoadError onRetry={() => refetch()} /></Card>
        ) : isLoading ? (
          <div className="flex flex-col gap-3">{[0, 1, 2].map(i => <Card key={i}><Skeleton lines={3} /></Card>)}</div>
        ) : replies.length === 0 ? (
          !creating && (
            <EmptyState variant="card" icon={BoltIcon} title={t('empty_title')}
              description={t('empty_desc')}
              action={<Button icon={PlusIcon} onClick={() => setCreating(true)}>{t('empty_action')}</Button>} />
          )
        ) : (
          <Card padding="none">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <p className="text-sm text-muted tabular">{t('count', { n: formatNumber(replies.length) })}</p>
              <SearchInput value={search} onChange={setSearch} placeholder={t('search_ph')} size="sm" wrapperClassName="w-full sm:w-80" aria-label={t('search_aria')} />
            </div>
            {filtered.length === 0 ? (
              <EmptyState size="sm" icon={CommandLineIcon} title={t('no_results')} description={t('no_results_desc')} />
            ) : (
              <ul className="divide-y divide-line-soft border-t border-line-soft">
                {filtered.map(reply => (
                  <li key={reply.id} className={cn('px-5 py-4 transition-colors sm:px-6', editingId === reply.id ? 'bg-surface-2' : 'hover:bg-surface-2/60')}>
                    {editingId === reply.id ? (
                      <ReplyForm
                        initial={{ title: reply.title, message: reply.message, shortcut: keyOf(reply.shortcut) }}
                        saving={saveMut.isLoading} onCancel={() => setEditingId(null)} onSave={save(reply.id)} taken={takenBy(reply.id)} />
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-ink">{reply.title}</h3>
                            {displayShortcut(reply.shortcut) && (
                              <code dir="ltr" className="rounded-lg bg-chip px-2 py-0.5 font-mono text-xs font-semibold text-chip-ink">{displayShortcut(reply.shortcut)}</code>
                            )}
                            <Badge tone="neutral" size="sm">{t('uses', { n: formatNumber(reply.use_count || 0) })}</Badge>
                          </div>
                          <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-body" dir="auto">{reply.message}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
                          <Tooltip content={t('copy_text')}><Button size="icon-sm" variant="ghost" icon={ClipboardDocumentIcon} aria-label={t('copy_text')} onClick={() => copy(reply.message)} /></Tooltip>
                          <Tooltip content={tc('edit')}><Button size="icon-sm" variant="ghost" icon={PencilSquareIcon} aria-label={t('edit_x', { name: reply.title })} onClick={() => { setEditingId(reply.id); setCreating(false) }} /></Tooltip>
                          <Tooltip content={tc('delete')}><Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={t('delete_x', { name: reply.title })} className="hover:text-danger" onClick={() => setToDelete(reply)} /></Tooltip>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <ConfirmDialog destructive open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id) }}
        title={t('delete_title')} description={toDelete ? t('delete_desc', { name: toDelete.title }) : undefined} confirmLabel={tc('delete')} cancelLabel={tc('cancel')} loading={deleteMut.isLoading} />
    </DashboardLayout>
  )
}
