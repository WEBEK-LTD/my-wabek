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
import { friendlyError } from './shared'

export interface Block { id: string; type: string; content: string }

export const BLOCK_TYPES: Array<{ type: string; label: string; icon: React.ElementType }> = [
  { type: 'header', label: 'عنوان', icon: Bars3BottomRightIcon },
  { type: 'text', label: 'نص', icon: ChatBubbleBottomCenterTextIcon },
  { type: 'image', label: 'رابط صورة', icon: PhotoIcon },
  { type: 'button', label: 'زر دعوة', icon: CursorArrowRaysIcon },
  { type: 'divider', label: 'فاصل', icon: MinusIcon },
]

// Emoji are message content here (inserted into the text), not UI icons.
const EMOJIS = ['😀','😊','👋','💪','🎯','⭐','💡','📢','🛒','📦','✨','🤝','💼','🔥','❤️','✅','⚡','💬','📱','🚀','💰','🙏','🎉','👍','💎','🌟','🎁','🛍️','📝','📊','⚠️','🔔','💯','🏆','🎊']

export const VARIABLES = ['{{name}}', '{{phone}}', '{{email}}', '{{company}}', '{{amount}}', '{{date}}', '{{link}}']

const uid = () => `${Date.now()}${Math.random().toString(36).slice(2, 7)}`

export const STARTER_TEMPLATES: Array<{ id: string; name: string; category: string; blocks: Block[] }> = [
  {
    id: 'promo', name: 'عرض ترويجي', category: 'التسويق',
    blocks: [
      { id: '1', type: 'header', content: 'عرض خاص لك يا {{name}}' },
      { id: '2', type: 'text', content: 'مرحبًا {{name}}، لدينا عرض حصري أعددناه لك.' },
      { id: '3', type: 'text', content: '- خصم *{{amount}}%* على طلبك القادم\n- صالح حتى {{date}}\n- لفترة محدودة' },
      { id: '4', type: 'button', content: 'تسوّق الآن: {{link}}' },
      { id: '5', type: 'text', content: '_لإلغاء الاشتراك أرسل STOP_' },
    ],
  },
  {
    id: 'reminder', name: 'تذكير بالدفع', category: 'المالية',
    blocks: [
      { id: '1', type: 'header', content: 'تذكير بموعد الدفع' },
      { id: '2', type: 'text', content: 'عزيزي {{name}}،' },
      { id: '3', type: 'text', content: 'يستحق مبلغ *{{amount}}* بتاريخ *{{date}}*.' },
      { id: '4', type: 'button', content: 'ادفع الآن: {{link}}' },
      { id: '5', type: 'text', content: 'هل تحتاج إلى مساعدة؟ ردّ على هذه الرسالة.' },
    ],
  },
  {
    id: 'welcome', name: 'رسالة ترحيب', category: 'الترحيب',
    blocks: [
      { id: '1', type: 'header', content: 'أهلًا بك في {{company}}' },
      { id: '2', type: 'text', content: 'مرحبًا {{name}}، يسعدنا انضمامك إلينا.' },
      { id: '3', type: 'text', content: 'يمكنك الآن:\n- تصفّح منتجاتنا\n- الحصول على عروض حصرية\n- التواصل مع الدعم في أي وقت' },
      { id: '4', type: 'button', content: 'ابدأ الآن: {{link}}' },
    ],
  },
  {
    id: 'feedback', name: 'طلب تقييم', category: 'التفاعل',
    blocks: [
      { id: '1', type: 'header', content: 'كيف كانت تجربتك؟' },
      { id: '2', type: 'text', content: 'مرحبًا {{name}}، شكرًا لاختيارك {{company}}.' },
      { id: '3', type: 'text', content: 'يسعدنا سماع رأيك، ولن يستغرق ذلك أكثر من 30 ثانية.' },
      { id: '4', type: 'button', content: 'اترك تقييمك: {{link}}' },
    ],
  },
  {
    id: 'restock', name: 'عودة منتج للمخزون', category: 'التجارة الإلكترونية',
    blocks: [
      { id: '1', type: 'header', content: 'خبر سار يا {{name}}' },
      { id: '2', type: 'text', content: 'المنتج الذي طلبته *عاد إلى المخزون*.' },
      { id: '3', type: 'text', content: 'سارع بالطلب، فالكمية محدودة.' },
      { id: '4', type: 'button', content: 'اشترِ الآن: {{link}}' },
    ],
  },
  {
    id: 'appointment', name: 'تذكير بموعد', category: 'الخدمات',
    blocks: [
      { id: '1', type: 'header', content: 'تذكير بموعدك' },
      { id: '2', type: 'text', content: 'مرحبًا {{name}}، نذكّرك بموعدك القادم.' },
      { id: '3', type: 'text', content: '*التاريخ:* {{date}}\n*الوقت:* {{time}}\n*المكان:* {{location}}' },
      { id: '4', type: 'text', content: 'أرسل *تأكيد* للتأكيد أو *إلغاء* للإلغاء.' },
    ],
  },
]

export function buildMessage(blocks: Block[]): string {
  return blocks.map(b => {
    if (b.type === 'header') return `*${b.content}*`
    if (b.type === 'divider') return '─────────────'
    return b.content
  }).filter(Boolean).join('\n\n')
}

export const DEFAULT_BLOCKS: Block[] = [
  { id: '1', type: 'header', content: 'مرحبًا {{name}}' },
  { id: '2', type: 'text', content: 'لدينا شيء مميز لك اليوم.' },
  { id: '3', type: 'button', content: 'اكتشفه الآن: https://example.com' },
]

/* ── Block editor ─────────────────────────────────────────── */

export function BlockEditor({ blocks, setBlocks, extraVariables = [] }: {
  blocks: Block[]
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>
  extraVariables?: string[]
}) {
  const [showEmoji, setShowEmoji] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)

  const addBlock = (type: string) => {
    const defaults: Record<string, string> = { header: 'العنوان هنا', text: 'اكتب رسالتك هنا…', image: 'https://example.com/image.jpg', button: 'اضغط هنا: https://example.com', divider: '' }
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
      <div className="flex flex-wrap gap-2" role="group" aria-label="إضافة كتلة">
        {BLOCK_TYPES.map(bt => (
          <Button key={bt.type} type="button" size="xs" variant="secondary" icon={bt.icon} onClick={() => addBlock(bt.type)}>{bt.label}</Button>
        ))}
      </div>

      <div className="rounded-card border border-line-soft bg-surface-2 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
          <VariableIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" /> إدراج متغير
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
          يُستبدل <code dir="ltr" className="font-mono">{'{{name}}'}</code> و<code dir="ltr" className="font-mono">{'{{phone}}'}</code> تلقائيًا لكل مستلم، وتُملأ بقية المتغيرات من متغيرات جهة الاتصال بالاسم نفسه، وتُحذف إن لم توجد.
        </p>
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-card border-2 border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          أضف كتلة من الأزرار أعلاه لبناء رسالتك.
        </div>
      ) : (
        <ol className="space-y-2.5">
          {blocks.map((block, idx) => {
            const meta = BLOCK_TYPES.find(b => b.type === block.type)
            const Icon = meta?.icon || ChatBubbleBottomCenterTextIcon
            return (
              <li key={block.id} className={cn('overflow-hidden rounded-card border bg-surface transition', focusId === block.id ? 'border-brand-teal shadow-ring' : 'border-line')}>
                <div className="flex items-center gap-2 border-b border-line-soft bg-surface-2 px-3 py-1.5">
                  <Icon className="h-4 w-4 text-brand-ink" aria-hidden="true" />
                  <span className="flex-1 text-xs font-medium text-muted">{meta?.label || block.type}</span>
                  <div className="flex items-center">
                    <Button type="button" variant="ghost" size="icon-sm" icon={ChevronUpIcon} disabled={idx === 0} onClick={() => moveBlock(block.id, 'up')} aria-label="نقل لأعلى" />
                    <Button type="button" variant="ghost" size="icon-sm" icon={ChevronDownIcon} disabled={idx === blocks.length - 1} onClick={() => moveBlock(block.id, 'down')} aria-label="نقل لأسفل" />
                    <Button type="button" variant="ghost" size="icon-sm" icon={DocumentDuplicateIcon} onClick={() => duplicateBlock(block.id)} aria-label="تكرار الكتلة" />
                    {block.type !== 'divider' && (
                      <Button type="button" variant="ghost" size="icon-sm" icon={FaceSmileIcon} onClick={() => setShowEmoji(showEmoji === block.id ? null : block.id)} aria-label="إدراج رمز تعبيري" aria-expanded={showEmoji === block.id} />
                    )}
                    <Button type="button" variant="ghost" size="icon-sm" icon={XMarkIcon} onClick={() => removeBlock(block.id)} aria-label="حذف الكتلة" className="hover:text-danger" />
                  </div>
                </div>
                {showEmoji === block.id && (
                  <div className="flex flex-wrap gap-1 border-b border-line-soft bg-surface-2/60 px-3 py-2">
                    {EMOJIS.map(e => (
                      <button key={e} type="button" onClick={() => { updateBlock(block.id, block.content + e); setShowEmoji(null) }}
                        className="rounded-md p-1 text-lg transition hover:scale-110 hover:bg-surface-3" aria-label={`إدراج ${e}`}>{e}</button>
                    ))}
                  </div>
                )}
                {block.type === 'divider' ? (
                  <div className="px-3 py-2 text-center text-sm text-muted" aria-label="فاصل">──────────────</div>
                ) : (
                  <textarea
                    value={block.content}
                    onChange={e => updateBlock(block.id, e.target.value)}
                    onFocus={() => setFocusId(block.id)}
                    rows={block.type === 'header' ? 1 : 3}
                    dir={block.type === 'image' ? 'ltr' : 'auto'}
                    aria-label={meta?.label || 'نص الكتلة'}
                    className="block w-full resize-none bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-muted"
                    placeholder={block.type === 'image' ? 'https://example.com/image.jpg' : 'اكتب المحتوى…'}
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
  const [open, setOpen] = useState(false)
  return (
    <Card padding="none">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-start">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-chip text-brand-ink">
          <BookOpenIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">مكتبة النماذج</span>
          <span className="block text-xs text-muted">ابدأ من نموذج جاهز ثم عدّله</span>
        </span>
        <ChevronDownIcon className={cn('h-5 w-5 text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="grid gap-2 border-t border-line-soft p-4 sm:grid-cols-2">
          {STARTER_TEMPLATES.map(tpl => (
            <button key={tpl.id} type="button"
              onClick={() => { onPick(tpl.blocks.map(b => ({ ...b, id: uid() })), tpl.name); setOpen(false) }}
              className="rounded-card border border-line bg-surface-2 p-3 text-start transition hover:border-brand-teal hover:bg-chip/40">
              <span className="block text-sm font-medium text-ink">{tpl.name}</span>
              <span className="mt-0.5 block text-xs text-muted">{tpl.category} · {tpl.blocks.length} كتل</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

/* ── AI writer ────────────────────────────────────────────── */

export function AIGenerator({ onGenerate }: { onGenerate: (blocks: Block[]) => void }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState('friendly')
  const [type, setType] = useState('promotional')
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    if (!prompt) { toast.error('صف حملتك أولًا'); return }
    setLoading(true)
    try {
      const { data } = await axios.post('/api/campaigns/ai-generate', { prompt, tone, type })
      onGenerate(data.blocks)
      toast.success('تمت كتابة الرسالة بالذكاء الاصطناعي')
    } catch (e) {
      toast.error(friendlyError(e, 'تعذّر توليد الرسالة. تحقّق من إعداد مفتاح الذكاء الاصطناعي.'))
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
          <span className="flex items-center gap-2 font-semibold text-ink">الكتابة بالذكاء الاصطناعي <Badge tone="violet" size="sm">Claude</Badge></span>
          <span className="block text-xs text-muted">صف الحملة وسنكتب لك مسودة تعدّلها كما تشاء</span>
        </span>
        <ChevronDownIcon className={cn('h-5 w-5 text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line-soft p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نوع الرسالة">
              <Select size="sm" value={type} onChange={e => setType(e.target.value)} options={[
                { value: 'promotional', label: 'ترويجية' },
                { value: 'reminder', label: 'تذكير' },
                { value: 'announcement', label: 'إعلان' },
                { value: 'welcome', label: 'ترحيب' },
                { value: 'reengagement', label: 'إعادة تفاعل' },
                { value: 'feedback', label: 'طلب رأي' },
              ]} />
            </Field>
            <Field label="الأسلوب">
              <Select size="sm" value={tone} onChange={e => setTone(e.target.value)} options={[
                { value: 'friendly', label: 'ودّي' },
                { value: 'professional', label: 'مهني' },
                { value: 'urgent', label: 'عاجل' },
                { value: 'casual', label: 'بسيط' },
                { value: 'formal', label: 'رسمي' },
              ]} />
            </Field>
          </div>
          <Field label="صف حملتك">
            <Textarea rows={3} value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="مثال: خصم 50% على جميع المنتجات في عطلة نهاية الأسبوع للعملاء الحاليين، مع إحساس بالاستعجال" />
          </Field>
          <Button type="button" fullWidth icon={loading ? undefined : SparklesIcon} loading={loading} disabled={!prompt} onClick={generate}>
            {loading ? 'جارٍ الكتابة…' : 'اكتب الرسالة'}
          </Button>
        </div>
      )}
    </Card>
  )
}

