-- ============================================================
-- 027: Auth hardening (additive, idempotent — safe to re-run)
--  * users.token_version        — JWT revocation (claim `tv`)
--  * otp_pending / otp_codes     — attempts counter (+ is_used where missing)
--  * team_members                — invite_expires_at (+ invite_token if missing)
--  * rate_limits + rate_limit_hit() — serverless-safe rate limiter
--  * processed_stripe_events     — Stripe webhook idempotency (shared)
--  * bump_token_version()       — atomic token revocation (reseller_add_earning is in 028)
--  * case-insensitive unique custom_domain (only if no duplicates exist)
-- No existing data is dropped or rewritten.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE otp_pending ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE otp_pending ADD COLUMN IF NOT EXISTS is_used BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE otp_codes   ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_team_members_invite_token ON team_members(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_members_user_owner ON team_members(user_id, owner_id);

-- ── Rate limiting ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Returns true while the caller is within p_max hits per p_window_seconds.
CREATE OR REPLACE FUNCTION rate_limit_hit(p_key TEXT, p_max INTEGER, p_window_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO rate_limits AS r (key, count, reset_at)
  VALUES (p_key, 1, now() + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE SET
    count    = CASE WHEN r.reset_at <= now() THEN 1 ELSE r.count + 1 END,
    reset_at = CASE WHEN r.reset_at <= now() THEN now() + make_interval(secs => p_window_seconds) ELSE r.reset_at END
  RETURNING count INTO v_count;

  -- Opportunistic cleanup of long-expired buckets (~1% of calls).
  IF random() < 0.01 THEN
    DELETE FROM rate_limits WHERE reset_at < now() - INTERVAL '1 hour';
  END IF;

  RETURN v_count <= p_max;
END;
$$;

-- ── Stripe webhook idempotency (main billing webhook may share it) ──
-- Identical definition in 028 (CREATE ... IF NOT EXISTS; either may run first).
CREATE TABLE IF NOT EXISTS processed_stripe_events (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- ── Atomic helpers ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION bump_token_version(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
AS $$
  UPDATE users SET token_version = COALESCE(token_version, 0) + 1
  WHERE id = p_user_id
  RETURNING token_version;
$$;

-- reseller_add_earning(p_user, p_amount, p_referred) is defined in 028
-- (single signature; every caller uses it).

-- The server uses the service role. These must NOT be callable by the
-- anon/authenticated PostgREST roles (functions default to EXECUTE for PUBLIC).
REVOKE ALL ON FUNCTION rate_limit_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION bump_token_version(UUID) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION rate_limit_hit(TEXT, INTEGER, INTEGER) FROM anon;
    REVOKE ALL ON FUNCTION bump_token_version(UUID) FROM anon;
    REVOKE ALL ON TABLE rate_limits FROM anon;
    REVOKE ALL ON TABLE processed_stripe_events FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION rate_limit_hit(TEXT, INTEGER, INTEGER) FROM authenticated;
    REVOKE ALL ON FUNCTION bump_token_version(UUID) FROM authenticated;
    REVOKE ALL ON TABLE rate_limits FROM authenticated;
    REVOKE ALL ON TABLE processed_stripe_events FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION rate_limit_hit(TEXT, INTEGER, INTEGER) TO service_role;
    GRANT EXECUTE ON FUNCTION bump_token_version(UUID) TO service_role;
    GRANT ALL ON TABLE rate_limits TO service_role;
    GRANT ALL ON TABLE processed_stripe_events TO service_role;
  END IF;
END $$;

-- ── One custom domain per account (case-insensitive) ─────────
-- Created only when existing data has no duplicates; otherwise the API-level
-- check still applies and the duplicates must be resolved by an admin first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_white_label_custom_domain_ci'
  ) THEN
    IF NOT EXISTS (
      SELECT lower(custom_domain) FROM white_label_settings
      WHERE custom_domain IS NOT NULL AND custom_domain <> ''
      GROUP BY lower(custom_domain) HAVING count(*) > 1
    ) THEN
      CREATE UNIQUE INDEX uq_white_label_custom_domain_ci
        ON white_label_settings (lower(custom_domain))
        WHERE custom_domain IS NOT NULL AND custom_domain <> '';
    ELSE
      RAISE NOTICE 'white_label_settings has duplicate custom_domain values — unique index not created';
    END IF;
  END IF;
END $$;
