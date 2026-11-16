import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { BoltIcon, ClipboardDocumentIcon, PencilSquareIcon, PlusIcon, TrashIcon, CommandLineIcon } from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, PageHeader, SearchInput, Skeleton, Textarea, Tooltip, cn, formatNumber,
} from '@/components/ui'
import { LoadError } from '@/components/analytics/LoadError'
import { apiError } from '@/components/analytics/format'

interface QuickReply { id: string; title: string; message: string; shortcut: string | null; use_count: number | null }
interface FormState { title: string; message: string; shortcut: string }

const EMPTY: FormState = { title: '', message: '', shortcut: '' }

/** Shortcuts are stored as "/key"; older rows may lack the slash. */
const keyOf = (shortcut: string | null | undefined) => (shortcut || '').trim().replace(/^\/+/, '')
const displayShortcut = (shortcut: string | null | undefined) => (keyOf(shortcut) ? `/${keyOf(shortcut)}` : '')

/** WhatsApp-style bubble preview of a reply. */
function BubblePreview({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('rounded-card bg-surface-2 p-3', className)}>
      <div className="ms-auto w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-se-sm bg-chip px-3.5 py-2 text-sm leading-relaxed text-ink shadow-sm" dir="auto">
        {text || <span className="text-muted">ستظهر معاينة الرسالة هنا</span>}
      </div>
    </div>
  )
}

function ReplyForm({ initial, saving, onCancel, onSave, taken }: {
  initial: FormState; saving: boolean; onCancel: () => void; onSave: (f: FormState) => void; taken: (key: string) => boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  const key = keyOf(form.shortcut)
  const keyError = key && !/^[\p{L}\p{N}_-]+$/u.test(key) ? 'استخدم حروفًا أو أرقامًا أو - و _ فقط، بلا مسافات.' : key && taken(key) ? 'هذا الاختصار مستخدم في ردٍّ آخر.' : ''
  const valid = form.title.trim() && form.message.trim() && !keyError

  return (
    <form
      className="grid gap-5 lg:grid-cols-[1fr_minmax(0,320px)]"
      onSubmit={e => { e.preventDefault(); if (valid) onSave(form) }}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="العنوان" required>
            <Input value={form.title} maxLength={200} placeholder="مثال: ترحيب" onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          </Field>
          <Field label="الاختصار" hint="اكتب / ثم الاختصار في المحادثة للعثور على الرد بسرعة." error={keyError || undefined}>
            <Input dir="ltr" value={key} maxLength={49} placeholder="hi" startAdornment={<span className="font-mono text-muted">/</span>}
              className="font-mono" onChange={e => setForm(f => ({ ...f, shortcut: e.target.value.replace(/\s+/g, '') }))} />
          </Field>
        </div>
        <Field label="نص الرسالة" required>
          <Textarea rows={5} maxLength={4096} showCount value={form.message} placeholder="مرحبًا! شكرًا لتواصلك معنا، كيف يمكننا مساعدتك؟"
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={saving} disabled={!valid}>حفظ</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>إلغاء</Button>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">المعاينة</p>
        <BubblePreview text={form.message} />
      </div>
    </form>
  )
}

export default function QuickRepliesPage() {
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
        toast.success(vars.id ? 'حُدّث الرد السريع' : 'أُنشئ الرد السريع')
      },
      onError: (e: unknown) => void toast.error(apiError(e, 'تعذّر الحفظ')),
    },
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/quick-replies/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('quick-replies'); setToDelete(null); toast.success('حُذف الرد السريع') },
      onError: (e: unknown) => void toast.error(apiError(e, 'تعذّر الحذف')),
    },
  )

  const save = (id: string | null) => (f: FormState) => {
    const key = keyOf(f.shortcut)
    saveMut.mutate({ id, body: { title: f.title.trim(), message: f.message, shortcut: key ? `/${key}` : null } })
  }
  const takenBy = (exceptId: string | null) => (key: string) =>
    replies.some(r => r.id !== exceptId && keyOf(r.shortcut).toLowerCase() === key.toLowerCase())

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast.success('نُسخت الرسالة'), () => toast.error('تعذّر النسخ'))

  return (
    <DashboardLayout title="Quick Replies">
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="الأتمتة والذكاء الاصطناعي"
          title="الردود السريعة"
          description="احفظ الردود المتكررة واستخدمها في المحادثات بنقرة أو باختصار يبدأ بـ /."
          actions={!creating && <Button icon={PlusIcon} onClick={() => { setCreating(true); setEditingId(null) }}>رد سريع جديد</Button>}
        />

        {creating && (
          <Card padding="lg" className="border-brand-teal/40">
            <h2 className="mb-4 text-base font-semibold text-ink">رد سريع جديد</h2>
            <ReplyForm initial={EMPTY} saving={saveMut.isLoading} onCancel={() => setCreating(false)} onSave={save(null)} taken={takenBy(null)} />
          </Card>
        )}

        {isError ? (
          <Card><LoadError onRetry={() => refetch()} /></Card>
        ) : isLoading ? (
          <div className="flex flex-col gap-3">{[0, 1, 2].map(i => <Card key={i}><Skeleton lines={3} /></Card>)}</div>
        ) : replies.length === 0 ? (
          !creating && (
            <EmptyState variant="card" icon={BoltIcon} title="لا توجد ردود سريعة بعد"
              description="احفظ الإجابات الشائعة مثل الترحيب وساعات العمل وطرق الدفع، لترد على عملائك أسرع."
              action={<Button icon={PlusIcon} onClick={() => setCreating(true)}>إنشاء أول رد</Button>} />
          )
        ) : (
          <Card padding="none">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <p className="text-sm text-muted"><span className="tabular font-semibold text-ink">{formatNumber(replies.length)}</span> رد سريع · مرتبة حسب الاستخدام</p>
              <SearchInput value={search} onChange={setSearch} placeholder="ابحث بالعنوان أو النص أو /الاختصار" size="sm" wrapperClassName="w-full sm:w-80" aria-label="بحث في الردود السريعة" />
            </div>
            {filtered.length === 0 ? (
              <EmptyState size="sm" icon={CommandLineIcon} title="لا توجد نتائج" description="جرّب كلمة بحث أخرى." />
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
                            <Badge tone="neutral" size="sm">{formatNumber(reply.use_count || 0)} استخدام</Badge>
                          </div>
                          <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-body" dir="auto">{reply.message}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
                          <Tooltip content="نسخ النص"><Button size="icon-sm" variant="ghost" icon={ClipboardDocumentIcon} aria-label="نسخ النص" onClick={() => copy(reply.message)} /></Tooltip>
                          <Tooltip content="تعديل"><Button size="icon-sm" variant="ghost" icon={PencilSquareIcon} aria-label={`تعديل ${reply.title}`} onClick={() => { setEditingId(reply.id); setCreating(false) }} /></Tooltip>
                          <Tooltip content="حذف"><Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={`حذف ${reply.title}`} className="hover:text-danger" onClick={() => setToDelete(reply)} /></Tooltip>
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
        title="حذف الرد السريع؟" description={toDelete ? `سيُحذف «${toDelete.title}» نهائيًا.` : undefined} confirmLabel="حذف" loading={deleteMut.isLoading} />
    </DashboardLayout>
  )
}
