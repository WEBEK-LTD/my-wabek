import { createClient } from '@supabase/supabase-js'

// Support all Supabase variable name variants (Netlify integration adds its own names)
const supabaseUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  ''
)

const supabaseAnonKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
)

export const supabase = supabaseUrl ? createClient(supabaseUrl, supabaseAnonKey) : createClient('https://placeholder.supabase.co', 'placeholder')

// Server-side client with service role (for admin operations)
export const supabaseAdmin = () => {
  const serviceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  )
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          password_hash: string
          role: 'user' | 'admin'
          plan_id: string | null
          plan_expires_at: string | null
          stripe_customer_id: string | null
          api_key: string
          is_active: boolean
          trial_ends_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      whatsapp_instances: {
        Row: {
          id: string
          user_id: string
          phone_number: string
          display_name: string | null
          status: 'connected' | 'disconnected' | 'pending' | 'banned'
          phone_number_id: string | null
          waba_id: string | null
          access_token: string | null
          webhook_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['whatsapp_instances']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['whatsapp_instances']['Insert']>
      }
      messages: {
        Row: {
          id: string
          user_id: string
          instance_id: string
          contact_id: string | null
          wa_message_id: string | null
          direction: 'inbound' | 'outbound'
          type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'template'
          content: string
          media_url: string | null
          status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
          campaign_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['messages']['Insert']>
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          phone: string
          name: string | null
          email: string | null
          tags: string[]
          variables: Record<string, string>
          is_blocked: boolean
          opted_out: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['contacts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
      }
      campaigns: {
        Row: {
          id: string
          user_id: string
          instance_id: string
          name: string
          message: string
          media_url: string | null
          contact_filter: Record<string, unknown>
          status: 'draft' | 'scheduled' | 'running' | 'completed' | 'failed' | 'paused'
          scheduled_at: string | null
          started_at: string | null
          completed_at: string | null
          total_contacts: number
          sent_count: number
          delivered_count: number
          read_count: number
          failed_count: number
          delay_seconds: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['campaigns']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['campaigns']['Insert']>
      }
      automation_flows: {
        Row: {
          id: string
          user_id: string
          instance_id: string
          name: string
          trigger_type: 'keyword' | 'message_received' | 'opt_in' | 'scheduled'
          trigger_value: string | null
          nodes: Record<string, unknown>[]
          is_active: boolean
          trigger_count: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['automation_flows']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['automation_flows']['Insert']>
      }
      plans: {
        Row: {
          id: string
          name: string
          description: string | null
          price_monthly: number
          price_yearly: number
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          max_messages_month: number
          max_contacts: number
          max_instances: number
          max_campaigns: number
          features: string[]
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['plans']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['plans']['Insert']>
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          stripe_subscription_id: string | null
          status: 'active' | 'cancelled' | 'past_due' | 'trialing'
          billing_cycle: 'monthly' | 'yearly'
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
      }
      api_keys: {
        Row: {
          id: string
          user_id: string
          name: string
          key_hash: string
          key_prefix: string
          permissions: string[]
          last_used_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['api_keys']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['api_keys']['Insert']>
      }
      system_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          resource: string | null
          resource_id: string | null
          details: Record<string, unknown> | null
          ip_address: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['system_logs']['Row'], 'id' | 'created_at'>
        Update: never
      }
    }
  }
}
