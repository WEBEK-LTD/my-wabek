// @ts-nocheck
// Performance and AI-review panels of the Team page (data handling unchanged).
import React from 'react'
import {
  ArrowPathIcon, ChatBubbleLeftRightIcon, PaperAirplaneIcon, ArrowUturnLeftIcon, ClockIcon,
  SparklesIcon, PencilSquareIcon, InformationCircleIcon, LightBulbIcon, AcademicCapIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Button, Card, CardHeader, EmptyState, Modal, Skeleton, StatCard, Table, TBody, TD, TH, THead, TR, Textarea, Tooltip, cn,
} from '@/components/ui'
import { ErrorState } from './Shared'
import { fmtDate, fmtDateTime, fmtRelative } from './format'

const scoreTone = (s?: number | null) => (s ?? 0) >= 8 ? 'text-success' : (s ?? 0) >= 6 ? 'text-warning' : 'text-danger'
const rateTone = (r: number) => r >= 80 ? 'success' : r >= 50 ? 'warning' : 'danger'
const fmtMinutes = (m?: number | null) => m === null || m === undefined ? '—' : m < 60 ? `${m} د` : `${Math.round(m / 60)} س`

/* ── Performance ─────────────────────────────────────────── */

export function PerformancePanel({ perfData, perfLoading, perfFetching, refetchPerf, rangeLabel }) {
  if (perfLoading) return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-card" />)}</div>
  if (!perfData || (perfData.mode !== 'team' && perfData.mode !== 'self')) {
    return <ErrorState title="تعذّر تحميل بيانات الأداء" onRetry={() => refetchPerf()} />
  }

  const refresh = (
    <Tooltip content="تحديث">
      <Button size="icon-sm" variant="ghost" icon={ArrowPathIcon} aria-label="تحديث بيانات الأداء" onClick={() => refetchPerf()} disabled={perfFetching} className={cn(perfFetching && '[&_svg]:animate-spin')} />
    </Tooltip>
  )

  if (perfData.mode === 'self') {
    const s = perfData.stats || {}
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">أدائي</h2>
            <p className="text-sm text-muted">{rangeLabel}</p>
          </div>
          {refresh}
        </div>
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <StatCard label="محادثات تمت معالجتها" value={String(s.conversations_handled ?? 0)} icon={ChatBubbleLeftRightIcon} />
          <StatCard label="رسائل مرسلة" value={String(s.messages_sent ?? 0)} icon={PaperAirplaneIcon} />
          <StatCard label="نسبة الرد" value={s.response_rate !== null && s.response_rate !== undefined ? `${s.response_rate}%` : '—'} icon={ArrowUturnLeftIcon}
            progress={s.response_rate ?? undefined} progressMax={100} />
          <StatCard label="متوسط زمن الرد" value={fmtMinutes(s.avg_response_minutes)} icon={ClockIcon} />
        </div>
      </div>
    )
  }

  const rows = [...(perfData.members || []), perfData.owner]
    .filter(m => m && m.id)
    .filter((m, idx, arr) => arr.findIndex(x => x.id === m.id) === idx)
  const memberCount = (perfData.members || []).length

  return (
    <div className="space-y-4">
      <Card padding="none">
        <CardHeader
          title="أداء الفريق"
          subtitle={memberCount === 0 ? 'لا يوجد أعضاء نشطون بعد — يظهر نشاطك فقط' : `${memberCount} عضو نشط بالإضافة إليك · ${rangeLabel}`}
          action={refresh}
          divider
        />
        {rows.length === 0 ? (
          <EmptyState size="sm" icon={ChatBubbleLeftRightIcon} title="لا يوجد نشاط في هذه الفترة" />
        ) : (
          <Table minWidth={720} caption="أداء الفريق">
            <THead>
              <TR>
                <TH>العضو</TH>
                <TH align="center">المحادثات</TH>
                <TH align="center">المرسلة</TH>
                <TH>نسبة الرد</TH>
                <TH align="center">متوسط الرد</TH>
                <TH>آخر نشاط</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((m, i) => (
                <TR key={m.id || i}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.name || m.email || '?'} size="sm" />
                      <div className="min-w-0">
                        <p className="max-w-[12rem] truncate font-medium text-ink">{m.name || 'غير معروف'}</p>
                        <p className="max-w-[12rem] truncate text-xs text-muted" dir="ltr">{m.email || (m.name === 'You (Owner)' ? 'Account owner' : '')}</p>
                      </div>
                    </div>
                  </TD>
                  <TD align="center" className="font-semibold text-ink">{m.conversations_handled ?? 0}</TD>
                  <TD align="center" className="font-semibold text-ink">{m.messages_sent ?? 0}</TD>
                  <TD>
                    {m.response_rate !== null && m.response_rate !== undefined ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-track">
                          <div className={cn('h-full rounded-full', { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }[rateTone(m.response_rate)])} style={{ width: `${Math.min(m.response_rate, 100)}%` }} />
                        </div>
                        <span className={cn('text-sm font-semibold tabular', { success: 'text-success', warning: 'text-warning', danger: 'text-danger' }[rateTone(m.response_rate)])}>{m.response_rate}%</span>
                      </div>
                    ) : <span className="text-xs text-muted">—</span>}
                  </TD>
                  <TD align="center">
                    <span className={cn('font-semibold', m.avg_response_minutes === null || m.avg_response_minutes === undefined ? 'text-muted' : m.avg_response_minutes <= 5 ? 'text-success' : m.avg_response_minutes <= 30 ? 'text-warning' : 'text-danger')}>
                      {fmtMinutes(m.avg_response_minutes)}
                    </span>
                  </TD>
                  <TD className="text-sm text-muted">
                    {m.last_active ? <span title={fmtDateTime(m.last_active)}>{fmtRelative(m.last_active)}</span> : '—'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />نسبة رد 80% فأكثر أو 5 دقائق فأقل</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />50–79% أو 5–30 دقيقة</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger" aria-hidden="true" />أقل من 50% أو أكثر من 30 دقيقة</span>
      </div>
    </div>
  )
}

/* ── AI reviews ──────────────────────────────────────────── */

const SCORE_LABELS = [
  ['الدقة', 'score_accuracy'],
  ['الاحترافية', 'score_professionalism'],
  ['الوضوح', 'score_clarity'],
  ['التعاطف', 'score_empathy'],
  ['الإفادة', 'score_helpfulness'],
  ['اللغة', 'score_grammar'],
]

function ScoreGrid({ item }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
      {SCORE_LABELS.map(([label, key]) => (
        <div key={key} className="rounded-xl bg-surface-2 px-2 py-2 text-center">
          <p className="text-[11px] text-muted">{label}</p>
          <p className={cn('text-sm font-bold tabular', scoreTone(item[key]))}>{item[key] ? Number(item[key]).toFixed(1) : '—'}</p>
        </div>
      ))}
    </div>
  )
}

function ItemNotes({ item, member }) {
  return (
    <>
      {item.strengths?.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-success">نقاط القوة</p>
          <ul className="list-disc space-y-0.5 ps-5 text-xs text-body">{item.strengths.map(s => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      {item.issues?.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-danger">{member ? 'جوانب للتحسين' : 'ملاحظات'}</p>
          <ul className="list-disc space-y-0.5 ps-5 text-xs text-body">{item.issues.map(s => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      {item.suggested_reply && (
        <div className="rounded-xl border border-brand-teal/20 bg-chip/40 px-3 py-2">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-chip-ink"><LightBulbIcon className="h-3.5 w-3.5" aria-hidden="true" />رد مقترح أفضل</p>
          <p className="text-xs text-body">{item.suggested_reply}</p>
        </div>
      )}
      {member && item.coaching_notes && (
        <div className="rounded-xl border border-violet/20 bg-violet-bg/60 px-3 py-2">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-violet"><AcademicCapIcon className="h-3.5 w-3.5" aria-hidden="true" />توجيه</p>
          <p className="text-xs text-body">{item.coaching_notes}</p>
        </div>
      )}
      {item.manual_comment && (
        <div className="rounded-xl border border-warning/20 bg-warning-bg/60 px-3 py-2">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-warning"><PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />ملاحظة المدير</p>
          <p className="text-xs text-body">{item.manual_comment}</p>
        </div>
      )}
    </>
  )
}

export function ReviewsPanel({ isOwner, reviewsData, reviewsLoading, refetchReviews, onEditNote }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-card bg-chip/50 px-4 py-2.5 text-xs text-chip-ink">
        <InformationCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        تُحدَّث المراجعات تلقائيًا كل ساعة، وتُحلَّل المحادثة بعد ساعتين من توقفها.
      </div>

      {reviewsLoading ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-panel" />)}</div>
      ) : isOwner ? (
        <div className="space-y-4">
          {(reviewsData?.member_summary || []).length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(reviewsData?.member_summary || []).map(m => (
                <Card key={m.member_user_id} padding="sm">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.member_name || '?'} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{m.member_name}</p>
                      <p className="text-xs text-muted">{m.review_count} مراجعة</p>
                    </div>
                    <span className={cn('text-2xl font-bold tabular', scoreTone(m.avg_score))}>{m.avg_score ?? '—'}</span>
                  </div>
                  {(m.top_issues?.length > 0 || m.top_strengths?.length > 0) && (
                    <div className="mt-3 space-y-1 border-t border-line-soft pt-3">
                      {m.top_issues?.slice(0, 2).map(issue => <p key={issue.text} className="text-[11px] text-danger">↓ {issue.text}</p>)}
                      {m.top_strengths?.slice(0, 2).map(s => <p key={s.text} className="text-[11px] text-success">↑ {s.text}</p>)}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{reviewsData?.total || 0} مراجعة مكتملة</p>
            <Tooltip content="تحديث"><Button size="icon-sm" variant="ghost" icon={ArrowPathIcon} aria-label="تحديث المراجعات" onClick={() => refetchReviews()} /></Tooltip>
          </div>

          {(reviewsData?.reviews || []).length === 0 ? (
            <EmptyState variant="card" icon={SparklesIcon} title="لا توجد مراجعات بعد" description="تظهر المراجعات بعد توقف المحادثات لمدة ساعتين." />
          ) : (reviewsData?.reviews || []).map(review => (
            <Card key={review.id} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{review.contacts?.name || review.contacts?.phone || 'جهة اتصال غير معروفة'}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {review.message_count} رسالة · المراجعة رقم {review.review_version}{review.reviewed_at ? ` · ${fmtDate(review.reviewed_at)}` : ''}
                  </p>
                </div>
                {review.overall_score && <span className={cn('text-3xl font-bold tabular', scoreTone(review.overall_score))}>{Number(review.overall_score).toFixed(1)}</span>}
              </div>
              {review.overall_summary && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-body">{review.overall_summary}</p>}
              <div className="space-y-3">
                {(review.ai_review_items || []).map(item => (
                  <div key={item.id} className="space-y-3 rounded-card border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={item.member_name || '?'} size="xs" />
                        <div>
                          <p className="text-sm font-medium text-ink">{item.member_name}</p>
                          <p className="text-[11px] text-muted">{item.messages_count} رسالة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-lg font-bold tabular', scoreTone(item.score_overall))}>{item.score_overall ? `${Number(item.score_overall).toFixed(1)}/10` : '—'}</span>
                        <Button size="xs" variant="secondary" icon={PencilSquareIcon} onClick={() => onEditNote(item)}>
                          {item.manual_comment ? 'تعديل الملاحظة' : 'إضافة ملاحظة'}
                        </Button>
                      </div>
                    </div>
                    <ScoreGrid item={item} />
                    <ItemNotes item={item} />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {reviewsData?.stats && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="متوسط التقييم" value={String(reviewsData.stats.avg_score ?? '—')} icon={SparklesIcon} />
                <StatCard label="عدد المراجعات" value={String(reviewsData.stats.review_count ?? 0)} icon={ChatBubbleLeftRightIcon} />
              </div>
              <div className="flex flex-wrap gap-2">
                {reviewsData.stats.top_strengths?.slice(0, 3).map(s => <span key={s.text} className="rounded-full bg-success-bg px-3 py-1 text-xs text-success">{s.text}</span>)}
                {reviewsData.stats.top_issues?.slice(0, 3).map(s => <span key={s.text} className="rounded-full bg-danger-bg px-3 py-1 text-xs text-danger">{s.text}</span>)}
              </div>
            </div>
          )}
          {(reviewsData?.items || []).length === 0 ? (
            <EmptyState variant="card" icon={SparklesIcon} title="لا توجد مراجعات بعد" description="استمر في العمل الجيد! ستظهر مراجعاتك هنا." />
          ) : (reviewsData?.items || []).map(item => (
            <Card key={item.id} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{item.ai_reviews?.contacts?.name || item.ai_reviews?.contacts?.phone || 'عميل'}</p>
                  <p className="text-[11px] text-muted">{item.ai_reviews?.reviewed_at ? fmtDate(item.ai_reviews.reviewed_at) : ''} · {item.messages_count} رسالة</p>
                </div>
                <span className={cn('text-xl font-bold tabular', scoreTone(item.score_overall))}>{item.score_overall ? `${Number(item.score_overall).toFixed(1)}/10` : '—'}</span>
              </div>
              <ScoreGrid item={item} />
              <ItemNotes item={item} member />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function NoteModal({ open, onClose, value, onChange, onSave, saving }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={PencilSquareIcon}
      title="ملاحظة المدير"
      description="ملاحظة توجيه أو إشادة تظهر للعضو مع المراجعة."
      footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button loading={saving} onClick={onSave}>حفظ الملاحظة</Button></>}
    >
      <Textarea value={value} onChange={e => onChange(e.target.value)} rows={5} aria-label="نص الملاحظة" placeholder="أضف ملاحظات التوجيه أو الإشادة أو التحسين…" />
    </Modal>
  )
}
