-- 024: Add missing columns to white_label_settings
ALTER TABLE white_label_settings
  ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT DEFAULT '#F8FAFC',
  ADD COLUMN IF NOT EXISTS favicon_url           TEXT,
  ADD COLUMN IF NOT EXISTS support_email         TEXT,
  ADD COLUMN IF NOT EXISTS support_whatsapp      TEXT,
  ADD COLUMN IF NOT EXISTS custom_footer         TEXT;

-- brand_favicon → alias kept for backward compat, favicon_url is the canonical name
-- Backfill favicon_url from brand_favicon if exists
UPDATE white_label_settings
SET favicon_url = brand_favicon
WHERE brand_favicon IS NOT NULL AND favicon_url IS NULL;
