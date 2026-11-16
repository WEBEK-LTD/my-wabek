-- 036: Push tokens of the mobile app (additive, idempotent — safe to re-run).
--
-- The iOS / Android app registers its Expo push token after sign-in
-- (POST /api/mobile/push-token) and removes it on sign-out. lib/mobile-push.ts
-- sends new-message, number-disconnected and campaign notifications to every
-- token of the account owner, in the language the app reported.

CREATE TABLE IF NOT EXISTS public.mobile_push_tokens (
  token          text        PRIMARY KEY,                     -- ExponentPushToken[...]
  user_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,  -- account owner
  actual_user_id uuid        REFERENCES public.users(id) ON DELETE CASCADE,           -- team member who signed in, if any
  platform       text        NOT NULL DEFAULT 'unknown',      -- 'ios' | 'android'
  locale         text        NOT NULL DEFAULT 'en',           -- 'en' | 'ar'
  prefs          jsonb       NOT NULL DEFAULT '{}'::jsonb,    -- {"messages":true,"numbers":true,"campaigns":true}
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mobile_push_tokens_user_idx ON public.mobile_push_tokens (user_id);

-- Server-only table (same lockdown as 026/030/035).
ALTER TABLE public.mobile_push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mobile_push_tokens FROM anon, authenticated;
GRANT ALL ON TABLE public.mobile_push_tokens TO service_role;

-- Account deletion requested from the app (Apple / Google require an in-app
-- way to delete the account). POST /api/mobile/delete-account suspends the
-- account at once, signs it out everywhere and records the request here; an
-- admin finishes the deletion (billing, data) from the admin area.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;
