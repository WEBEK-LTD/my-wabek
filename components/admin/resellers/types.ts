import { useQuery } from 'react-query'
import axios from 'axios'

export interface ResellerProfile {
  id: string
  user_id: string
  payment_method?: string | null
  payout_schedule?: string | null
  payout_method?: string | null
  balance_pending?: number | null
  balance_paid?: number | null
  balance_total?: number | null
  payout_details?: unknown
  referral_commission_pct?: number | null
  is_approved: boolean
  approved_at?: string | null
  notes?: string | null
  created_at?: string | null
  stripe_connect_account_id?: string | null
  user?: { id: string; name: string | null; email: string } | null
}

export interface PendingPayout {
  id: string
  reseller_id: string
  amount: number
  method?: string | null
  created_at: string
  reseller?: { name: string | null; email: string } | null
}

export interface PayoutsResponse { resellers: ResellerProfile[]; pendingPayouts: PendingPayout[] }

/** GET /api/admin/payouts. `key` keeps each page's original cache key. */
export function useResellers(key: string) {
  return useQuery<PayoutsResponse>(key, () => axios.get('/api/admin/payouts').then(r => r.data))
}

export const RESELLER_KEYS = ['admin-resellers', 'admin-payouts-only']

export const PAYOUT_METHODS = ['bank_transfer', 'paypal', 'wise', 'crypto', 'stripe', 'other'] as const
