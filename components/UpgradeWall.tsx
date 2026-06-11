// @ts-nocheck
import Link from 'next/link'
import { LockClosedIcon } from '@heroicons/react/24/outline'

interface Props {
  feature: string
  requiredPlan?: string
}

const FEATURE_LABELS = {
  allow_api_access: 'API Access',
  allow_chatbot: 'Chatbot Builder',
  allow_automation: 'Automation',
  allow_analytics: 'Advanced Analytics',
  allow_white_label: 'White Label',
  allow_sub_accounts: 'Sub-Accounts',
  allow_reseller: 'Reseller System',
}

export default function UpgradeWall({ feature, requiredPlan }: Props) {
  const label = FEATURE_LABELS[feature] || feature

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="w-16 h-16 bg-brand-900/30 border border-brand-800/50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <LockClosedIcon className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">
          Upgrade to unlock {label}
        </h2>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          {requiredPlan
            ? `This feature is available on the ${requiredPlan} plan and above.`
            : 'This feature is not included in your current plan.'
          } Upgrade to get access.
        </p>
        <Link href="/dashboard/billing" className="btn-primary justify-center">
          View Plans & Upgrade →
        </Link>
        <p className="text-xs text-gray-600 mt-3">
          Current plan doesn't include this feature
        </p>
      </div>
    </div>
  )
}
