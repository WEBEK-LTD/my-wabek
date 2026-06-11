-- ============================================================
-- WABEK Migration 008 - Plans columns + Gift Invites
-- Run this in Supabase SQL Editor if you get "column not found" errors
-- ============================================================

-- All new plan columns (safe to run multiple times)
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

-- Reseller profile columns
ALTER TABLE reseller_profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;
ALTER TABLE reseller_profiles ADD COLUMN IF NOT EXISTS stripe_connect_access_token TEXT;
ALTER TABLE reseller_profiles ADD COLUMN IF NOT EXISTS stripe_connect_refresh_token TEXT;

-- User columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- Gift invites table
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
CREATE INDEX IF NOT EXISTS idx_gift_invites_code ON gift_invites(code);
ALTER TABLE gift_invites DISABLE ROW LEVEL SECURITY;

-- Reseller tables (safe if already exist)
CREATE TABLE IF NOT EXISTS reseller_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  payment_method TEXT NOT NULL DEFAULT 'platform' CHECK (payment_method IN ('platform', 'stripe_own', 'both')),
  own_stripe_secret_key TEXT,
  own_stripe_publishable_key TEXT,
  own_stripe_webhook_secret TEXT,
  stripe_connect_account_id TEXT,
  stripe_connect_access_token TEXT,
  stripe_connect_refresh_token TEXT,
  payout_schedule TEXT NOT NULL DEFAULT 'monthly' CHECK (payout_schedule IN ('weekly', 'biweekly', 'monthly')),
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

CREATE TABLE IF NOT EXISTS reseller_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  base_plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  custom_name TEXT,
  custom_price_monthly DECIMAL(10,2) NOT NULL,
  custom_price_yearly DECIMAL(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  own_stripe_price_id_monthly TEXT,
  own_stripe_price_id_yearly TEXT,
  platform_stripe_price_id_monthly TEXT,
  platform_stripe_price_id_yearly TEXT,
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
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  commission_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_earned DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referred_user_id)
);
ALTER TABLE reseller_referrals DISABLE ROW LEVEL SECURITY;

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
  gross_amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'subscription',
  payment_ref TEXT,
  payout_id UUID REFERENCES reseller_payouts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE reseller_earnings DISABLE ROW LEVEL SECURITY;

-- Reseller campaigns
CREATE TABLE IF NOT EXISTS reseller_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'scheduled', 'completed', 'failed')),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reseller_campaigns_reseller ON reseller_campaigns(reseller_id);
ALTER TABLE reseller_campaigns DISABLE ROW LEVEL SECURITY;

-- Zapier / Make webhooks
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
CREATE INDEX IF NOT EXISTS idx_zapier_hooks_user ON zapier_hooks(user_id);
ALTER TABLE zapier_hooks DISABLE ROW LEVEL SECURITY;

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  subscription TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;
