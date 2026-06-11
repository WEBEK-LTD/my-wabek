import { useState, useEffect } from 'react'
import axios from 'axios'

export interface Plan {
  id: string
  name: string
  description?: string
  price_monthly: number
  price_annual?: number
  features: string[]
  is_popular?: boolean
  is_active: boolean
  sort_order?: number
  cta_text?: string
  badge?: string
}

// Fallback plans if DB has none
export const FALLBACK_PLANS: Plan[] = [
  { id:'free',     name:'Free',     price_monthly:0,   price_annual:0,   is_popular:false, is_active:true, sort_order:0, features:['500 messages/month','1 WhatsApp number','Bulk campaigns','Chatbot builder','API access'], cta_text:'Start Free' },
  { id:'starter',  name:'Starter',  price_monthly:29,  price_annual:23,  is_popular:true,  is_active:true, sort_order:1, features:['50,000 messages/month','5 WhatsApp numbers','AI auto-reply','Analytics dashboard','Priority support'], cta_text:'Start Free Trial', badge:'Most Popular' },
  { id:'pro',      name:'Pro',      price_monthly:79,  price_annual:63,  is_popular:false, is_active:true, sort_order:2, features:['Unlimited messages','30 WhatsApp numbers','White label','Dedicated support','Custom integrations'], cta_text:'Start Free Trial' },
  { id:'business', name:'Business', price_monthly:199, price_annual:159, is_popular:false, is_active:true, sort_order:3, features:['Everything in Pro','Unlimited numbers','Full white label','24/7 priority support','SLA guarantee'], cta_text:'Contact Sales' },
]

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/plans')
      .then(r => setPlans(r.data.plans?.length ? r.data.plans : FALLBACK_PLANS))
      .catch(() => setPlans(FALLBACK_PLANS))
      .finally(() => setLoading(false))
  }, [])

  return { plans, loading }
}
