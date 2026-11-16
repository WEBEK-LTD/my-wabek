import { LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/hooks/useTranslation'

interface Props {
  feature: string
  requiredPlan?: string
}

/** Shown instead of a page when the current plan turns the feature off. */
export default function UpgradeWall({ feature, requiredPlan }: Props) {
  const { t } = useTranslation()
  const label = t(`feature_${feature}`, feature)

  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center py-10">
      <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-panel border border-line bg-surface p-8 text-center shadow-card sm:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-brand-gradient opacity-[0.12]" />
        <span className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-[#04282C] shadow-glow">
          <LockClosedIcon className="h-8 w-8" aria-hidden="true" />
        </span>
        <h2 className="relative mb-2 text-2xl font-bold text-ink">{t('upgrade_title').replace('{feature}', label)}</h2>
        <p className="relative mb-7 text-sm leading-relaxed text-muted">
          {requiredPlan ? t('upgrade_desc_plan').replace('{plan}', requiredPlan) : t('upgrade_desc')}
        </p>
        <Button href="/dashboard/billing" icon={SparklesIcon} size="lg" className="relative">
          {t('upgrade_cta')}
        </Button>
      </div>
    </div>
  )
}
