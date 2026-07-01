-- ============================================================
-- 023: WA Sessions Storage
--
-- Stores Baileys WhatsApp Web authentication credentials in
-- Supabase instead of Railway's ephemeral disk.
-- This allows sessions to survive Railway restarts and deploys
-- without requiring a Persistent Volume.
-- ============================================================

CREATE TABLE IF NOT EXISTS wa_sessions (
  instance_id TEXT PRIMARY KEY,
  creds       JSONB NOT NULL,
  keys        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wa_sessions DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_wa_sessions_updated ON wa_sessions(updated_at);
