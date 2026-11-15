-- =====================================================================
-- 026: Row Level Security lockdown + atomic helper functions
--
-- WHY: earlier migrations ran `DISABLE ROW LEVEL SECURITY` on almost every
-- table and never revoked Supabase's default grants to the `anon` and
-- `authenticated` roles. The anon key ships to every browser, so anyone could
-- read/write users (password_hash, api_key, role), whatsapp_instances
-- (access_token), wa_sessions (creds), system_settings, reseller secrets, ...
-- straight through PostgREST.
--
-- WHAT THIS DOES (idempotent, safe to re-run):
--   1. Creates helper objects the app now relies on (all called with the
--      service role only):
--        - increment_ai_usage(p_user, p_settings_id)   atomic AI reply counter
--        - ai_usage_daily + consume_ai_quota(...)      per-user daily AI cap
--        - increment_link_clicks(p_code)               atomic click counter
--        - support_ticket_number_seq +
--          next_support_ticket_number()                race-free ticket numbers
--        - status_messages.ip_address                  contact-form rate limit
--   2. ENABLEs RLS on every table in schema public.
--   3. DROPs every policy in public that applies to anon / authenticated /
--      PUBLIC (e.g. 016's `INSERT WITH CHECK (true)` and `USING (true)`).
--   4. REVOKEs all table / sequence / function privileges in public from
--      anon, authenticated (and PUBLIC for sequences/functions), and changes
--      the default privileges so future objects are locked as well.
--   5. Re-asserts service_role grants so the app and the Baileys server
--      (both use the service-role key, which has BYPASSRLS) keep working.
--
-- Nothing here changes the shape of whatsapp_instances / wa_sessions or any
-- existing column. Realtime publication is left untouched; with RLS on and no
-- policies, anon/authenticated realtime subscribers simply receive nothing.
-- =====================================================================

-- ── 1a. Atomic AI usage counter ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_user uuid, p_settings_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total integer;
BEGIN
  IF p_settings_id IS NOT NULL THEN
    UPDATE ai_settings
       SET replies_this_month = COALESCE(replies_this_month, 0) + 1,
           updated_at = NOW()
     WHERE id = p_settings_id AND user_id = p_user;
  END IF;

  SELECT COALESCE(SUM(replies_this_month), 0)::integer
    INTO v_total
    FROM ai_settings
   WHERE user_id = p_user;

  RETURN v_total;
END;
$$;

-- ── 1b. Per-user daily AI request cap (interactive AI endpoints) ────────────
CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        DATE NOT NULL DEFAULT CURRENT_DATE,
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);

-- Returns true and consumes one unit if the user is below p_limit for today.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_user uuid, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO ai_usage_daily AS u (user_id, day, count, updated_at)
  VALUES (p_user, CURRENT_DATE, 1, NOW())
  ON CONFLICT (user_id, day) DO UPDATE
     SET count = u.count + 1, updated_at = NOW()
   WHERE u.count < p_limit
  RETURNING u.count INTO v_count;

  RETURN v_count IS NOT NULL AND v_count <= p_limit;
END;
$$;

-- ── 1c. Atomic link click counter ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_link_clicks(p_code text)
RETURNS TABLE (id uuid, original_url text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE tracked_links t
     SET click_count = COALESCE(t.click_count, 0) + 1
   WHERE t.short_code = p_code
  RETURNING t.id, t.original_url;
$$;

-- ── 1d. Support ticket numbers from a sequence (first ticket = 7254) ───────
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_number_seq START WITH 7254 MINVALUE 1;

DO $$
DECLARE
  v_max     bigint;
  v_last    bigint;
  v_called  boolean;
  v_current bigint;
BEGIN
  SELECT COALESCE(MAX(ticket_number), 0) INTO v_max FROM support_tickets;
  SELECT last_value, is_called INTO v_last, v_called FROM support_ticket_number_seq;
  -- Highest number already handed out by the sequence (or 0 if never used).
  v_current := CASE WHEN v_called THEN v_last ELSE v_last - 1 END;
  -- Never move the sequence backwards; next value is > every existing ticket
  -- and >= 7254.
  PERFORM setval('support_ticket_number_seq', GREATEST(v_max, 7253, v_current), true);
END $$;

ALTER TABLE support_tickets
  ALTER COLUMN ticket_number SET DEFAULT nextval('support_ticket_number_seq');

CREATE OR REPLACE FUNCTION public.next_support_ticket_number()
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT nextval('support_ticket_number_seq')::integer;
$$;

-- ── 1e. Contact form rate limiting needs the sender IP ──────────────────────
ALTER TABLE status_messages ADD COLUMN IF NOT EXISTS ip_address TEXT;
CREATE INDEX IF NOT EXISTS idx_status_messages_ip_created ON status_messages(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_messages_email_created ON status_messages(email, created_at DESC);

-- ── 2–4. Lockdown ───────────────────────────────────────────────────────────
DO $$
DECLARE
  r            record;
  v_has_anon   boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon');
  v_has_auth   boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
  v_targets    text;
BEGIN
  v_targets := concat_ws(', ',
    CASE WHEN v_has_anon THEN 'anon' END,
    CASE WHEN v_has_auth THEN 'authenticated' END);

  -- 2. Enable RLS on every ordinary / partitioned table in public.
  FOR r IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;

  -- 3. Drop every policy that applies to anon / authenticated / PUBLIC.
  --    (Policies scoped only to service_role are harmless and kept.)
  FOR r IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND roles && ARRAY['anon', 'authenticated', 'public']::name[]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;

  -- 4a. Revoke table/view privileges.
  FOR r IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  LOOP
    IF v_targets <> '' THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %s', r.relname, v_targets);
    END IF;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', r.relname);
  END LOOP;

  -- 4b. Revoke sequence privileges.
  FOR r IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    IF v_targets <> '' THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM %s', r.relname, v_targets);
    END IF;
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC', r.relname);
  END LOOP;

  -- 4c. Revoke EXECUTE on functions in public that we own (skip functions
  --     that belong to an extension such as uuid-ossp / pgcrypto).
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind IN ('f', 'p')
       AND NOT EXISTS (
         SELECT 1 FROM pg_depend d
          WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
       )
  LOOP
    IF v_targets <> '' THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s', r.sig, v_targets);
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
  END LOOP;

  -- 4d. Default privileges: lock future objects created by the migrating
  --     role and (when we're allowed to) by postgres / supabase_admin.
  IF v_targets <> '' THEN
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %s', v_targets);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %s', v_targets);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %s', v_targets);
    BEGIN
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM %s', v_targets);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %s', v_targets);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %s', v_targets);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping default privileges for role postgres: %', SQLERRM;
    END;
    BEGIN
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM %s', v_targets);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %s', v_targets);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %s', v_targets);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping default privileges for role supabase_admin: %', SQLERRM;
    END;
  END IF;
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC';

  -- 5. Make sure the service role (server code + Baileys) keeps full access.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role';
    EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role';
  END IF;
END $$;

-- Ask PostgREST to pick up the new functions / privileges immediately.
NOTIFY pgrst, 'reload schema';
