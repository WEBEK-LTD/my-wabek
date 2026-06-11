-- Wix App installations (one per Wix site)
CREATE TABLE IF NOT EXISTS wix_installations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_instance_id   TEXT UNIQUE NOT NULL,
  owner_id          TEXT,
  access_token      TEXT,
  refresh_token     TEXT,
  site_name         TEXT,
  site_url          TEXT,
  installed_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Link between WABEK users and Wix installations
CREATE TABLE IF NOT EXISTS wix_user_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wix_instance_id   TEXT NOT NULL,
  connected_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, wix_instance_id)
);

-- Disable RLS
ALTER TABLE wix_installations DISABLE ROW LEVEL SECURITY;
ALTER TABLE wix_user_links    DISABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wix_user_links_user_id ON wix_user_links(user_id);
CREATE INDEX IF NOT EXISTS idx_wix_user_links_instance ON wix_user_links(wix_instance_id);
