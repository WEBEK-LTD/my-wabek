-- =====================================================================
-- 030: Re-assert the 026 lockdown for objects created AFTER 026
--
-- 027–029 create tables / functions (rate_limits, processed_stripe_events,
-- rate_limit_hit, bump_token_version, reseller_add_earning,
-- reseller_record_payout, ...). Each of them already enables RLS and revokes
-- anon/authenticated explicitly, and 026 changes the default privileges, but
-- Postgres' built-in "EXECUTE to PUBLIC" default for functions is global and
-- cannot be revoked per schema. This migration therefore re-runs 026's
-- generic loops so the end state is the same whatever order 026–029 ran in.
--
-- Idempotent and non-destructive: no table, column, row, whatsapp_instances
-- or wa_sessions semantics change. service_role (app + Baileys server) keeps
-- full access.
-- =====================================================================

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

  -- RLS on every ordinary / partitioned table in public.
  FOR r IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;

  -- No policies for anon / authenticated / PUBLIC.
  FOR r IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND roles && ARRAY['anon', 'authenticated', 'public']::name[]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;

  -- Tables / views.
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

  -- Sequences.
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

  -- Functions we own (not extension members).
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

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role';
    EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
