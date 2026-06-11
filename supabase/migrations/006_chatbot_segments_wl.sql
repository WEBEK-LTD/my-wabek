-- ============================================================
-- WABEK Migration 006 - Chatbot + Segments + Link Tracking + White Label
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Chatbot Flows (enhanced) ──────────────────────────────
CREATE TABLE IF NOT EXISTS chatbot_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'keyword' CHECK (trigger_type IN ('keyword','any_message','opt_in','button_reply','first_message')),
  trigger_keywords TEXT[] DEFAULT '{}',
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chatbot_user ON chatbot_flows(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_active ON chatbot_flows(is_active);
ALTER TABLE chatbot_flows DISABLE ROW LEVEL SECURITY;

-- Active chatbot sessions (tracks where user is in flow)
CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES chatbot_flows(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  current_node_id TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, contact_phone)
);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_user ON chatbot_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_contact ON chatbot_sessions(contact_phone);
ALTER TABLE chatbot_sessions DISABLE ROW LEVEL SECURITY;

-- ── Contact Segments ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '[]',
  operator TEXT NOT NULL DEFAULT 'AND' CHECK (operator IN ('AND','OR')),
  contact_count INTEGER NOT NULL DEFAULT 0,
  is_dynamic BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_segments_user ON contact_segments(user_id);
ALTER TABLE contact_segments DISABLE ROW LEVEL SECURITY;

-- ── Link Tracking ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracked_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  original_url TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  title TEXT,
  click_count INTEGER NOT NULL DEFAULT 0,
  unique_click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tracked_links_user ON tracked_links(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_code ON tracked_links(short_code);
ALTER TABLE tracked_links DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
  contact_phone TEXT,
  ip_address TEXT,
  user_agent TEXT,
  country TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link ON link_clicks(link_id);
ALTER TABLE link_clicks DISABLE ROW LEVEL SECURITY;

-- ── White Label Settings ─────────────────────────────────
CREATE TABLE IF NOT EXISTS white_label_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  brand_name TEXT,
  brand_logo TEXT,
  brand_color TEXT DEFAULT '#00D46A',
  brand_secondary_color TEXT DEFAULT '#0D1117',
  custom_domain TEXT,
  favicon_url TEXT,
  support_email TEXT,
  support_whatsapp TEXT,
  hide_powered_by BOOLEAN NOT NULL DEFAULT false,
  custom_css TEXT,
  custom_footer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE white_label_settings DISABLE ROW LEVEL SECURITY;

-- ── Sub-accounts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sub_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  max_contacts INTEGER DEFAULT -1,
  max_instances INTEGER DEFAULT 1,
  max_campaigns INTEGER DEFAULT 10,
  max_messages_month INTEGER DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parent_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_sub_accounts_parent ON sub_accounts(parent_id);
ALTER TABLE sub_accounts DISABLE ROW LEVEL SECURITY;

-- ── i18n User Preference ─────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en' CHECK (language IN ('en','ar','tr','fr','es'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Add white_label_id to plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_white_label BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_sub_accounts BOOLEAN DEFAULT false;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_sub_accounts INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_chatbot_flows INTEGER DEFAULT 5;

-- Add chatbot_flow_id to automation_flows for linking
ALTER TABLE automation_flows ADD COLUMN IF NOT EXISTS chatbot_flow_id UUID REFERENCES chatbot_flows(id) ON DELETE SET NULL;

-- Update plans with new limits
UPDATE plans SET
  allow_white_label = CASE WHEN name = 'Business' THEN true ELSE false END,
  allow_sub_accounts = CASE WHEN name IN ('Pro','Business') THEN true ELSE false END,
  max_sub_accounts = CASE WHEN name = 'Business' THEN 10 WHEN name = 'Pro' THEN 3 ELSE 0 END,
  max_chatbot_flows = CASE WHEN name = 'Business' THEN -1 WHEN name = 'Pro' THEN 20 WHEN name = 'Starter' THEN 5 ELSE 2 END;
