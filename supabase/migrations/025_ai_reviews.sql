-- 025: AI Quality Reviews System

-- Add review tracking columns to conversation_assignments
ALTER TABLE conversation_assignments
  ADD COLUMN IF NOT EXISTS last_activity      TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS review_status      TEXT DEFAULT 'active' CHECK (review_status IN ('active', 'reviewing', 'reviewed')),
  ADD COLUMN IF NOT EXISTS last_reviewed_at   TIMESTAMPTZ DEFAULT NULL;

-- Index for the hourly scheduler query
CREATE INDEX IF NOT EXISTS idx_conv_review_status
  ON conversation_assignments(owner_id, review_status, last_activity);

-- AI Reviews: one per conversation session
CREATE TABLE IF NOT EXISTS ai_reviews (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_key    TEXT NOT NULL,  -- owner_id:contact_id for grouping
  review_version      INTEGER NOT NULL DEFAULT 1,
  message_range_start TIMESTAMPTZ,   -- first message of this session
  message_range_end   TIMESTAMPTZ,   -- last message of this session
  message_count       INTEGER DEFAULT 0,
  overall_summary     TEXT,
  overall_score       NUMERIC(4,2),  -- avg of all member scores
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  ai_provider         TEXT DEFAULT 'deepseek',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at         TIMESTAMPTZ,
  UNIQUE(owner_id, contact_id, review_version)
);

-- AI Review Items: one per member who participated
CREATE TABLE IF NOT EXISTS ai_review_items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id             UUID NOT NULL REFERENCES ai_reviews(id) ON DELETE CASCADE,
  owner_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  member_name           TEXT,
  messages_count        INTEGER DEFAULT 0,
  -- Scores (0-10)
  score_overall         NUMERIC(4,2),
  score_accuracy        NUMERIC(4,2),
  score_professionalism NUMERIC(4,2),
  score_clarity         NUMERIC(4,2),
  score_empathy         NUMERIC(4,2),
  score_helpfulness     NUMERIC(4,2),
  score_completeness    NUMERIC(4,2),
  score_grammar         NUMERIC(4,2),
  score_sales           NUMERIC(4,2),
  score_compliance      NUMERIC(4,2),
  -- Feedback
  strengths             TEXT[],
  issues                TEXT[],
  suggested_reply       TEXT,
  coaching_notes        TEXT,
  -- Manual comment from owner
  manual_comment        TEXT,
  manual_comment_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_reviews_owner    ON ai_reviews(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_review_items_member ON ai_review_items(owner_id, member_user_id, created_at DESC);

-- system_settings already exists with value JSONB — just insert AI config keys
-- Using JSON string format (quoted) since value column is JSONB
INSERT INTO system_settings (key, value) VALUES
  ('ai_provider',              '"deepseek"'),
  ('ai_reviews_enabled',       '"true"'),
  ('ai_review_interval_hours', '"1"'),
  ('ai_inactivity_hours',      '"2"'),
  ('ai_max_messages',          '"100"'),
  ('ai_daily_limit',           '"500"'),
  ('ai_deepseek_api_key',      '""')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE ai_reviews        DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_review_items   DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings   DISABLE ROW LEVEL SECURITY;
