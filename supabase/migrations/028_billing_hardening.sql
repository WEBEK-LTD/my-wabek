-- 028: Billing hardening (additive + idempotent; safe to re-run)
--
--  * processed_stripe_events  — webhook idempotency (same definition as 027)
--  * subscriptions            — one row per user (unique index when data allows)
--                               and a status CHECK that includes 'paused'
--  * reseller_add_earning     — atomic balance increment
--  * reseller_record_payout   — atomic, balance-checked payout
--  * reseller_payouts.idempotency_key, reseller_earnings.payment_ref uniqueness
--  * brand-assets storage bucket (public) for admin logo/favicon uploads

-- ── Stripe webhook idempotency ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS processed_stripe_events (
  id         TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Only the service role (which bypasses RLS) should touch this table.
ALTER TABLE processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- ── subscriptions: status CHECK (superset of every earlier definition) ──────
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.subscriptions DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active','cancelled','past_due','trialing','paused'));
END $$;

-- ── subscriptions: one row per user (needed for upsert onConflict user_id) ──
-- 009 already declares user_id UNIQUE; 001 does not. Only add the index when
-- the data is already clean, so this migration can never fail or delete rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'public.subscriptions'::regclass
      AND i.indisunique AND i.indnatts = 1 AND a.attname = 'user_id'
  ) THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT user_id FROM public.subscriptions GROUP BY user_id HAVING count(*) > 1) THEN
    RAISE NOTICE 'subscriptions has duplicate user_id rows; unique index NOT created. De-duplicate and re-run 028.';
    RETURN;
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_uidx ON public.subscriptions(user_id);
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);

-- ── Reseller payouts / earnings ─────────────────────────────────────────────
ALTER TABLE reseller_payouts ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS reseller_payouts_idempotency_uidx
  ON reseller_payouts(idempotency_key) WHERE idempotency_key IS NOT NULL;

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS reseller_earnings_payment_ref_uidx
    ON reseller_earnings(reseller_id, payment_ref) WHERE payment_ref IS NOT NULL;
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'reseller_earnings has duplicate payment_ref rows; unique index NOT created.';
END $$;

-- Atomically credit a reseller (and the referral's running total).
-- An earlier draft of 027 created a (uuid, uuid, numeric) overload; drop it so
-- PostgREST never has two candidates for rpc('reseller_add_earning').
DROP FUNCTION IF EXISTS reseller_add_earning(uuid, uuid, numeric);

CREATE OR REPLACE FUNCTION reseller_add_earning(p_user uuid, p_amount numeric, p_referred uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN false;
  END IF;
  UPDATE reseller_profiles
     SET balance_pending = COALESCE(balance_pending, 0) + p_amount,
         balance_total   = COALESCE(balance_total, 0)   + p_amount,
         updated_at      = now()
   WHERE user_id = p_user;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF p_referred IS NOT NULL THEN
    UPDATE reseller_referrals
       SET total_earned = COALESCE(total_earned, 0) + p_amount
     WHERE reseller_id = p_user AND referred_user_id = p_referred;
  END IF;
  RETURN true;
END $$;

-- Atomically move p_amount from pending to paid and record the payout.
-- Returns the payout id, or NULL when the pending balance is insufficient.
-- With an idempotency key that was already used, returns the existing payout.
CREATE OR REPLACE FUNCTION reseller_record_payout(
  p_user uuid,
  p_amount numeric,
  p_method text DEFAULT 'bank_transfer',
  p_reference text DEFAULT NULL,
  p_period_start timestamptz DEFAULT NULL,
  p_period_end timestamptz DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN NULL;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id FROM reseller_payouts WHERE idempotency_key = p_idempotency_key;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  UPDATE reseller_profiles
     SET balance_pending = balance_pending - p_amount,
         balance_paid    = balance_paid    + p_amount,
         updated_at      = now()
   WHERE user_id = p_user AND balance_pending >= p_amount;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO reseller_payouts (reseller_id, amount, currency, method, reference, status,
                                period_start, period_end, paid_at, idempotency_key)
  VALUES (p_user, p_amount, 'USD', COALESCE(p_method, 'bank_transfer'), p_reference, 'paid',
          p_period_start, p_period_end, now(), p_idempotency_key)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- These must only be callable with the service role, never via the anon key.
REVOKE ALL ON FUNCTION reseller_add_earning(uuid, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION reseller_record_payout(uuid, numeric, text, text, timestamptz, timestamptz, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION reseller_add_earning(uuid, numeric, uuid) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION reseller_record_payout(uuid, numeric, text, text, timestamptz, timestamptz, text) FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE processed_stripe_events FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION reseller_add_earning(uuid, numeric, uuid) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION reseller_record_payout(uuid, numeric, text, text, timestamptz, timestamptz, text) FROM authenticated';
    EXECUTE 'REVOKE ALL ON TABLE processed_stripe_events FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION reseller_add_earning(uuid, numeric, uuid) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION reseller_record_payout(uuid, numeric, text, text, timestamptz, timestamptz, text) TO service_role';
    EXECUTE 'GRANT ALL ON TABLE processed_stripe_events TO service_role';
  END IF;
END $$;

-- ── Storage bucket for brand assets (logo / favicon) ────────────────────────
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('brand-assets', 'brand-assets', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN undefined_table OR undefined_column OR insufficient_privilege THEN
  RAISE NOTICE 'storage.buckets not available; the app creates the brand-assets bucket on first upload.';
END $$;
