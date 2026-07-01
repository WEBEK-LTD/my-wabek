-- ============================================================
-- 021: Multi Inbox Architecture
--
-- Converts Live Chat from a single shared inbox into a proper
-- Multi Inbox system where each WhatsApp instance (phone number)
-- is an independent inbox with its own conversations, permissions,
-- and counters.
--
-- Changes:
-- 1. Add instance_id to conversation_assignments
-- 2. Relax the UNIQUE constraint to (owner_id, contact_id, instance_id)
--    so the same contact can have a separate conversation per inbox
-- 3. Create team_member_instances for per-instance permissions
-- 4. Backfill instance_id for existing conversations where possible
-- 5. Add indexes for performance
--
-- Backward compatibility:
-- - All existing conversations get instance_id = NULL
-- - NULL means "legacy / unknown inbox" → only visible in All Inboxes
-- - New conversations always get instance_id set by the API
-- - No data is deleted or modified beyond adding the new column
-- ============================================================

-- ─── 1. Add instance_id to conversation_assignments ─────────
ALTER TABLE conversation_assignments
  ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL;

-- ─── 2. Update UNIQUE constraint ────────────────────────────
-- Old: UNIQUE(owner_id, contact_id)  ← prevents same contact on 2 numbers
-- New: UNIQUE(owner_id, contact_id, instance_id)  ← one convo per contact per inbox
--
-- We drop the old constraint and add the new one. Rows with instance_id = NULL
-- are treated as a single legacy bucket (NULL = NULL in unique indexes in Postgres,
-- so multiple NULL rows for the same owner+contact are allowed — this is correct
-- since old rows predate the multi-inbox system).
ALTER TABLE conversation_assignments
  DROP CONSTRAINT IF EXISTS conversation_assignments_owner_id_contact_id_key;

ALTER TABLE conversation_assignments
  DROP CONSTRAINT IF EXISTS conversation_assignments_pkey CASCADE;

-- Re-add primary key (was dropped by CASCADE above)
ALTER TABLE conversation_assignments
  ADD PRIMARY KEY (id);

-- New unique constraint: owner + contact + instance (NULLs are distinct in PG)
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_owner_contact_instance
  ON conversation_assignments(owner_id, contact_id, instance_id)
  WHERE instance_id IS NOT NULL;

-- Separate index for legacy rows (instance_id IS NULL) — keeps backward compat
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_owner_contact_legacy
  ON conversation_assignments(owner_id, contact_id)
  WHERE instance_id IS NULL;

-- ─── 3. Performance indexes ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conv_instance_id
  ON conversation_assignments(instance_id)
  WHERE instance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conv_owner_instance
  ON conversation_assignments(owner_id, instance_id);

-- ─── 4. Backfill: link existing conversations to instances ───
-- For each conversation, find the most recent message and use
-- its instance_id to determine which inbox this conversation
-- belongs to. Only backfills when there is an unambiguous match
-- (exactly one instance found for the owner+contact pair).
DO $$
DECLARE
  conv RECORD;
  found_instance_id UUID;
  instance_count INT;
BEGIN
  FOR conv IN
    SELECT id, owner_id, contact_id
    FROM conversation_assignments
    WHERE instance_id IS NULL
  LOOP
    SELECT COUNT(DISTINCT instance_id)
    INTO instance_count
    FROM messages
    WHERE user_id = conv.owner_id
      AND contact_id = conv.contact_id
      AND instance_id IS NOT NULL;

    IF instance_count = 1 THEN
      SELECT instance_id INTO found_instance_id
      FROM messages
      WHERE user_id = conv.owner_id
        AND contact_id = conv.contact_id
        AND instance_id IS NOT NULL
      LIMIT 1;

      UPDATE conversation_assignments
      SET instance_id = found_instance_id
      WHERE id = conv.id;
    END IF;
  END LOOP;
END $$;

-- ─── 5. team_member_instances ───────────────────────────────
-- Controls which WhatsApp inboxes each team member can access.
-- Rules:
--   • Owner (sub_account_of IS NULL) → sees all inboxes always
--   • Team member with NO rows here → sees all inboxes (default open)
--   • Team member with rows here → sees ONLY listed inboxes
-- This "allowlist" model means adding the first row restricts the member.
CREATE TABLE IF NOT EXISTS team_member_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id    UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_user_id, instance_id)
);

ALTER TABLE team_member_instances DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tmi_member  ON team_member_instances(member_user_id);
CREATE INDEX IF NOT EXISTS idx_tmi_instance ON team_member_instances(instance_id);

-- ─── 6. last_inbox_id preference column on users ────────────
-- Persists the last selected inbox per user across devices/browsers.
-- NULL means "All Inboxes" (default for owner) or "first inbox" (default for member).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_inbox_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL;
