import React, { useEffect, useState } from 'react'
import {
  ChatBubbleLeftRightIcon, CodeBracketIcon, CpuChipIcon, GiftIcon, ChartBarIcon, BoltIcon,
  PaintBrushIcon, SparklesIcon, BuildingStorefrontIcon, Squares2X2Icon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Field, Input, Modal, Switch, Textarea } from '@/components/ui'
import { useAdminT } from '../i18n'
import messages from '@/locales/admin/plan-editor'

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
  const { t, tn } = useAdminT(messages)
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
              aria-pressed={unlimited} aria-label={t('unlimited')}>∞</button>
          ) : undefined}
        />
      </Field>
    )
  }

  const toggles: { k: keyof Form; label: string; desc?: string; icon: React.ElementType }[] = [
    { k: 'allow_api_access', label: t('apiAccess'), desc: t('restApiApiKeys'), icon: CodeBracketIcon },
    { k: 'allow_chatbot', label: t('chatbotBuilder'), desc: t('dragDropFlows'), icon: CpuChipIcon },
    { k: 'allow_automation', label: t('automationFlows'), icon: BoltIcon },
    { k: 'allow_analytics', label: t('analyticsDashboard'), icon: ChartBarIcon },
    { k: 'allow_ai', label: t('aiFeatures'), desc: t('aiRepliesAssistant'), icon: SparklesIcon },
    { k: 'allow_white_label', label: t('whiteLabel'), desc: t('customBrandLogoDomain'), icon: PaintBrushIcon },
    { k: 'allow_sub_accounts', label: t('subAccounts'), desc: t('isolatedClientAccounts'), icon: Squares2X2Icon },
    { k: 'allow_reseller', label: t('resellerSystem'), desc: t('sellPlatformSubscriptions'), icon: BuildingStorefrontIcon },
    { k: 'allow_gift_invites', label: t('giftInvites'), desc: t('sendGiftCodes'), icon: GiftIcon },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={plan ? t('editAlt', { name: plan.name }) : t('newPlan')}
      description={t('n1MeansUnlimitedChanges')}
      footer={<>
        {plan && <span className="me-auto text-xs text-muted">{changed ? tn('fieldsChanged', changed, { n: changed }) : t('noChanges')}</span>}
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button loading={saving} disabled={!canSave} onClick={() => onSave(body)}>{plan ? t('saveChanges') : t('createPlan')}</Button>
      </>}
    >
      <div className="space-y-7">
        <section className="space-y-3">
          <h3 className="eyebrow">{t('basics')}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('planName')} required className="sm:col-span-2"><Input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Pro" /></Field>
            {num('sort_order', t('sortOrder'), 0, t('n0First'))}
            <Field label={t('description')} className="sm:col-span-3"><Input value={f.description || ''} onChange={e => set('description', e.target.value)} /></Field>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="eyebrow">{t('pricingUsd')}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {num('price_monthly', t('monthlyPrice'), 0)}
            {num('price_yearly', t('yearlyPrice'), 0, t('optional'))}
          </div>
          {plan && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone={plan.stripe_price_id_monthly ? 'success' : 'warning'} dot>
                {plan.stripe_price_id_monthly ? t('monthlyPriceLinkedStripe') : t('notSyncedStripe')}
              </Badge>
              {plan.stripe_price_id_yearly && <Badge tone="success" dot>{t('yearlyPriceLinked')}</Badge>}
              <span className="text-muted">{t('afterPriceChangeRun')}</span>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="eyebrow">{t('limits')}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {num('max_messages_month', t('messagesMonthAlt'))}
            {num('max_contacts', t('contacts'))}
            {num('max_instances', t('whatsappNumbers'), 1)}
            {num('max_campaigns', t('campaigns'))}
            {num('max_team_members', t('teamMembers'), 1)}
            {num('max_chatbot_flows', t('chatbotFlows'))}
            {num('max_ai_replies', t('aiRepliesMonth'))}
            {num('max_quick_replies', t('quickReplies'))}
            {num('max_segments', t('segments'))}
            {num('max_links', t('trackedLinks'))}
            {num('max_sub_accounts', t('subAccounts'), 0)}
            {num('invite_credits', t('giftCreditsMonth'), 0)}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="eyebrow">{t('includedFeatures')}</h3>
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
          <h3 className="eyebrow">{t('featureBullets')}</h3>
          <Field label={t('shownBillingPage')} hint={t('commaSeparated')}>
            <Textarea rows={3} value={f.features} onChange={e => set('features', e.target.value)} placeholder={t('prioritySupportAiCampaigns')} />
          </Field>
          {splitFeatures(f.features).length > 0 && (
            <div className="flex flex-wrap gap-1.5">{splitFeatures(f.features).map(x => <Badge key={x} tone="brand" size="sm" icon={ChatBubbleLeftRightIcon}>{x}</Badge>)}</div>
          )}
        </section>

        <div className="rounded-xl border border-line p-3.5">
          <Switch checked={!!f.is_active} onChange={v => set('is_active', v)} label={t('planActive')} description={t('visibleUsersAvailableSubscribe')} />
        </div>
      </div>
    </Modal>
  )
}
