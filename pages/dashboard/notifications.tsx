import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { ar as arLocale, enUS, fr as frLocale, tr as trLocale } from 'date-fns/locale'
import {
  BellIcon, CheckCircleIcon, TrashIcon, ExclamationTriangleIcon, InformationCircleIcon,
  ChatBubbleLeftRightIcon, MegaphoneIcon, Cog6ToothIcon, CheckIcon, ArrowPathIcon, XCircleIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button, Card, EmptyState, PageHeader, Skeleton, Tabs, Tooltip } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { makeCopy, localeTag } from '@/components/auth/makeCopy'

const useCopy = makeCopy({
  en: {
    eyebrow: 'Settings',
    title: 'Notifications',
    unread_n: '{n} unread',
    all_read: 'You’re all caught up',
    mark_all: 'Mark all as read',
    marked_all: 'All notifications marked as read',
    f_all: 'All',
    f_unread: 'Unread',
    f_message: 'Messages',
    f_campaign: 'Campaigns',
    f_success: 'Success',
    f_warning: 'Warnings',
    today: 'Today',
    yesterday: 'Yesterday',
    empty: 'No notifications',
    empty_d: 'New messages, campaign results and account alerts will show up here.',
    empty_filter: 'Nothing matches this filter',
    empty_filter_d: 'Try another filter to see more notifications.',
    show_all: 'Show all',
    error: 'We couldn’t load your notifications',
    retry: 'Try again',
    delete: 'Delete notification',
    deleted: 'Notification deleted',
    delete_failed: 'Couldn’t delete the notification',
    unread: 'Unread',
    open: 'Open',
    filters: 'Filter notifications',
  },
  ar: {
    eyebrow: 'الإعدادات',
    title: 'الإشعارات',
    unread_n: '{n} غير مقروءة',
    all_read: 'لا توجد إشعارات جديدة',
    mark_all: 'تعليم الكل كمقروء',
    marked_all: 'تم تعليم جميع الإشعارات كمقروءة',
    f_all: 'الكل',
    f_unread: 'غير المقروءة',
    f_message: 'الرسائل',
    f_campaign: 'الحملات',
    f_success: 'نجاح',
    f_warning: 'تنبيهات',
    today: 'اليوم',
    yesterday: 'أمس',
    empty: 'لا توجد إشعارات',
    empty_d: 'ستظهر هنا الرسائل الجديدة ونتائج الحملات وتنبيهات الحساب.',
    empty_filter: 'لا شيء يطابق هذا التصنيف',
    empty_filter_d: 'جرّب تصنيفًا آخر لعرض مزيد من الإشعارات.',
    show_all: 'عرض الكل',
    error: 'تعذّر تحميل الإشعارات',
    retry: 'إعادة المحاولة',
    delete: 'حذف الإشعار',
    deleted: 'تم حذف الإشعار',
    delete_failed: 'تعذّر حذف الإشعار',
    unread: 'غير مقروء',
    open: 'فتح',
    filters: 'تصنيف الإشعارات',
  },
})

const DATE_LOCALES: Record<string, Locale> = { ar: arLocale, en: enUS, fr: frLocale, tr: trLocale }
type Locale = typeof enUS

interface Notification { id: string; type?: string; title: string; body?: string; link?: string; is_read?: boolean; created_at: string }

const TYPE_STYLE: Record<string, { icon: React.ElementType; tone: string }> = {
  info: { icon: InformationCircleIcon, tone: 'bg-chip text-chip-ink' },
  success: { icon: CheckCircleIcon, tone: 'bg-success-bg text-success' },
  warning: { icon: ExclamationTriangleIcon, tone: 'bg-warning-bg text-warning' },
  error: { icon: XCircleIcon, tone: 'bg-danger-bg text-danger' },
  message: { icon: ChatBubbleLeftRightIcon, tone: 'bg-violet-bg text-violet' },
  campaign: { icon: MegaphoneIcon, tone: 'bg-chip text-chip-ink' },
  system: { icon: Cog6ToothIcon, tone: 'bg-surface-3 text-muted' },
}

export default function NotificationsPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const { c, lang } = useCopy()
  const [filter, setFilter] = useState('all')

  const { data, isLoading, isError, refetch, isFetching } = useQuery('notifications-all',
    () => axios.get('/api/notifications?limit=100').then(r => r.data))
  const notifications: Notification[] = data?.notifications || []

  const invalidate = () => { qc.invalidateQueries('notifications-all'); qc.invalidateQueries('notifications') }

  const markAllMut = useMutation(
    () => axios.put('/api/notifications', { action: 'mark_all_read' }),
    { onSuccess: () => { invalidate(); toast.success(c('marked_all')) } }
  )

  const markOneMut = useMutation(
    (id: string) => axios.put(`/api/notifications`, { action: 'mark_read', id }),
    { onSuccess: invalidate }
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete('/api/notifications', { data: { id } }),
    {
      onMutate: async (id: string) => {
        await qc.cancelQueries('notifications-all')
        const prev = qc.getQueryData<any>('notifications-all')
        qc.setQueryData('notifications-all', (old: any) => ({ ...(old || {}), notifications: (old?.notifications || []).filter((n: Notification) => n.id !== id) }))
        return { prev }
      },
      onError: (_e, _id, ctx: any) => { if (ctx?.prev) qc.setQueryData('notifications-all', ctx.prev); toast.error(c('delete_failed')) },
      onSuccess: () => { toast.success(c('deleted')) },
      onSettled: invalidate,
    }
  )

  const unreadCount = notifications.filter(n => !n.is_read).length

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : filter === 'all' ? notifications
    : notifications.filter(n => n.type === filter)

  const groups = useMemo(() => {
    const dayFmt = new Intl.DateTimeFormat(localeTag(lang), { weekday: 'long', day: 'numeric', month: 'long' })
    const out: { key: string; label: string; items: Notification[] }[] = []
    for (const n of filtered) {
      const d = new Date(n.created_at)
      const key = d.toDateString()
      let g = out.find(x => x.key === key)
      if (!g) {
        g = { key, label: isToday(d) ? c('today') : isYesterday(d) ? c('yesterday') : dayFmt.format(d), items: [] }
        out.push(g)
      }
      g.items.push(n)
    }
    return out
  }, [filtered, lang])

  const open = (n: Notification) => {
    if (!n.is_read) markOneMut.mutate(n.id)
    if (!n.link) return
    if (n.link.startsWith('/') && !n.link.startsWith('//')) router.push(n.link)
    else if (/^https?:\/\//i.test(n.link)) window.location.href = n.link
  }

  const count = (type: string) => notifications.filter(n => n.type === type).length
  const tabs = [
    { id: 'all', label: c('f_all'), count: notifications.length || undefined },
    { id: 'unread', label: c('f_unread'), count: unreadCount || undefined },
    { id: 'message', label: c('f_message'), count: count('message') || undefined },
    { id: 'campaign', label: c('f_campaign'), count: count('campaign') || undefined },
    { id: 'success', label: c('f_success'), count: count('success') || undefined },
    { id: 'warning', label: c('f_warning'), count: count('warning') || undefined },
  ]

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5">
        <PageHeader
          eyebrow={c('eyebrow')}
          title={c('title')}
          description={isLoading ? undefined : unreadCount > 0 ? c('unread_n', { n: unreadCount }) : c('all_read')}
          actions={unreadCount > 0 ? (
            <Button variant="secondary" icon={CheckIcon} loading={markAllMut.isLoading} onClick={() => markAllMut.mutate()}>{c('mark_all')}</Button>
          ) : undefined}
        />

        <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
          <Tabs variant="pills" size="sm" value={filter} onChange={setFilter} tabs={tabs} aria-label={c('filters')} />
        </div>

        {isLoading ? (
          <Card padding="none" className="divide-y divide-line-soft">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-start gap-3 p-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>
              </div>
            ))}
          </Card>
        ) : isError ? (
          <EmptyState variant="card" icon={ExclamationTriangleIcon} title={c('error')}
            action={<Button variant="secondary" icon={ArrowPathIcon} loading={isFetching} onClick={() => refetch()}>{c('retry')}</Button>} />
        ) : filtered.length === 0 ? (
          notifications.length === 0
            ? <EmptyState variant="card" icon={BellIcon} title={c('empty')} description={c('empty_d')} />
            : <EmptyState variant="card" icon={BellIcon} title={c('empty_filter')} description={c('empty_filter_d')}
                action={<Button variant="secondary" onClick={() => setFilter('all')}>{c('show_all')}</Button>} />
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map(g => (
              <section key={g.key} aria-label={g.label} className="flex flex-col gap-2">
                <h2 className="px-1 text-xs font-semibold text-muted">{g.label}</h2>
                <Card padding="none" className="overflow-hidden">
                  <ul className="divide-y divide-line-soft">
                    {g.items.map(n => {
                      const st = TYPE_STYLE[n.type || 'info'] || TYPE_STYLE.info
                      const Icon = st.icon
                      return (
                        <li key={n.id} className={cn('group relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5', !n.is_read && 'bg-chip/30')}>
                          {!n.is_read && <span className="absolute inset-y-3 start-0 w-1 rounded-e-full bg-brand-gradient" aria-hidden="true" />}
                          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', st.tone)}>
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <button type="button" onClick={() => open(n)} className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-start">
                            <span className="flex w-full items-start justify-between gap-3">
                              <span className={cn('text-sm', n.is_read ? 'text-body' : 'font-semibold text-ink')}>
                                {n.title}
                                {!n.is_read && <span className="sr-only"> · {c('unread')}</span>}
                              </span>
                              <time dateTime={n.created_at} className="tabular shrink-0 text-xs text-muted">
                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: DATE_LOCALES[lang] || enUS })}
                              </time>
                            </span>
                            {n.body && <span className="line-clamp-2 text-[13px] text-muted">{n.body}</span>}
                          </button>
                          <div className="flex shrink-0 items-center gap-1 self-center">
                            {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand-teal" aria-hidden="true" />}
                            <Tooltip content={c('delete')}>
                              <Button
                                size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={c('delete')}
                                className="text-muted opacity-100 hover:text-danger sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
                                onClick={() => deleteMut.mutate(n.id)}
                              />
                            </Tooltip>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
