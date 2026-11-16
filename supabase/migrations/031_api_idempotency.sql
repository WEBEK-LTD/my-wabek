-- 031: Idempotency keys for POST /api/v1/send (additive, safe to re-run).
-- A retried request with the same Idempotency-Key returns the first result
-- instead of sending the WhatsApp message twice. Rows older than 24h are
-- ignored by the API and can be purged at any time.

CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  key        text        NOT NULL,
  response   jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE INDEX IF NOT EXISTS api_idempotency_keys_created_at_idx
  ON public.api_idempotency_keys (created_at);

-- Same lockdown as 026/030: server-only table.
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_idempotency_keys FROM anon, authenticated;
GRANT ALL ON TABLE public.api_idempotency_keys TO service_role;
