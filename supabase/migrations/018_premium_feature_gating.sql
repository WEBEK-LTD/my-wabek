-- ============================================================
-- 018: Premium feature gating (Wix review requirement)
--
-- Wix reviewers were able to access Chatbot Builder, Automation,
-- AI Agents, and Campaigns on the Free plan without upgrading.
-- This migration:
--   1. Adds `allow_ai` feature flag (mirrors allow_chatbot/allow_automation)
--   2. Configures the Free plan to restrict these premium features,
--      matching the pricing page copy:
--        - Free:     "1 instance · Basic features" (no Campaigns, no
--                     Chatbot, no AI, no Automation)
--        - Starter:  adds Campaigns + Analytics
--        - Pro+:     adds AI + Chatbot + all features
-- ============================================================

ALTER TABLE plans ADD COLUMN IF NOT EXISTS allow_ai BOOLEAN DEFAULT true;

-- Free plan: disable premium features entirely
UPDATE plans SET
  allow_chatbot    = false,
  allow_automation = false,
  allow_ai         = false,
  max_campaigns    = 0,
  max_chatbot_flows = 0
WHERE name ILIKE 'free';

-- Starter: campaigns + automation allowed, chatbot/AI still Pro+
UPDATE plans SET
  allow_chatbot    = false,
  allow_automation = true,
  allow_ai         = false
WHERE name ILIKE 'starter';

-- Pro and Business: everything enabled
UPDATE plans SET
  allow_chatbot    = true,
  allow_automation = true,
  allow_ai         = true
WHERE name ILIKE 'pro' OR name ILIKE 'business';
