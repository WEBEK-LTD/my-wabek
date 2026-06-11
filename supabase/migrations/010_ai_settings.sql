-- AI Settings table
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  system_prompt TEXT,
  company_name TEXT,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  max_tokens INTEGER NOT NULL DEFAULT 300,
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  escalation_keywords TEXT NOT NULL DEFAULT 'agent,human,انسان,موظف,بشري',
  replies_this_month INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, instance_id)
);

-- Push subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_ai_settings" ON ai_settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_push_subs" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Service role bypass
CREATE POLICY "service_role_ai_settings" ON ai_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_push_subs" ON push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS ai_settings_user_instance ON ai_settings(user_id, instance_id);
CREATE INDEX IF NOT EXISTS ai_settings_user_enabled ON ai_settings(user_id, is_enabled);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(user_id);
