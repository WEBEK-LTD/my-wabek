-- =====================================================
-- Fix duplicate wa_message_id in messages table
-- =====================================================

-- 1. Remove duplicate rows keeping only the latest
DELETE FROM messages a
  USING messages b
  WHERE a.wa_message_id = b.wa_message_id
    AND a.wa_message_id IS NOT NULL
    AND a.created_at < b.created_at;

-- 2. Add unique constraint to prevent future duplicates
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_wa_message_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS messages_wa_message_id_unique
  ON messages(wa_message_id)
  WHERE wa_message_id IS NOT NULL;

-- 3. Add meta column for template logging (if not exists)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT NULL;

-- 4. Fix default status to 'sent' for outbound messages
ALTER TABLE messages ALTER COLUMN status SET DEFAULT 'sent';
UPDATE messages SET status = 'sent' WHERE status = 'pending' AND direction = 'outbound';

-- 5. Add contacts.last_seen for 24h window tracking
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NULL;

-- Update last_seen from existing inbound messages
UPDATE contacts c SET last_seen = (
  SELECT MAX(m.created_at) FROM messages m
  WHERE m.contact_id = c.id AND m.direction = 'inbound'
) WHERE c.id IN (
  SELECT DISTINCT contact_id FROM messages WHERE direction = 'inbound' AND contact_id IS NOT NULL
);

-- Add campaign delivery stat columns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS delivered_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS read_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS accepted_count INTEGER NOT NULL DEFAULT 0;

-- Update accepted_count from existing sent messages
UPDATE campaigns c SET accepted_count = (
  SELECT COUNT(*) FROM messages m
  WHERE m.campaign_id = c.id AND m.direction = 'outbound' AND m.wa_message_id IS NOT NULL
);
