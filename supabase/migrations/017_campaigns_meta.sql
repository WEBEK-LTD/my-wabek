-- ============================================================
-- 017: Add `meta` JSONB column to campaigns
--
-- Required for batched/resumable campaign sending: stores the resume
-- offset and reengagement_blocked counter between serverless invocations.
-- The application code already wrote `meta: {...}` in several places
-- (api/campaigns/[id].ts) but the column never existed, so those updates
-- were silently failing.
-- ============================================================

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;
