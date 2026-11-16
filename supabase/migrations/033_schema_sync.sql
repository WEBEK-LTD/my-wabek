-- 033: Schema sync (additive, idempotent — safe to re-run).
--
-- Columns that production already has and the code relies on, but that no
-- earlier migration defines. On production every statement is a no-op; on a
-- fresh install it makes the schema match.
--
--  * plans.max_ai_replies — monthly AI reply quota (lib/ai-engine.ts
--    checkAILimit, Admin → Plans, /api/billing/plan-features).
--    -1 = unlimited, 0 = no AI replies (the code reads NULL as 0), >0 = limit.
--    Fresh installs start at 0: set the quota per plan in Admin → Plans.
--  * contacts.ai_opted_out — the contact asked not to get AI replies
--    (lib/ai-engine.ts, /api/ai/opt-out).
--  * wix_installations.meta_site_id — Wix site id sent as `wix-site-id` when
--    calling Wix APIs (/api/wix/webhook).

ALTER TABLE public.plans             ADD COLUMN IF NOT EXISTS max_ai_replies integer DEFAULT 0;
ALTER TABLE public.contacts          ADD COLUMN IF NOT EXISTS ai_opted_out   boolean DEFAULT false;
ALTER TABLE public.wix_installations ADD COLUMN IF NOT EXISTS meta_site_id   text;
