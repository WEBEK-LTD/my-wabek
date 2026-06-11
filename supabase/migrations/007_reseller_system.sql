-- ============================================================
-- WABEK Migration 007 - Reseller / White Label Billing System
-- ============================================================

-- Reseller profiles (extends white_label_settings)
CREATE TABLE IF NOT EXISTS reseller_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Payment method
  payment_method TEXT NOT NULL DEFAULT 'platform' CHECK (payment_method IN ('platform', 'stripe_own', 'both')),
  
  -- Own Stripe keys (encrypted in practice - store as-is for now)
  own_stripe_secret_key TEXT,
  own_stripe_publishable_key TEXT,
  own_stripe_webhook_secret TEXT,
  
  -- Platform payout settings
  payout_schedule TEXT NOT NULL DEFAULT 'monthly' CHECK (payout_schedule IN ('weekly', 'biweekly', 'monthly')),
  payout_method TEXT DEFAULT 'bank_transfer' CHECK (payout_method IN ('bank_transfer', 'paypal', 'wise', 'crypto')),
  payout_details JSONB DEFAULT '{}',
  
  -- Balance tracking
  balance_pending DECIMAL(10,2) NOT NULL DEFAULT 0,   -- earned, not yet paid out
  balance_paid DECIMAL(10,2) NOT NULL DEFAULT 0,       -- total paid out
  balance_total DECIMAL(10,2) NOT NULL DEFAULT 0,      -- all time earnings
  
  -- Commission for referrals
  referral_commission_pct DECIMAL(5,2) NOT NULL DEFAULT 0,  -- % we give them per referral
  
  -- Status
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reseller_user ON reseller_profiles(user_id);
ALTER TABLE reseller_profiles DISABLE ROW LEVEL SECURITY;

-- Reseller custom plans (reseller sets their own prices)
CREATE TABLE IF NOT EXISTS reseller_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  base_plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  
  -- Custom pricing
  custom_name TEXT,
  custom_price_monthly DECIMAL(10,2) NOT NULL,
  custom_price_yearly DECIMAL(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Their own Stripe price IDs (if using own Stripe)
  own_stripe_price_id_monthly TEXT,
  own_stripe_price_id_yearly TEXT,
  
  -- Platform Stripe price IDs (auto-created)
  platform_stripe_price_id_monthly TEXT,
  platform_stripe_price_id_yearly TEXT,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(reseller_id, base_plan_id)
);
CREATE INDEX IF NOT EXISTS idx_reseller_plans_reseller ON reseller_plans(reseller_id);
ALTER TABLE reseller_plans DISABLE ROW LEVEL SECURITY;

-- Invite / referral links
CREATE TABLE IF NOT EXISTS reseller_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reseller_plan_id UUID REFERENCES reseller_plans(id) ON DELETE SET NULL,
  
  code TEXT NOT NULL UNIQUE,             -- invite code e.g. "JOHN-PRO"
  label TEXT,                            -- internal label
  
  -- What the invited user gets
  trial_days INTEGER NOT NULL DEFAULT 0,
  discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  
  -- Limits
  max_uses INTEGER,                      -- null = unlimited
  use_count INTEGER NOT NULL DEFAULT 0,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reseller_invites_reseller ON reseller_invites(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_invites_code ON reseller_invites(code);
ALTER TABLE reseller_invites DISABLE ROW LEVEL SECURITY;

-- Track signups via invite
CREATE TABLE IF NOT EXISTS reseller_referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_id UUID REFERENCES reseller_invites(id) ON DELETE SET NULL,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'churned', 'refunded')),
  
  -- Earnings tracking
  commission_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_earned DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_reseller ON reseller_referrals(reseller_id);
ALTER TABLE reseller_referrals DISABLE ROW LEVEL SECURITY;

-- Payout records
CREATE TABLE IF NOT EXISTS reseller_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  
  reference TEXT,           -- bank transfer ref / PayPal transaction ID
  admin_notes TEXT,
  
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payouts_reseller ON reseller_payouts(reseller_id);
ALTER TABLE reseller_payouts DISABLE ROW LEVEL SECURITY;

-- Track referred user payments (for commission calculation)
CREATE TABLE IF NOT EXISTS reseller_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  amount DECIMAL(10,2) NOT NULL,         -- what reseller earns on this payment
  gross_amount DECIMAL(10,2) NOT NULL,   -- what user paid
  platform_fee DECIMAL(10,2) NOT NULL,   -- our cost
  
  source TEXT NOT NULL DEFAULT 'subscription', -- subscription | manual
  payment_ref TEXT,
  
  payout_id UUID REFERENCES reseller_payouts(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_earnings_reseller ON reseller_earnings(reseller_id);
ALTER TABLE reseller_earnings DISABLE ROW LEVEL SECURITY;

-- Add reseller tracking to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- Add reseller flag to white_label_settings
ALTER TABLE white_label_settings ADD COLUMN IF NOT EXISTS is_reseller BOOLEAN DEFAULT false;
ALTER TABLE white_label_settings ADD COLUMN IF NOT EXISTS reseller_signup_enabled BOOLEAN DEFAULT true;
ALTER TABLE white_label_settings ADD COLUMN IF NOT EXISTS reseller_default_trial_days INTEGER DEFAULT 14;

-- Stripe Connect columns (add to reseller_profiles)
ALTER TABLE reseller_profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;
ALTER TABLE reseller_profiles ADD COLUMN IF NOT EXISTS stripe_connect_access_token TEXT;
ALTER TABLE reseller_profiles ADD COLUMN IF NOT EXISTS stripe_connect_refresh_token TEXT;

-- ── Gift / Standalone Invites ────────────────────────────
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

-- Add more plan limits
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_team_members INTEGER DEFAULT 1;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_chatbot_flows INTEGER DEFAULT 2;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_quick_replies INTEGER DEFAULT 10;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_segments INTEGER DEFAULT 5;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_links INTEGER DEFAULT 10;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_api_access BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_chatbot BOOLEAN DEFAULT true;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_automation BOOLEAN DEFAULT true;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_analytics BOOLEAN DEFAULT true;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_reseller BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_gift_invites BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS invite_credits INTEGER DEFAULT 0;
