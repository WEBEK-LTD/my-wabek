-- ============================================================
-- 020: Full media support for /dashboard/chat
--
-- Extends messages.type CHECK constraint to support sticker and ptt
-- (voice notes), and adds media_mime_type + media_filename so the UI
-- can render the correct player/icon and download with the right name.
--
-- This is purely additive — existing rows and existing type values
-- ('text','image','video','audio','document','template','interactive',
-- 'ai_reply') are NOT affected.
-- ============================================================

-- Drop and recreate the CHECK constraint with the wider set of types.
-- Constraint name varies by which migration created the table first
-- (001 vs 009), so we drop both possible names defensively.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;

ALTER TABLE messages ADD CONSTRAINT messages_type_check
  CHECK (type IN ('text','image','video','audio','document','sticker','ptt','template','interactive','ai_reply'));

-- mime type (e.g. application/pdf, image/jpeg) — lets the UI pick the
-- right renderer/icon without guessing from the URL extension.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_mime_type TEXT;

-- original filename for documents (e.g. "invoice.pdf") — WhatsApp sends
-- this separately from the media URL, used for the download UI.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_filename TEXT;
