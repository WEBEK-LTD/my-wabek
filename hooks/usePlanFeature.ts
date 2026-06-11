import { useQuery } from 'react-query'
import axios from 'axios'
import { useRouter } from 'next/router'

export function usePlanFeature(feature?: string) {
  const { data, isLoading } = useQuery('plan-features',
    () => axios.get('/api/billing/plan-features').then(r => r.data),
    { staleTime: 60000, retry: false }
  )

  const features = data?.features || {}
  const plan = data?.plan || null

  const hasFeature = (f: string): boolean => {
    if (!(f in features)) return true // unknown feature = allow
    return features[f] !== false
  }

  const allowed = feature ? hasFeature(feature) : true

  return { allowed, isLoading, features, plan, hasFeature }
}

// Use this in individual pages to block access
export function usePlanGuard(feature: string) {
  const router = useRouter()
  const { allowed, isLoading, plan } = usePlanFeature(feature)

  if (!isLoading && !allowed) {
    // Don't redirect, just return blocked state
    return { blocked: true, plan, isLoading }
  }

  return { blocked: false, plan, isLoading }
}
