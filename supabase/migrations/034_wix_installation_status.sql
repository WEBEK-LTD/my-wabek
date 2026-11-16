-- 034: Wix installation lifecycle (additive, idempotent — safe to re-run).
--
--  * wix_installations.status     — 'active' | 'removed'. Set to 'removed' by
--    the App Removed webhook (/api/wix/billing?event=app_removed); the order
--    webhook (/api/wix/webhook) sends nothing for a removed site. Back to
--    'active' on reinstall / relink (lib/wix-auth reactivateWixInstallation).
--  * wix_installations.removed_at — when the app was removed (NULL = installed).

ALTER TABLE public.wix_installations ADD COLUMN IF NOT EXISTS status     text DEFAULT 'active';
ALTER TABLE public.wix_installations ADD COLUMN IF NOT EXISTS removed_at timestamptz;

UPDATE public.wix_installations SET status = 'active' WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_wix_installations_status ON public.wix_installations(status);
