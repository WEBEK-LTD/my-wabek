-- ============================================================
-- 022: Fix missing unique constraint for Multi Inbox
--
-- Migration 021 added instance_id column but the unique index
-- may have failed if old duplicate rows existed.
-- This migration ensures the constraint exists cleanly.
-- ============================================================

-- Step 1: Remove old constraint (if still exists from before 021)
ALTER TABLE conversation_assignments
  DROP CONSTRAINT IF EXISTS conversation_assignments_owner_id_contact_id_key;

-- Step 2: Drop any partial indexes from 021 that may have failed
DROP INDEX IF EXISTS idx_conv_owner_contact_instance;
DROP INDEX IF EXISTS idx_conv_owner_contact_legacy;

-- Step 3: For rows with the same (owner_id, contact_id, instance_id),
-- keep only the most recent one before adding unique constraint
DELETE FROM conversation_assignments a
USING conversation_assignments b
WHERE a.ctid < b.ctid
  AND a.owner_id = b.owner_id
  AND a.contact_id = b.contact_id
  AND a.instance_id IS NOT DISTINCT FROM b.instance_id;

-- Step 4: Add the unique constraint as a real TABLE constraint
-- (more reliable than partial indexes for ON CONFLICT to work)
ALTER TABLE conversation_assignments
  DROP CONSTRAINT IF EXISTS conversation_assignments_owner_contact_instance_unique;

ALTER TABLE conversation_assignments
  ADD CONSTRAINT conversation_assignments_owner_contact_instance_unique
  UNIQUE (owner_id, contact_id, instance_id);

-- Step 5: Performance indexes
CREATE INDEX IF NOT EXISTS idx_conv_instance_id
  ON conversation_assignments(instance_id)
  WHERE instance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conv_owner_instance
  ON conversation_assignments(owner_id, instance_id);
