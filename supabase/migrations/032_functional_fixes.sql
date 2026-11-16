-- 032: Functional fixes (additive, idempotent — safe to re-run).
--
--  * campaigns.template_name / template_language / template_variables —
--    the campaign API has always written these; make sure they exist.
--  * zapier_hooks.secret — per-subscription HMAC secret for outgoing webhooks
--    (X-WABEK-Signature). Server-only table; needed in clear to sign.
--  * webhook_deliveries — failed outgoing webhook deliveries, retried by the
--    campaign scheduler cron with backoff.
--  (No new index on messages: the existing idx_messages_contact_id covers the
--   first-message check, and building one would lock a large table.)

-- ── Campaign template columns ───────────────────────────────────────────────
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS template_name      text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS template_language  text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS template_variables jsonb;

-- ── Outgoing webhooks ───────────────────────────────────────────────────────
ALTER TABLE public.zapier_hooks ADD COLUMN IF NOT EXISTS secret          text;
ALTER TABLE public.zapier_hooks ADD COLUMN IF NOT EXISTS last_status     integer;
ALTER TABLE public.zapier_hooks ADD COLUMN IF NOT EXISTS last_error      text;
ALTER TABLE public.zapier_hooks ADD COLUMN IF NOT EXISTS failure_count   integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_zapier_hooks_user_event
  ON public.zapier_hooks (user_id, event) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hook_id         uuid        NOT NULL REFERENCES public.zapier_hooks(id) ON DELETE CASCADE,
  event           text        NOT NULL,
  payload         jsonb       NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts        integer     NOT NULL DEFAULT 1,
  last_status     integer,
  last_error      text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  delivered_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due
  ON public.webhook_deliveries (next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_user
  ON public.webhook_deliveries (user_id, created_at DESC);

-- Same lockdown as 026/030/031: server-only table.
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.webhook_deliveries FROM anon, authenticated;
GRANT ALL ON TABLE public.webhook_deliveries TO service_role;
