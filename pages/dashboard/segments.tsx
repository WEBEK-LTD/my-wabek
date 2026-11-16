import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, EllipsisHorizontalIcon, EyeIcon, PlusIcon, RectangleGroupIcon, TrashIcon, UserGroupIcon, UsersIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Avatar, Badge, Button, Card, ConfirmDialog, Dropdown, EmptyState, Field, Input, PageHeader, Skeleton, cn, formatNumber,
} from '@/components/ui'
import { RuleBuilder } from '@/components/contacts/RuleBuilder'
import {
  Segment, SegmentCondition, defaultCondition, fieldLabel, isComplete, operatorLabel, segmentTags, valueLabel,
} from '@/components/contacts/segmentRules'
import { LoadError } from '@/components/analytics/LoadError'
import { apiError, formatDate } from '@/components/analytics/format'

interface Preview { count: number; contacts: Array<{ id: string; name: string | null; phone: string; tags: string[] | null }> }
interface FormState { name: string; description: string; operator: 'AND' | 'OR'; conditions: SegmentCondition[] }

const emptyForm = (): FormState => ({ name: '', description: '', operator: 'AND', conditions: [defaultCondition()] })

function ConditionChips({ conditions, operator }: { conditions: SegmentCondition[]; operator: 'AND' | 'OR' }) {
  if (!conditions.length) return <p className="text-xs text-muted">كل جهات الاتصال</p>
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {conditions.map((c, i) => (
        <span key={i} className="contents">
          {i > 0 && <span className="text-2xs font-semibold text-muted">{operator === 'OR' ? 'أو' : 'و'}</span>}
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs">
            <span className="text-muted">{fieldLabel(c.field)}</span>
            <span className="text-muted">{operatorLabel(c.field, c.operator)}</span>
            <span className="font-semibold text-ink" dir="auto">{valueLabel(c)}</span>
          </span>
        </span>
      ))}
    </div>
  )
}

export default function SegmentsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [toDelete, setToDelete] = useState<Segment | null>(null)

  const { data, isLoading, isError, refetch } = useQuery<{ segments: Segment[] }>('segments', () => axios.get('/api/segments').then(r => r.data))
  const segments = data?.segments || []

  // Tag suggestions for the rule builder, from the first page of contacts.
  const { data: tagSource } = useQuery<{ contacts: Array<{ tags: string[] | null }> }>(
    ['contacts-tags'], () => axios.get('/api/contacts?limit=200').then(r => r.data), { enabled: showForm, staleTime: 5 * 60 * 1000 },
  )
  const tagSuggestions = useMemo(() => {
    const s = new Set<string>()
    ;(tagSource?.contacts || []).forEach(c => (c.tags || []).forEach(t => s.add(t)))
    return Array.from(s).sort()
  }, [tagSource])

  const complete = form.conditions.filter(isComplete)
  const conditionsKey = JSON.stringify({ c: complete, o: form.operator })

  // Live preview: re-count whenever the complete rules change.
  useEffect(() => {
    if (!showForm) return
    let cancelled = false
    setPreviewing(true); setPreviewError(false)
    const t = setTimeout(async () => {
      try {
        const { data: d } = await axios.post('/api/segments/preview', { conditions: complete, operator: form.operator })
        if (!cancelled) setPreview(d)
      } catch {
        if (!cancelled) { setPreview(null); setPreviewError(true) }
      } finally {
        if (!cancelled) setPreviewing(false)
      }
    }, 450)
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conditionsKey, showForm])

  const closeForm = () => { setShowForm(false); setForm(emptyForm()); setPreview(null) }

  const createMut = useMutation(
    (body: FormState) => axios.post('/api/segments', body),
    {
      onSuccess: () => { qc.invalidateQueries('segments'); closeForm(); toast.success('أُنشئت الشريحة') },
      onError: (e: unknown) => { toast.error(apiError(e, 'تعذّر إنشاء الشريحة')) },
    },
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/segments/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('segments'); setToDelete(null); toast.success('حُذفت الشريحة') },
      onError: (e: unknown) => { toast.error(apiError(e, 'تعذّر حذف الشريحة')) },
    },
  )

  const canSave = form.name.trim() && complete.length === form.conditions.length

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    createMut.mutate({ ...form, name: form.name.trim() })
  }

  return (
    <DashboardLayout title="Contact Segments">
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="جهات الاتصال"
          title="الشرائح"
          description="جمّع جهات الاتصال حسب الوسوم أو الاسم أو الرقم أو حالة الاشتراك، ثم استهدفها في حملاتك."
          actions={!showForm && <Button icon={PlusIcon} onClick={() => setShowForm(true)}>شريحة جديدة</Button>}
        />

        {showForm && (
          <Card padding="none" className="overflow-hidden border-brand-teal/40">
            <form onSubmit={save} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="flex flex-col gap-5 p-5 sm:p-6">
                <h2 className="text-base font-semibold text-ink">شريحة جديدة</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="اسم الشريحة" required>
                    <Input value={form.name} maxLength={200} placeholder="عملاء VIP" autoFocus onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </Field>
                  <Field label="الوصف" hint="اختياري — لتذكير فريقك بالغرض منها.">
                    <Input maxLength={1000} value={form.description} placeholder="عملاء اشتروا أكثر من مرة" onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </Field>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-ink">القواعد</p>
                  <RuleBuilder
                    conditions={form.conditions}
                    operator={form.operator}
                    onChange={conditions => setForm(f => ({ ...f, conditions }))}
                    onOperatorChange={operator => setForm(f => ({ ...f, operator }))}
                    tagSuggestions={tagSuggestions}
                  />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
                  <Button type="submit" loading={createMut.isLoading} disabled={!canSave}>حفظ الشريحة</Button>
                  <Button type="button" variant="secondary" onClick={closeForm}>إلغاء</Button>
                  {!canSave && form.name.trim() && <p className="self-center text-xs text-muted">أكمل قيمة كل شرط أو احذفه.</p>}
                </div>
              </div>

              {/* Live preview */}
              <aside className="flex flex-col gap-4 border-t border-line bg-surface-2 p-5 sm:p-6 lg:border-s lg:border-t-0" aria-live="polite">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink"><EyeIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />معاينة مباشرة</p>
                  {previewing && <ArrowPathIcon className="h-4 w-4 animate-spin text-muted" aria-label="جارٍ الحساب" />}
                </div>
                {previewError ? (
                  <p className="text-sm text-danger">تعذّر حساب المعاينة.</p>
                ) : (
                  <>
                    <div className="rounded-card bg-deep-hero p-5 text-deep-ink">
                      <p className="text-xs text-deep-muted">جهات الاتصال المطابقة</p>
                      <p className={cn('tabular mt-1 text-4xl font-bold transition-opacity', previewing && 'opacity-50')}>
                        {preview ? formatNumber(preview.count) : '—'}
                      </p>
                    </div>
                    {preview && preview.contacts.length > 0 && (
                      <ul className="flex flex-col gap-2">
                        {preview.contacts.slice(0, 5).map(c => (
                          <li key={c.id} className="flex items-center gap-2.5">
                            <Avatar name={c.name || c.phone} size="xs" />
                            <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.name || 'بدون اسم'}</span>
                            <span dir="ltr" className="tabular font-mono text-xs text-muted">{c.phone}</span>
                          </li>
                        ))}
                        {preview.count > 5 && <li className="text-xs text-muted">و{formatNumber(preview.count - 5)} أخرى</li>}
                      </ul>
                    )}
                    {preview && preview.count === 0 && <p className="text-sm text-muted">لا توجد جهات اتصال تطابق هذه القواعد حاليًا.</p>}
                  </>
                )}
              </aside>
            </form>
          </Card>
        )}

        {isError ? (
          <Card><LoadError onRetry={() => refetch()} /></Card>
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Card key={i}><Skeleton lines={4} /></Card>)}</div>
        ) : segments.length === 0 ? (
          !showForm && (
            <EmptyState variant="card" icon={RectangleGroupIcon} title="لا توجد شرائح بعد"
              description="أنشئ شريحة مثل «عملاء VIP» أو «أرقام السعودية» لتستهدفها في الحملات دون اختيار جهات الاتصال يدويًا."
              action={<Button icon={PlusIcon} onClick={() => setShowForm(true)}>إنشاء شريحة</Button>} />
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {segments.map(seg => {
              const tags = segmentTags(seg)
              const viewTag = tags && tags.length === 1 ? tags[0] : null
              return (
                <Card key={seg.id} as="article" interactive className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chip text-brand-ink"><UserGroupIcon className="h-5 w-5" aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-ink">{seg.name}</h3>
                        <p className="text-xs text-muted">أُنشئت {formatDate(seg.created_at)}</p>
                      </div>
                    </div>
                    <Dropdown label={`خيارات ${seg.name}`} triggerClassName="h-9 w-9 justify-center text-muted hover:bg-surface-3 hover:text-ink"
                      trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
                      items={[
                        ...(viewTag ? [{ label: 'عرض جهات الاتصال', icon: UsersIcon, href: `/dashboard/contacts?tag=${encodeURIComponent(viewTag)}` }] : []),
                        { label: 'حذف', icon: TrashIcon, danger: true, divider: !!viewTag, onClick: () => setToDelete(seg) },
                      ]} />
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="tabular text-3xl font-bold text-ink">{formatNumber(seg.contact_count || 0)}</p>
                      <p className="text-xs text-muted">جهة اتصال عند الإنشاء</p>
                    </div>
                    <Badge tone="neutral">{(seg.operator || 'AND') === 'OR' ? 'أيٌّ من الشروط' : 'كل الشروط'}</Badge>
                  </div>
                  {seg.description && <p className="line-clamp-2 text-sm text-body">{seg.description}</p>}
                  <ConditionChips conditions={seg.conditions || []} operator={seg.operator || 'AND'} />
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog destructive open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id) }}
        title="حذف الشريحة؟" description={toDelete ? `ستُحذف «${toDelete.name}». لن تُحذف جهات الاتصال نفسها.` : undefined}
        confirmLabel="حذف" loading={deleteMut.isLoading} />
    </DashboardLayout>
  )
}
