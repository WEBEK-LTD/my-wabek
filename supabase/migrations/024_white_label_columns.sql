-- 024: Add missing columns to white_label_settings
ALTER TABLE white_label_settings
  ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT DEFAULT '#F8FAFC',
  ADD COLUMN IF NOT EXISTS favicon_url           TEXT,
  ADD COLUMN IF NOT EXISTS support_email         TEXT,
  ADD COLUMN IF NOT EXISTS support_whatsapp      TEXT,
  ADD COLUMN IF NOT EXISTS custom_footer         TEXT;
