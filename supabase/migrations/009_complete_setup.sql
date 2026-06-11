-- ============================================================
-- WABEK — Complete SQL Setup
-- Run this ONCE in Supabase SQL Editor
-- Safe to re-run (all statements use IF NOT EXISTS / IF EXISTS)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STEP 1: PLANS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  max_messages_month INTEGER NOT NULL DEFAULT 1000,
  max_contacts INTEGER NOT NULL DEFAULT 500,
  max_instances INTEGER NOT NULL DEFAULT 1,
  max_campaigns INTEGER NOT NULL DEFAULT 5,
  max_team_members INTEGER DEFAULT 1,
  max_chatbot_flows INTEGER DEFAULT 2,
  max_quick_replies INTEGER DEFAULT 10,
  max_segments INTEGER DEFAULT 5,
  max_links INTEGER DEFAULT 10,
  max_sub_accounts INTEGER DEFAULT 0,
  allow_api_access BOOLEAN DEFAULT false,
  allow_chatbot BOOLEAN DEFAULT true,
  allow_automation BOOLEAN DEFAULT true,
  allow_analytics BOOLEAN DEFAULT true,
  allow_white_label BOOLEAN DEFAULT false,
  allow_sub_accounts BOOLEAN DEFAULT false,
  allow_reseller BOOLEAN DEFAULT false,
  allow_gift_invites BOOLEAN DEFAULT false,
  invite_credits INTEGER DEFAULT 0,
  features TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE plans DISABLE ROW LEVEL SECURITY;

-- Add missing columns to plans (safe)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_team_members INTEGER DEFAULT 1;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_chatbot_flows INTEGER DEFAULT 2;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_quick_replies INTEGER DEFAULT 10;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_segments INTEGER DEFAULT 5;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_links INTEGER DEFAULT 10;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_sub_accounts INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_api_access BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_chatbot BOOLEAN DEFAULT true;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_automation BOOLEAN DEFAULT true;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_analytics BOOLEAN DEFAULT true;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_white_label BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_sub_accounts BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_reseller BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_gift_invites BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS invite_credits INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- STEP 2: USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  plan_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT UNIQUE,
  api_key TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT true,
  phone TEXT,
  trial_ends_at TIMESTAMPTZ,
  otp_mode TEXT DEFAULT 'whatsapp',
  referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invite_code TEXT,
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT,
  last_login_device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Add missing columns to users (safe)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_mode TEXT DEFAULT 'whatsapp';
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_device TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);

-- ============================================================
-- STEP 3: SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','past_due','trialing','paused')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: WHATSAPP INSTANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'My WhatsApp',
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','qr_pending','banned')),
  type TEXT NOT NULL DEFAULT 'wa_web' CHECK (type IN ('wa_web','cloud_api','baileys')),
  phone_number_id TEXT,
  access_token TEXT,
  webhook_verify_token TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE whatsapp_instances DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'wa_web';

-- ============================================================
-- STEP 5: CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  opted_out BOOLEAN DEFAULT false,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, phone)
);
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

-- ============================================================
-- STEP 6: MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  wa_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','video','audio','document','template','interactive')),
  content TEXT,
  media_url TEXT,
  caption TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','failed','pending')),
  from_phone TEXT,
  to_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- ============================================================
-- STEP 7: CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','running','completed','failed','cancelled')),
  contact_filter JSONB DEFAULT '{"all": true}',
  scheduled_at TIMESTAMPTZ,
  delay_seconds INTEGER DEFAULT 3,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  total_contacts INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);

-- ============================================================
-- STEP 8: AUTOMATION
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'keyword' CHECK (trigger_type IN ('keyword','schedule','opt_in','new_contact')),
  trigger_config JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT false,
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE automation_flows DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_flows_is_active ON automation_flows(is_active);

-- ============================================================
-- STEP 9: CHATBOT
-- ============================================================
CREATE TABLE IF NOT EXISTS chatbot_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_keywords TEXT[] DEFAULT '{}',
  nodes JSONB DEFAULT '[]',
  edges JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT false,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE chatbot_flows DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES chatbot_flows(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  current_node_id TEXT,
  state JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE chatbot_sessions DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 10: NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- STEP 11: SYSTEM SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 12: OTP & AUTH
-- ============================================================
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  ip_address TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_fingerprint)
);
ALTER TABLE trusted_devices DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS otp_pending (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'registration',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE otp_pending DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  purpose TEXT DEFAULT 'login',
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE otp_codes DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 13: TEAM & INBOX
-- ============================================================
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','agent','viewer')),
  token TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE team_members DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS conversation_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, contact_id)
);
ALTER TABLE conversation_assignments DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS quick_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shortcut TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE quick_replies DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 14: CONTACT SEGMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB DEFAULT '[]',
  operator TEXT DEFAULT 'AND' CHECK (operator IN ('AND','OR')),
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE contact_segments DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 15: LINK TRACKER
-- ============================================================
CREATE TABLE IF NOT EXISTS tracked_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  short_code TEXT UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  label TEXT,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tracked_links DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE link_clicks DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 16: WHITE LABEL & SUB-ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS white_label_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  brand_name TEXT,
  brand_logo TEXT,
  brand_favicon TEXT,
  brand_color TEXT DEFAULT '#00D46A',
  custom_domain TEXT,
  custom_css TEXT,
  hide_powered_by BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE white_label_settings DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS sub_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE sub_accounts DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 17: RESELLER SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS reseller_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  payment_method TEXT NOT NULL DEFAULT 'platform',
  own_stripe_secret_key TEXT,
  own_stripe_publishable_key TEXT,
  own_stripe_webhook_secret TEXT,
  stripe_connect_account_id TEXT,
  stripe_connect_access_token TEXT,
  stripe_connect_refresh_token TEXT,
  payout_schedule TEXT NOT NULL DEFAULT 'monthly',
  payout_method TEXT DEFAULT 'bank_transfer',
  payout_details JSONB DEFAULT '{}',
  balance_pending DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  referral_commission_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE reseller_profiles DISABLE ROW LEVEL SECURITY;

-- Add missing reseller_profiles columns
ALTER TABLE reseller_profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;
ALTER TABLE reseller_profiles ADD COLUMN IF NOT EXISTS stripe_connect_access_token TEXT;
ALTER TABLE reseller_profiles ADD COLUMN IF NOT EXISTS stripe_connect_refresh_token TEXT;

CREATE TABLE IF NOT EXISTS reseller_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  base_plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  custom_name TEXT,
  custom_price_monthly DECIMAL(10,2) NOT NULL,
  custom_price_yearly DECIMAL(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(reseller_id, base_plan_id)
);
ALTER TABLE reseller_plans DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS reseller_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reseller_plan_id UUID REFERENCES reseller_plans(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  trial_days INTEGER NOT NULL DEFAULT 0,
  discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE reseller_invites DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS reseller_referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_id UUID REFERENCES reseller_invites(id) ON DELETE SET NULL,
  invite_code TEXT,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  commission_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_earned DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE reseller_referrals DISABLE ROW LEVEL SECURITY;

-- Add invite_code column if missing
ALTER TABLE reseller_referrals ADD COLUMN IF NOT EXISTS invite_code TEXT;

CREATE TABLE IF NOT EXISTS reseller_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reference TEXT,
  admin_notes TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE reseller_payouts DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS reseller_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  gross_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'subscription',
  payment_ref TEXT,
  payout_id UUID REFERENCES reseller_payouts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE reseller_earnings DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS reseller_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sending',
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE reseller_campaigns DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 18: GIFT INVITES
-- ============================================================
CREATE TABLE IF NOT EXISTS gift_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  duration_days INTEGER NOT NULL DEFAULT 30,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  note TEXT,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE gift_invites DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_gift_invites_code ON gift_invites(code);

-- ============================================================
-- STEP 19: PUSH NOTIFICATIONS & WEBHOOKS
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  subscription TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS zapier_hooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  event TEXT NOT NULL DEFAULT 'message_received',
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE zapier_hooks DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 20: SYSTEM LOGS & API KEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE system_logs DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE api_keys DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- ============================================================
-- STEP 21: DEFAULT FREE PLAN (insert if not exists)
-- ============================================================
INSERT INTO plans (
  id, name, description,
  price_monthly, price_yearly,
  max_messages_month, max_contacts, max_instances, max_campaigns,
  max_team_members, max_chatbot_flows, max_segments, max_links,
  allow_chatbot, allow_automation, allow_analytics,
  allow_api_access, allow_white_label, allow_sub_accounts,
  allow_reseller, allow_gift_invites,
  is_active, sort_order
) VALUES (
  uuid_generate_v4(), 'Free', 'Basic free plan',
  0, 0,
  500, 100, 1, 3,
  1, 2, 2, 5,
  true, true, true,
  false, false, false,
  false, false,
  true, 0
) ON CONFLICT DO NOTHING;

-- ============================================================
-- DONE ✅
-- ============================================================
SELECT 'WABEK database setup complete!' AS status;

-- Fix sub_accounts: ensure owner_id column exists (API uses owner_id)
ALTER TABLE sub_accounts ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES users(id) ON DELETE CASCADE;
UPDATE sub_accounts SET parent_id = owner_id WHERE parent_id IS NULL AND owner_id IS NOT NULL;

-- Fix chatbot_sessions: add unique constraint for upsert
ALTER TABLE chatbot_sessions DROP CONSTRAINT IF EXISTS chatbot_sessions_user_contact_unique;
ALTER TABLE chatbot_sessions ADD CONSTRAINT chatbot_sessions_user_contact_unique UNIQUE (user_id, contact_phone);

-- Fix automation_flows: make instance_id optional
ALTER TABLE automation_flows ALTER COLUMN instance_id DROP NOT NULL;

-- Fix contacts: ensure custom_fields column exists
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '{}';

-- ── Add missing whatsapp_instances columns ──────────────────
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS instance_type TEXT DEFAULT 'cloud_api';
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS waba_id TEXT;
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Update existing rows: copy type → instance_type
UPDATE whatsapp_instances SET instance_type = type WHERE instance_type IS NULL;
