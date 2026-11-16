import React, { useEffect, useState } from 'react'
import {
  ChatBubbleLeftRightIcon, CodeBracketIcon, CpuChipIcon, GiftIcon, ChartBarIcon, BoltIcon,
  PaintBrushIcon, SparklesIcon, BuildingStorefrontIcon, Squares2X2Icon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Field, Input, Modal, Switch, Textarea } from '@/components/ui'
import { useAdminT } from '../i18n'

export interface Plan {
  id: string
  name: string
  description?: string | null
  price_monthly: number
  price_yearly?: number | null
  max_messages_month: number
  max_contacts: number
  max_instances: number
  max_campaigns: number
  max_team_members?: number | null
  max_chatbot_flows?: number | null
  max_quick_replies?: number | null
  max_segments?: number | null
  max_links?: number | null
  max_sub_accounts?: number | null
  max_ai_replies?: number | null
  allow_api_access?: boolean
  allow_chatbot?: boolean
  allow_automation?: boolean
  allow_analytics?: boolean
  allow_white_label?: boolean
  allow_sub_accounts?: boolean
  allow_reseller?: boolean
  allow_gift_invites?: boolean
  allow_ai?: boolean
  invite_credits?: number | null
  features?: string[] | null
  is_active?: boolean
  sort_order?: number | null
  stripe_price_id_monthly?: string | null
  stripe_price_id_yearly?: string | null
}

type Form = Omit<Plan, 'id' | 'features'> & { features: string }

export const EMPTY_PLAN: Form = {
  name: '', description: '', price_monthly: 0, price_yearly: 0, max_messages_month: 1000, max_contacts: 500, max_instances: 1,
  max_campaigns: 5, max_team_members: 1, max_chatbot_flows: 2, max_quick_replies: 10, max_segments: 5, max_links: 10, max_sub_accounts: 0,
  max_ai_replies: 0, allow_api_access: false, allow_chatbot: true, allow_automation: true, allow_analytics: true, allow_white_label: false,
  allow_sub_accounts: false, allow_reseller: false, allow_gift_invites: false, allow_ai: false, invite_credits: 0, features: '', is_active: true, sort_order: 0,
}

const NUM_KEYS = ['price_monthly', 'price_yearly', 'max_messages_month', 'max_contacts', 'max_instances', 'max_campaigns', 'max_team_members',
  'max_chatbot_flows', 'max_quick_replies', 'max_segments', 'max_links', 'max_sub_accounts', 'max_ai_replies', 'invite_credits', 'sort_order'] as const
const EDITABLE = ['name', 'description', ...NUM_KEYS, 'allow_api_access', 'allow_chatbot', 'allow_automation', 'allow_analytics', 'allow_white_label',
  'allow_sub_accounts', 'allow_reseller', 'allow_gift_invites', 'allow_ai', 'is_active'] as const

const toForm = (p: Plan): Form => {
  const f = { ...EMPTY_PLAN } as Record<string, unknown>
  for (const k of EDITABLE) if ((p as unknown as Record<string, unknown>)[k] !== undefined && (p as unknown as Record<string, unknown>)[k] !== null) f[k] = (p as unknown as Record<string, unknown>)[k]
  f.features = (p.features || []).join(', ')
  return f as Form
}
const splitFeatures = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)

interface Props {
  open: boolean
  plan: Plan | null          // null = create
  onClose: () => void
  /** Create: full body. Edit: only changed fields. */
  onSave: (body: Record<string, unknown>) => void
  saving: boolean
}

export function PlanEditor({ open, plan, onClose, onSave, saving }: Props) {
  const { tr } = useAdminT()
  const [f, setF] = useState<Form>(EMPTY_PLAN)
  useEffect(() => { if (open) setF(plan ? toForm(plan) : EMPTY_PLAN) }, [open, plan])
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(p => ({ ...p, [k]: v }))

  const buildBody = (): Record<string, unknown> => {
    const full: Record<string, unknown> = { ...f, features: splitFeatures(f.features) }
    if (!plan) return full
    const orig = toForm(plan) as unknown as Record<string, unknown>
    const diff: Record<string, unknown> = {}
    for (const k of EDITABLE) if (JSON.stringify(full[k]) !== JSON.stringify(orig[k])) diff[k] = full[k]
    if (JSON.stringify(full.features) !== JSON.stringify(plan.features || [])) diff.features = full.features
    return diff
  }
  const body = open ? buildBody() : {}
  const changed = Object.keys(body).length
  const canSave = !!f.name.trim() && (plan ? changed > 0 : true)

  const num = (k: typeof NUM_KEYS[number], label: string, min = -1, hint?: string) => {
    const val = f[k] as number | null | undefined
    const unlimited = min < 0 && val === -1
    return (
      <Field key={k} label={label} hint={hint}>
        <Input
          type="number" dir="ltr" min={min} value={val ?? ''}
          step={k.startsWith('price') ? 0.01 : 1}
          onChange={e => set(k, (e.target.value === '' ? 0 : k.startsWith('price') ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0) as never)}
          endAdornment={min < 0 ? (
            <button type="button" onClick={() => set(k, (unlimited ? 0 : -1) as never)}
              className={unlimited ? 'rounded-md bg-chip px-1.5 text-xs font-semibold text-chip-ink' : 'rounded-md px-1.5 text-xs text-muted hover:text-ink'}
              aria-pressed={unlimited} aria-label={tr('غير محدود', 'Unlimited')}>∞</button>
          ) : undefined}
        />
      </Field>
    )
  }

  const toggles: { k: keyof Form; label: string; desc?: string; icon: React.ElementType }[] = [
    { k: 'allow_api_access', label: tr('الوصول إلى API', 'API access'), desc: tr('REST API ومفاتيح API', 'REST API + API keys'), icon: CodeBracketIcon },
    { k: 'allow_chatbot', label: tr('منشئ الروبوت', 'Chatbot builder'), desc: tr('تدفقات بالسحب والإفلات', 'Drag & drop flows'), icon: CpuChipIcon },
    { k: 'allow_automation', label: tr('الأتمتة', 'Automation flows'), icon: BoltIcon },
    { k: 'allow_analytics', label: tr('لوحة التحليلات', 'Analytics dashboard'), icon: ChartBarIcon },
    { k: 'allow_ai', label: tr('الذكاء الاصطناعي', 'AI features'), desc: tr('الردود الذكية والمساعد', 'AI replies and assistant'), icon: SparklesIcon },
    { k: 'allow_white_label', label: tr('العلامة البيضاء', 'White label'), desc: tr('شعار ونطاق مخصصان', 'Custom brand, logo & domain'), icon: PaintBrushIcon },
    { k: 'allow_sub_accounts', label: tr('الحسابات الفرعية', 'Sub-accounts'), desc: tr('حسابات منفصلة للعملاء', 'Isolated client accounts'), icon: Squares2X2Icon },
    { k: 'allow_reseller', label: tr('نظام الموزّعين', 'Reseller system'), desc: tr('بيع اشتراكات المنصة', 'Sell platform subscriptions'), icon: BuildingStorefrontIcon },
    { k: 'allow_gift_invites', label: tr('دعوات الهدايا', 'Gift invites'), desc: tr('إرسال رموز هدايا', 'Send gift codes'), icon: GiftIcon },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={plan ? tr(`تعديل باقة ${plan.name}`, `Edit ${plan.name}`) : tr('باقة جديدة', 'New plan')}
      description={tr('القيمة ‎-1‎ تعني غير محدود. التغييرات تظهر للمستخدمين فورًا بعد الحفظ.', '-1 means unlimited. Changes are visible to users as soon as you save.')}
      footer={<>
        {plan && <span className="me-auto text-xs text-muted">{changed ? tr(`${changed} حقل معدّل`, `${changed} field(s) changed`) : tr('لا تغييرات', 'No changes')}</span>}
        <Button variant="secondary" onClick={onClose}>{tr('إلغاء', 'Cancel')}</Button>
        <Button loading={saving} disabled={!canSave} onClick={() => onSave(body)}>{plan ? tr('حفظ التغييرات', 'Save changes') : tr('إنشاء الباقة', 'Create plan')}</Button>
      </>}
    >
      <div className="space-y-7">
        <section className="space-y-3">
          <h3 className="eyebrow">{tr('المعلومات الأساسية', 'Basics')}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={tr('اسم الباقة', 'Plan name')} required className="sm:col-span-2"><Input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Pro" /></Field>
            {num('sort_order', tr('ترتيب العرض', 'Sort order'), 0, tr('0 = الأولى', '0 = first'))}
            <Field label={tr('الوصف', 'Description')} className="sm:col-span-3"><Input value={f.description || ''} onChange={e => set('description', e.target.value)} /></Field>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="eyebrow">{tr('التسعير (دولار)', 'Pricing (USD)')}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {num('price_monthly', tr('السعر الشهري', 'Monthly price'), 0)}
            {num('price_yearly', tr('السعر السنوي', 'Yearly price'), 0, tr('اختياري', 'Optional'))}
          </div>
          {plan && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone={plan.stripe_price_id_monthly ? 'success' : 'warning'} dot>
                {plan.stripe_price_id_monthly ? tr('سعر شهري مرتبط بـ Stripe', 'Monthly price linked to Stripe') : tr('غير مزامن مع Stripe', 'Not synced with Stripe')}
              </Badge>
              {plan.stripe_price_id_yearly && <Badge tone="success" dot>{tr('سعر سنوي مرتبط', 'Yearly price linked')}</Badge>}
              <span className="text-muted">{tr('بعد تغيير السعر استخدم «مزامنة مع Stripe».', 'After a price change, run “Sync with Stripe”.')}</span>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="eyebrow">{tr('الحدود', 'Limits')}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {num('max_messages_month', tr('رسائل شهريًا', 'Messages / month'))}
            {num('max_contacts', tr('جهات الاتصال', 'Contacts'))}
            {num('max_instances', tr('أرقام واتساب', 'WhatsApp numbers'), 1)}
            {num('max_campaigns', tr('الحملات', 'Campaigns'))}
            {num('max_team_members', tr('أعضاء الفريق', 'Team members'), 1)}
            {num('max_chatbot_flows', tr('تدفقات الروبوت', 'Chatbot flows'))}
            {num('max_ai_replies', tr('ردود ذكية شهريًا', 'AI replies / month'))}
            {num('max_quick_replies', tr('الردود السريعة', 'Quick replies'))}
            {num('max_segments', tr('الشرائح', 'Segments'))}
            {num('max_links', tr('الروابط المتتبَّعة', 'Tracked links'))}
            {num('max_sub_accounts', tr('الحسابات الفرعية', 'Sub-accounts'), 0)}
            {num('invite_credits', tr('رصيد الهدايا شهريًا', 'Gift credits / month'), 0)}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="eyebrow">{tr('الميزات المضمّنة', 'Included features')}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {toggles.map(t => (
              <div key={String(t.k)} className="flex items-center gap-3 rounded-xl border border-line-soft bg-surface-2 px-3.5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-chip text-brand-ink"><t.icon className="h-4 w-4" aria-hidden="true" /></span>
                <Switch className="flex-1" checked={!!f[t.k]} onChange={v => set(t.k, v as never)} label={t.label} description={t.desc} size="sm" />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="eyebrow">{tr('نقاط العرض', 'Feature bullets')}</h3>
          <Field label={tr('تظهر في صفحة الفوترة', 'Shown on the billing page')} hint={tr('افصل بينها بفواصل', 'Comma-separated')}>
            <Textarea rows={3} value={f.features} onChange={e => set('features', e.target.value)} placeholder={tr('دعم ذو أولوية، حملات ذكية', 'Priority support, AI campaigns')} />
          </Field>
          {splitFeatures(f.features).length > 0 && (
            <div className="flex flex-wrap gap-1.5">{splitFeatures(f.features).map(x => <Badge key={x} tone="brand" size="sm" icon={ChatBubbleLeftRightIcon}>{x}</Badge>)}</div>
          )}
        </section>

        <div className="rounded-xl border border-line p-3.5">
          <Switch checked={!!f.is_active} onChange={v => set('is_active', v)} label={tr('الباقة نشطة', 'Plan active')} description={tr('مرئية للمستخدمين ومتاحة للاشتراك', 'Visible to users and available to subscribe')} />
        </div>
      </div>
    </Modal>
  )
}
