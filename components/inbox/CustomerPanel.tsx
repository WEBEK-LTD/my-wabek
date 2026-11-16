import React, { useState } from 'react'
import Link from 'next/link'
import {
  XMarkIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon, ArchiveBoxIcon, ArrowUturnLeftIcon,
  EnvelopeIcon, PhoneIcon, ChatBubbleLeftIcon, PaperAirplaneIcon, CalendarDaysIcon, EyeIcon, InboxIcon,
} from '@heroicons/react/24/outline'
import { Avatar, Badge, Button, Field, Select, Skeleton, Textarea } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/inbox'
import { STATUS_KEYS } from './ConversationList'
import { dateTime } from './utils'

export interface CustomerPanelProps {
  conv: any
  contact: any | null
  contactLoading: boolean
  messages: any[]
  user: { id: string } | null
  teamMembers: any[]
  onUpdate: (updates: Record<string, unknown>) => void
  onNotesChange: (notes: string) => void
  onClose: () => void
  className?: string
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line-soft px-5 py-4 last:border-0">
      <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  )
}

export function CustomerPanel(p: CustomerPanelProps) {
  const { t, lang } = useT(messages)
  const [tagInput, setTagInput] = useState('')
  const contact = p.contact || p.conv.contacts || {}
  const convTags: string[] = Array.isArray(p.conv.tags) ? p.conv.tags : []
  const contactTags: string[] = Array.isArray(contact.tags) ? contact.tags : (Array.isArray(p.conv.contacts?.tags) ? p.conv.contacts.tags : [])

  const inbound = p.messages.filter(m => m.direction === 'inbound')
  const outbound = p.messages.filter(m => m.direction === 'outbound')
  const lastIn = inbound[inbound.length - 1]?.created_at
  const lastOut = outbound[outbound.length - 1]?.created_at
  const inbox = p.conv.whatsapp_instances

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '').slice(0, 100)
    setTagInput('')
    if (!tag || convTags.includes(tag)) return
    p.onUpdate({ tags: [...convTags, tag] })
  }

  const activity: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: ChatBubbleLeftIcon, label: t('act_last_inbound'), value: dateTime(lastIn, lang) },
    { icon: PaperAirplaneIcon, label: t('act_last_outbound'), value: dateTime(lastOut, lang) },
    { icon: InboxIcon, label: t('act_messages'), value: t('act_messages_v', { in: inbound.length, out: outbound.length }) },
    ...(contact.last_seen ? [{ icon: EyeIcon, label: t('act_last_seen'), value: dateTime(contact.last_seen, lang) }] : []),
    ...(contact.created_at ? [{ icon: CalendarDaysIcon, label: t('act_contact_since'), value: dateTime(contact.created_at, lang) }] : []),
    ...(p.conv.resolved_at ? [{ icon: CheckCircleIcon, label: t('act_resolved'), value: dateTime(p.conv.resolved_at, lang) }] : []),
  ]

  return (
    <aside aria-label={t('details')} className={cn('flex min-h-0 flex-col bg-surface', p.className)}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line-soft px-5">
        <h2 className="text-sm font-semibold text-ink">{t('details')}</h2>
        <Button size="icon-sm" variant="ghost" icon={XMarkIcon} aria-label={t('close')} onClick={p.onClose} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Contact */}
        <div className="flex flex-col items-center gap-2 border-b border-line-soft bg-deep-hero px-5 pb-5 pt-6 text-center">
          <Avatar name={contact.name || contact.phone} size="xl" />
          <p className="mt-1 text-base font-semibold text-deep-ink" dir="auto">{contact.name || t('unknown')}</p>
          {contact.phone && <p className="tabular text-sm text-deep-muted" dir="ltr">{contact.phone}</p>}
          <div className="flex flex-wrap justify-center gap-1.5">
            {contact.opted_out && <Badge tone="warning" size="sm">{t('opted_out')}</Badge>}
            {contact.is_blocked && <Badge tone="danger" size="sm">{t('blocked')}</Badge>}
          </div>
          {contact.id && (
            <Button variant="on-deep-ghost" size="xs" iconEnd={ArrowTopRightOnSquareIcon} href={`/dashboard/contacts/${contact.id}`} className="mt-1">
              {t('open_contact')}
            </Button>
          )}
        </div>

        <Section title={t('contact')}>
          {p.contactLoading ? <Skeleton lines={2} /> : (
            <ul className="flex flex-col gap-2.5 text-sm">
              <li className="flex items-center gap-2.5"><PhoneIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /><span className="tabular truncate text-ink" dir="ltr">{contact.phone || '—'}</span></li>
              <li className="flex items-center gap-2.5"><EnvelopeIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /><span className="truncate text-ink" dir="ltr">{contact.email || '—'}</span></li>
              {inbox && (
                <li className="flex items-center gap-2.5"><InboxIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /><span className="truncate text-ink">{inbox.display_name || <bdi dir="ltr">{inbox.phone_number}</bdi>}</span></li>
              )}
            </ul>
          )}
        </Section>

        <Section title={t('conversation')}>
          <Field label={t('status')}>
            <Select size="sm" value={p.conv.status} onChange={e => p.onUpdate({ status: e.target.value })}
              options={['open', 'pending', 'resolved', 'spam'].map(s => ({ value: s, label: t(STATUS_KEYS[s]) }))} />
          </Field>
          <Field label={t('assigned_to')}>
            <Select size="sm" value={p.conv.assigned_to || ''} onChange={e => p.onUpdate({ assigned_to: e.target.value || null })}>
              <option value="">{t('unassigned')}</option>
              {p.user?.id && <option value={p.user.id}>{t('me')}</option>}
              {p.teamMembers.filter(m => m.status === 'active' && m.user_id && m.user_id !== p.user?.id).map(m => (
                <option key={m.id} value={m.user_id}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('priority')}>
            <Select size="sm" value={p.conv.priority || 'normal'} onChange={e => p.onUpdate({ priority: e.target.value })}
              options={[
                { value: 'low', label: t('p_low') }, { value: 'normal', label: t('p_normal') },
                { value: 'high', label: t('p_high') }, { value: 'urgent', label: t('p_urgent') },
              ]} />
          </Field>
        </Section>

        <Section title={t('tags')}>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted">{t('conv_tags')}</p>
            {convTags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {convTags.map(tag => (
                  <li key={tag} className="inline-flex items-center gap-1 rounded-full bg-chip py-1 pe-1 ps-2.5 text-xs font-medium text-chip-ink">
                    #{tag}
                    <button type="button" aria-label={t('remove_tag', { tag: tag })} onClick={() => p.onUpdate({ tags: convTags.filter(x => x !== tag) })}
                      className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-brand-teal/15">
                      <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
              onBlur={() => { if (tagInput.trim()) addTag() }}
              placeholder={t('add_tag_ph')}
              aria-label={t('add_tag_ph')}
              className="h-9 w-full rounded-field border border-dashed border-line-strong bg-surface px-3 text-[13px] text-ink outline-none placeholder:text-muted/80 focus:border-brand-teal focus:shadow-ring"
            />
          </div>
          {contactTags.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted">{t('contact_tags')}</p>
              <ul className="flex flex-wrap gap-1.5">
                {contactTags.map(tag => <li key={tag}><Badge tone="neutral" size="sm">{tag}</Badge></li>)}
              </ul>
            </div>
          )}
        </Section>

        <Section title={t('notes')}>
          <Textarea
            rows={4}
            value={p.conv.notes || ''}
            onChange={e => p.onNotesChange(e.target.value)}
            onBlur={() => p.onUpdate({ notes: p.conv.notes })}
            placeholder={t('notes_ph')}
            aria-label={t('notes')}
            className="bg-warning-bg/40 text-[13px]"
          />
        </Section>

        <Section title={t('activity')}>
          <ol className="relative flex flex-col gap-3 ps-5">
            <span className="absolute inset-y-1 start-[7px] w-px bg-line" aria-hidden="true" />
            {activity.map(a => (
              <li key={a.label} className="relative flex flex-col">
                <span className="absolute -start-5 top-0.5 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-surface ring-2 ring-line">
                  <a.icon className="h-2.5 w-2.5 text-brand-ink" aria-hidden="true" />
                </span>
                <span className="text-xs text-muted">{a.label}</span>
                <span className="tabular text-[13px] text-ink">{a.value}</span>
              </li>
            ))}
          </ol>
        </Section>

        <div className="flex flex-col gap-2 px-5 py-4">
          {p.conv.status === 'resolved' || p.conv.status === 'spam' ? (
            <Button variant="secondary" size="sm" icon={ArrowUturnLeftIcon} onClick={() => p.onUpdate({ status: 'open' })}>{t('reopen')}</Button>
          ) : (
            <Button variant="secondary" size="sm" icon={CheckCircleIcon} onClick={() => p.onUpdate({ status: 'resolved' })}>{t('mark_resolved')}</Button>
          )}
          {p.conv.status !== 'spam' && (
            <Button variant="danger-soft" size="sm" icon={ArchiveBoxIcon} onClick={() => p.onUpdate({ status: 'spam' })}>{t('mark_spam')}</Button>
          )}
        </div>
      </div>
    </aside>
  )
}
