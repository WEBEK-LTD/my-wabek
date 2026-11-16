import { useQuery } from 'react-query'
import axios from 'axios'

export interface AdminStats {
  total_users: number
  active_users: number
  new_users_this_month: number
  total_messages: number
  messages_this_month: number
  total_contacts: number
  active_subscriptions: number
  total_campaigns: number
  total_chatbots: number
  total_instances: number
  connected_instances: number
  mrr: number
}

export interface AdminLog {
  id: string
  action: string
  user_id?: string | null
  resource?: string | null
  resource_id?: string | null
  ip_address?: string | null
  details?: unknown
  created_at: string
  users?: { id: string; name: string | null; email: string } | null
}

export interface AdminStatsResponse {
  stats: AdminStats
  plan_distribution: { plan: string; count: number }[]
  daily_signups: { date: string; count: number }[]
  recent_logs: AdminLog[]
}

/** GET /api/admin/stats — shared by the overview and analytics pages (same cache key as before). */
export function useAdminStats() {
  return useQuery<AdminStatsResponse>('admin-stats', () => axios.get('/api/admin/stats').then(r => r.data))
}

export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)
