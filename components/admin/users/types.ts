export interface AdminPlanRef { id: string; name: string; price_monthly?: number | null }

export interface AdminUser {
  id: string
  email: string
  name: string | null
  role: 'user' | 'admin' | string
  plan_id: string | null
  plan_expires_at: string | null
  is_active: boolean
  created_at: string
  referred_by?: string | null
  plans?: AdminPlanRef | null
}

export interface AdminUserDetail {
  user: AdminUser & Record<string, unknown>
  instances: { id: string; display_name?: string | null; phone_number?: string | null; instance_type?: string | null; type?: string | null; status?: string | null }[]
  subscription?: { id: string; status: string; stripe_subscription_id?: string | null; current_period_end?: string | null; plans?: AdminPlanRef | null } | null
  stats: { messages: number | null; contacts: number | null }
}

export interface UserUpdateBody {
  is_active?: boolean
  role?: 'user' | 'admin'
  plan_id?: string | null
  plan_expires_at?: string | null
}
