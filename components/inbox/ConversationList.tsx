import React from 'react'
import { ArrowPathIcon, ChatBubbleLeftRightIcon, DevicePhoneMobileIcon, FunnelIcon, InboxStackIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { Avatar, Button, EmptyState, SearchInput, Skeleton, Tabs, Tooltip } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useInboxCopy } from './copy'
import type { InboxCopyKey } from './copy'
import { formatTime, isAiMessage, previewText } from './utils'

export type AssignFilter = 'all' | 'mine' | 'unassigned' | 'ai' | 'waiting'

export const STATUS_KEYS: Record<string, InboxCopyKey> = { open: 'st_open', pending: 'st_pending', resolved: 'st_resolved', spam: 'st_spam', all: 'st_all' }
const STATUS_DOT: Record<string, string> = { open: 'bg-brand-teal', pending: 'bg-[#F5A524]', resolved: 'bg-success', spam: 'bg-danger-solid' }

export function ConversationItem({ conv, active, unread, showInboxBadge, onClick }: {
  conv: any; active: boolean; unread: number; showInboxBadge: boolean; onClick: () => void
}) {
  const { c, lang } = useInboxCopy()
  const contact = conv.contacts
  const last = conv.last_message
  const inbox = conv.whatsapp_instances
  const name = contact?.name || contact?.phone || c('unknown')
  const tags: string[] = Array.isArray(conv.tags) ? conv.tags : []
  const waiting = last?.direction === 'inbound'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group relative flex w-full items-start gap-3 px-4 py-3 text-start transition-colors',
        active ? 'bg-chip/60' : 'hover:bg-surface-2',
      )}
    >
      {active && <span className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-brand-gradient" aria-hidden="true" />}
      <span className="relative shrink-0">
        <Avatar name={contact?.name || contact?.phone} size="md" />
        {unread > 0 && (
          <span className="tabular absolute -end-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold text-[#04282C] ring-2 ring-surface">
            {unread > 9 ? '9+' : unread}
            <span className="sr-only"> · {c('unread_n', { n: unread })}</span>
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className={cn('truncate text-sm', unread > 0 ? 'font-bold text-ink' : 'font-semibold text-ink')} dir="auto">{name}</span>
          <time className={cn('tabular shrink-0 text-[11px]', unread > 0 ? 'font-semibold text-link' : 'text-muted')}>
            {last ? formatTime(last.created_at, lang, c) : ''}
          </time>
        </span>
        <span className={cn('flex items-center gap-1 truncate text-[13px]', unread > 0 || waiting ? 'text-body' : 'text-muted')}>
          {last?.direction === 'outbound' && <span className="shrink-0 text-muted">{c('you')}:</span>}
          {isAiMessage(last) && <SparklesIcon className="h-3.5 w-3.5 shrink-0 text-violet" aria-label={c('ai_badge')} />}
          <span className="truncate" dir="auto">{previewText(last, c)}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[10.5px] font-medium text-muted">
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[conv.status] || 'bg-muted')} aria-hidden="true" />
            {STATUS_KEYS[conv.status] ? c(STATUS_KEYS[conv.status]) : conv.status}
          </span>
          {(conv.priority === 'high' || conv.priority === 'urgent') && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-semibold', conv.priority === 'urgent' ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning')}>
              {conv.priority === 'urgent' ? c('priority_urgent') : c('priority_high')}
            </span>
          )}
          {conv.assigned_user?.name && (
            <span className="rounded-full bg-violet-bg px-2 py-0.5 text-[10.5px] font-medium text-violet">@{conv.assigned_user.name.split(' ')[0]}</span>
          )}
          {tags.slice(0, 2).map(t => (
            <span key={t} className="max-w-[90px] truncate rounded-full bg-chip px-2 py-0.5 text-[10.5px] font-medium text-chip-ink">#{t}</span>
          ))}
          {tags.length > 2 && <span className="text-[10.5px] text-muted">+{tags.length - 2}</span>}
          {showInboxBadge && inbox && (
            <span className="inline-flex max-w-[110px] items-center gap-1 truncate rounded-full border border-line px-2 py-0.5 text-[10.5px] text-muted">
              <DevicePhoneMobileIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{inbox.display_name || inbox.phone_number}</span>
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

export interface ConversationListProps {
  conversations: any[]
  totalCount: number
  loading: boolean
  activeId?: string | null
  unreadCounts: Record<string, number>
  inboxes: any[]
  canSeeAll: boolean
  selectedInbox: string | null
  onSwitchInbox: (id: string | null) => void
  searchQ: string
  onSearch: (q: string) => void
  statusFilter: string
  onStatusFilter: (s: string) => void
  assignFilter: AssignFilter
  onAssignFilter: (f: AssignFilter) => void
  onRefresh: () => void
  onOpen: (conv: any) => void
  className?: string
}

export function ConversationList(p: ConversationListProps) {
  const { c } = useInboxCopy()
  const totalUnread = Object.values(p.unreadCounts).reduce((a, b) => a + (b || 0), 0)
  const filtersActive = !!p.searchQ || p.assignFilter !== 'all'

  return (
    <section aria-label={c('title')} className={cn('flex min-h-0 flex-col bg-surface', p.className)}>
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-line-soft px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold text-ink">
            {c('title')}
            {p.totalCount > 0 && <span className="tabular rounded-full bg-surface-3 px-2 py-0.5 text-xs font-semibold text-muted">{p.totalCount}</span>}
          </h1>
          <Tooltip content={c('refresh')}>
            <Button size="icon-sm" variant="ghost" icon={ArrowPathIcon} aria-label={c('refresh')} onClick={p.onRefresh} />
          </Tooltip>
        </div>

        {p.inboxes.length > 1 && (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 scrollbar-none" role="group" aria-label={c('inboxes')}>
            {p.canSeeAll && (
              <button
                type="button"
                onClick={() => p.onSwitchInbox(null)}
                aria-pressed={p.selectedInbox === null}
                className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  p.selectedInbox === null ? 'border-transparent bg-[#04282C] text-[#EAF7F5] dark:bg-[#EAF7F5] dark:text-[#04282C]' : 'border-line text-body hover:border-line-strong hover:bg-surface-2')}
              >
                <InboxStackIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {c('all_inboxes')}
                {totalUnread > 0 && p.selectedInbox !== null && (
                  <span className="tabular rounded-full bg-brand-gradient px-1.5 text-[10px] font-bold text-[#04282C]">{totalUnread}</span>
                )}
              </button>
            )}
            {p.inboxes.map((inbox: any) => (
              <button
                key={inbox.id}
                type="button"
                onClick={() => p.onSwitchInbox(inbox.id)}
                aria-pressed={p.selectedInbox === inbox.id}
                className={cn('inline-flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  p.selectedInbox === inbox.id ? 'border-transparent bg-[#04282C] text-[#EAF7F5] dark:bg-[#EAF7F5] dark:text-[#04282C]' : 'border-line text-body hover:border-line-strong hover:bg-surface-2')}
              >
                <DevicePhoneMobileIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{inbox.name}</span>
                {inbox.unread > 0 && <span className="tabular rounded-full bg-brand-gradient px-1.5 text-[10px] font-bold text-[#04282C]">{inbox.unread}</span>}
              </button>
            ))}
          </div>
        )}

        <SearchInput value={p.searchQ} onChange={p.onSearch} placeholder={c('search_ph')} size="sm" aria-label={c('search_ph')} />

        <Tabs
          variant="segmented" size="sm" fullWidth value={p.statusFilter} onChange={p.onStatusFilter}
          aria-label={c('status_filter')}
          tabs={['open', 'pending', 'resolved', 'spam', 'all'].map(s => ({ id: s, label: c(STATUS_KEYS[s]) }))}
        />

        <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 scrollbar-none" role="group" aria-label={c('assign_filter')}>
          <FunnelIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          {(['all', 'mine', 'unassigned', 'ai', 'waiting'] as AssignFilter[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => p.onAssignFilter(f)}
              aria-pressed={p.assignFilter === f}
              className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition',
                p.assignFilter === f ? 'bg-chip text-chip-ink' : 'text-muted hover:bg-surface-3 hover:text-ink')}
            >
              {c(({ all: 'f_all', mine: 'f_mine', unassigned: 'f_unassigned', ai: 'f_ai', waiting: 'f_waiting' } as const)[f])}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {p.loading ? (
          <div className="flex flex-col gap-1 p-3" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-start gap-3 rounded-2xl p-2">
                <Skeleton circle className="h-10 w-10" />
                <div className="flex flex-1 flex-col gap-2 pt-1"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-full" /></div>
              </div>
            ))}
          </div>
        ) : p.conversations.length === 0 ? (
          filtersActive ? (
            <EmptyState size="sm" icon={FunnelIcon} title={c('no_match')} description={c('no_match_d')} className="py-14"
              action={<Button size="sm" variant="secondary" onClick={() => { p.onSearch(''); p.onAssignFilter('all') }}>{c('clear_filters')}</Button>} />
          ) : (
            <EmptyState size="sm" icon={ChatBubbleLeftRightIcon} title={c('no_convs')} description={c('no_convs_d')} className="py-14" />
          )
        ) : (
          <ul className="divide-y divide-line-soft">
            {p.conversations.map(conv => (
              <li key={conv.id}>
                <ConversationItem
                  conv={conv}
                  active={p.activeId === conv.id}
                  unread={p.unreadCounts[conv.contact_id] || 0}
                  showInboxBadge={p.selectedInbox === null && p.inboxes.length > 1}
                  onClick={() => p.onOpen(conv)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
