// Free-text message builder: blocks, variables, emoji, starter library, AI writer.
import React, { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Bars3BottomRightIcon, ChatBubbleBottomCenterTextIcon, PhotoIcon, CursorArrowRaysIcon, MinusIcon,
  ChevronUpIcon, ChevronDownIcon, DocumentDuplicateIcon, FaceSmileIcon, XMarkIcon, SparklesIcon,
  BookOpenIcon, VariableIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, Field, Select, Textarea, cn } from '@/components/ui'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/message-composer'
import { friendlyError } from './shared'
import { rich } from './rich'

export interface Block { id: string; type: string; content: string }

type Key = keyof typeof messages.en
type T = (key: Key) => string

/** Heading icon: bars aligned to the start side in both directions. */
function HeadingIcon({ className, ...p }: React.ComponentProps<'svg'>) {
  return <Bars3BottomRightIcon {...p} className={cn(className, 'ltr:-scale-x-100')} />
}

export const BLOCK_TYPES: Array<{ type: string; labelKey: Key; icon: React.ElementType }> = [
  { type: 'header', labelKey: 'block_header', icon: HeadingIcon },
  { type: 'text', labelKey: 'block_text', icon: ChatBubbleBottomCenterTextIcon },
  { type: 'image', labelKey: 'block_image', icon: PhotoIcon },
  { type: 'button', labelKey: 'block_button', icon: CursorArrowRaysIcon },
  { type: 'divider', labelKey: 'block_divider', icon: MinusIcon },
]

// Emoji are message content here (inserted into the text), not UI icons.
const EMOJIS = ['😀','😊','👋','💪','🎯','⭐','💡','📢','🛒','📦','✨','🤝','💼','🔥','❤️','✅','⚡','💬','📱','🚀','💰','🙏','🎉','👍','💎','🌟','🎁','🛍️','📝','📊','⚠️','🔔','💯','🏆','🎊']

export const VARIABLES = ['{{name}}', '{{phone}}', '{{email}}', '{{company}}', '{{amount}}', '{{date}}', '{{link}}']

const uid = () => `${Date.now()}${Math.random().toString(36).slice(2, 7)}`

/** Starter library, in the UI language (the user edits the text afterwards). */
export function starterTemplates(t: T): Array<{ id: string; name: string; category: string; blocks: Block[] }> {
  const b = (id: string, type: string, key: Key): Block => ({ id, type, content: t(key) })
  return [
    {
      id: 'promo', name: t('promo_name'), category: t('cat_marketing'),
      blocks: [b('1', 'header', 'promo_1'), b('2', 'text', 'promo_2'), b('3', 'text', 'promo_3'), b('4', 'button', 'promo_4'), b('5', 'text', 'promo_5')],
    },
    {
      id: 'reminder', name: t('reminder_name'), category: t('cat_finance'),
      blocks: [b('1', 'header', 'reminder_1'), b('2', 'text', 'reminder_2'), b('3', 'text', 'reminder_3'), b('4', 'button', 'reminder_4'), b('5', 'text', 'reminder_5')],
    },
    {
      id: 'welcome', name: t('welcome_name'), category: t('cat_welcome'),
      blocks: [b('1', 'header', 'welcome_1'), b('2', 'text', 'welcome_2'), b('3', 'text', 'welcome_3'), b('4', 'button', 'welcome_4')],
    },
    {
      id: 'feedback', name: t('feedback_name'), category: t('cat_engagement'),
      blocks: [b('1', 'header', 'feedback_1'), b('2', 'text', 'feedback_2'), b('3', 'text', 'feedback_3'), b('4', 'button', 'feedback_4')],
    },
    {
      id: 'restock', name: t('restock_name'), category: t('cat_ecommerce'),
      blocks: [b('1', 'header', 'restock_1'), b('2', 'text', 'restock_2'), b('3', 'text', 'restock_3'), b('4', 'button', 'restock_4')],
    },
    {
      id: 'appointment', name: t('appointment_name'), category: t('cat_services'),
      blocks: [b('1', 'header', 'appointment_1'), b('2', 'text', 'appointment_2'), b('3', 'text', 'appointment_3'), b('4', 'text', 'appointment_4')],
    },
  ]
}

export function buildMessage(blocks: Block[]): string {
  return blocks.map(b => {
    if (b.type === 'header') return `*${b.content}*`
    if (b.type === 'divider') return '─────────────'
    return b.content
  }).filter(Boolean).join('\n\n')
}

/** Default message for a new campaign, in the UI language. */
export function defaultBlocks(t: T): Block[] {
  return [
    { id: '1', type: 'header', content: t('def_1') },
    { id: '2', type: 'text', content: t('def_2') },
    { id: '3', type: 'button', content: t('def_3') },
  ]
}

/* ── Block editor ─────────────────────────────────────────── */

export function BlockEditor({ blocks, setBlocks, extraVariables = [] }: {
  blocks: Block[]
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>
  extraVariables?: string[]
}) {
  const { t } = useT(messages)
  const [showEmoji, setShowEmoji] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)

  const addBlock = (type: string) => {
    const defaults: Record<string, string> = { header: t('new_header'), text: t('new_text'), image: 'https://example.com/image.jpg', button: t('new_button'), divider: '' }
    setBlocks(prev => [...prev, { id: uid(), type, content: defaults[type] || '' }])
  }
  const updateBlock = (id: string, content: string) => setBlocks(prev => prev.map(b => (b.id === id ? { ...b, content } : b)))
  const removeBlock = (id: string) => setBlocks(prev => prev.filter(b => b.id !== id))
  const moveBlock = (id: string, dir: 'up' | 'down') => setBlocks(prev => {
    const idx = prev.findIndex(b => b.id === id)
    const arr = [...prev]
    const swap = dir === 'up' ? idx - 1 : idx + 1
    if (swap < 0 || swap >= arr.length) return prev
    ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
    return arr
  })
  const duplicateBlock = (id: string) => setBlocks(prev => {
    const idx = prev.findIndex(b => b.id === id)
    const arr = [...prev]
    arr.splice(idx + 1, 0, { ...prev[idx], id: uid() })
    return arr
  })
  // Variables go into the focused block (or the last one)
  const insertVariable = (v: string) => {
    const target = blocks.find(b => b.id === focusId && b.type !== 'divider') || [...blocks].reverse().find(b => b.type !== 'divider')
    if (target) updateBlock(target.id, `${target.content} ${v}`)
  }
  const vars = Array.from(new Set([...VARIABLES, ...extraVariables.map(k => `{{${k}}}`)]))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('add_block_aria')}>
        {BLOCK_TYPES.map(bt => (
          <Button key={bt.type} type="button" size="xs" variant="secondary" icon={bt.icon} onClick={() => addBlock(bt.type)}>{t(bt.labelKey)}</Button>
        ))}
      </div>

      <div className="rounded-card border border-line-soft bg-surface-2 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
          <VariableIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" /> {t('insert_variable')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {vars.map(v => (
            <button key={v} type="button" onClick={() => insertVariable(v)} dir="ltr"
              className="rounded-lg border border-line bg-surface px-2 py-1 font-mono text-[11.5px] text-chip-ink transition hover:border-brand-teal hover:bg-chip">
              {v}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
          {rich(t('vars_help'), {
            c1: <code dir="ltr" className="font-mono">{'{{name}}'}</code>,
            c2: <code dir="ltr" className="font-mono">{'{{phone}}'}</code>,
          })}
        </p>
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-card border-2 border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          {t('empty_blocks')}
        </div>
      ) : (
        <ol className="space-y-2.5">
          {blocks.map((block, idx) => {
            const meta = BLOCK_TYPES.find(b => b.type === block.type)
            const Icon = meta?.icon || ChatBubbleBottomCenterTextIcon
            const label = meta ? t(meta.labelKey) : block.type
            return (
              <li key={block.id} className={cn('overflow-hidden rounded-card border bg-surface transition', focusId === block.id ? 'border-brand-teal shadow-ring' : 'border-line')}>
                <div className="flex items-center gap-2 border-b border-line-soft bg-surface-2 px-3 py-1.5">
                  <Icon className="h-4 w-4 text-brand-ink" aria-hidden="true" />
                  <span className="flex-1 text-xs font-medium text-muted">{label}</span>
                  <div className="flex items-center">
                    <Button type="button" variant="ghost" size="icon-sm" icon={ChevronUpIcon} disabled={idx === 0} onClick={() => moveBlock(block.id, 'up')} aria-label={t('move_up')} />
                    <Button type="button" variant="ghost" size="icon-sm" icon={ChevronDownIcon} disabled={idx === blocks.length - 1} onClick={() => moveBlock(block.id, 'down')} aria-label={t('move_down')} />
                    <Button type="button" variant="ghost" size="icon-sm" icon={DocumentDuplicateIcon} onClick={() => duplicateBlock(block.id)} aria-label={t('duplicate_block')} />
                    {block.type !== 'divider' && (
                      <Button type="button" variant="ghost" size="icon-sm" icon={FaceSmileIcon} onClick={() => setShowEmoji(showEmoji === block.id ? null : block.id)} aria-label={t('insert_emoji')} aria-expanded={showEmoji === block.id} />
                    )}
                    <Button type="button" variant="ghost" size="icon-sm" icon={XMarkIcon} onClick={() => removeBlock(block.id)} aria-label={t('remove_block')} className="hover:text-danger" />
                  </div>
                </div>
                {showEmoji === block.id && (
                  <div className="flex flex-wrap gap-1 border-b border-line-soft bg-surface-2/60 px-3 py-2">
                    {EMOJIS.map(e => (
                      <button key={e} type="button" onClick={() => { updateBlock(block.id, block.content + e); setShowEmoji(null) }}
                        className="rounded-md p-1 text-lg transition hover:scale-110 hover:bg-surface-3" aria-label={t('insert_x', { e })}>{e}</button>
                    ))}
                  </div>
                )}
                {block.type === 'divider' ? (
                  <div className="px-3 py-2 text-center text-sm text-muted" aria-label={t('block_divider')}>──────────────</div>
                ) : (
                  <textarea
                    value={block.content}
                    onChange={e => updateBlock(block.id, e.target.value)}
                    onFocus={() => setFocusId(block.id)}
                    rows={block.type === 'header' ? 1 : 3}
                    dir={block.type === 'image' ? 'ltr' : 'auto'}
                    aria-label={meta ? label : t('block_text_aria')}
                    className="block w-full resize-none bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-muted"
                    placeholder={block.type === 'image' ? 'https://example.com/image.jpg' : t('content_placeholder')}
                  />
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

/* ── Starter library ──────────────────────────────────────── */

export function StarterLibrary({ onPick }: { onPick: (blocks: Block[], name: string) => void }) {
  const { t, fmtNumber } = useT(messages)
  const [open, setOpen] = useState(false)
  return (
    <Card padding="none">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-start">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-chip text-brand-ink">
          <BookOpenIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{t('library_title')}</span>
          <span className="block text-xs text-muted">{t('library_sub')}</span>
        </span>
        <ChevronDownIcon className={cn('h-5 w-5 text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="grid gap-2 border-t border-line-soft p-4 sm:grid-cols-2">
          {starterTemplates(t).map(tpl => (
            <button key={tpl.id} type="button"
              onClick={() => { onPick(tpl.blocks.map(b => ({ ...b, id: uid() })), tpl.name); setOpen(false) }}
              className="rounded-card border border-line bg-surface-2 p-3 text-start transition hover:border-brand-teal hover:bg-chip/40">
              <span className="block text-sm font-medium text-ink">{tpl.name}</span>
              <span className="mt-0.5 block text-xs text-muted">{tpl.category} · {t('blocks_count', { n: fmtNumber(tpl.blocks.length) })}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

/* ── AI writer ────────────────────────────────────────────── */

export function AIGenerator({ onGenerate }: { onGenerate: (blocks: Block[]) => void }) {
  const { t } = useT(messages)
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState('friendly')
  const [type, setType] = useState('promotional')
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    if (!prompt) { toast.error(t('ai_describe_first')); return }
    setLoading(true)
    try {
      const { data } = await axios.post('/api/campaigns/ai-generate', { prompt, tone, type })
      onGenerate(data.blocks)
      toast.success(t('ai_done'))
    } catch (e) {
      toast.error(friendlyError(e, t('ai_failed')))
    } finally { setLoading(false) }
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-start">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-violet-bg text-violet">
          <SparklesIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-semibold text-ink">{t('ai_title')} <Badge tone="violet" size="sm">Claude</Badge></span>
          <span className="block text-xs text-muted">{t('ai_sub')}</span>
        </span>
        <ChevronDownIcon className={cn('h-5 w-5 text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line-soft p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('ai_msg_type')}>
              <Select size="sm" value={type} onChange={e => setType(e.target.value)} options={[
                { value: 'promotional', label: t('type_promotional') },
                { value: 'reminder', label: t('type_reminder') },
                { value: 'announcement', label: t('type_announcement') },
                { value: 'welcome', label: t('type_welcome') },
                { value: 'reengagement', label: t('type_reengagement') },
                { value: 'feedback', label: t('type_feedback') },
              ]} />
            </Field>
            <Field label={t('ai_tone')}>
              <Select size="sm" value={tone} onChange={e => setTone(e.target.value)} options={[
                { value: 'friendly', label: t('tone_friendly') },
                { value: 'professional', label: t('tone_professional') },
                { value: 'urgent', label: t('tone_urgent') },
                { value: 'casual', label: t('tone_casual') },
                { value: 'formal', label: t('tone_formal') },
              ]} />
            </Field>
          </div>
          <Field label={t('ai_describe')}>
            <Textarea rows={3} value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder={t('ai_describe_ph')} />
          </Field>
          <Button type="button" fullWidth icon={loading ? undefined : SparklesIcon} loading={loading} disabled={!prompt} onClick={generate}>
            {loading ? t('ai_writing') : t('ai_write')}
          </Button>
        </div>
      )}
    </Card>
  )
}
