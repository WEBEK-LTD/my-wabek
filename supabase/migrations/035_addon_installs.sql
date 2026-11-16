-- 035: Add-on usage (additive, idempotent — safe to re-run).
--
-- The WordPress/WooCommerce plugin (>= 1.1.1) and the WHMCS addon (>= 4.1.1)
-- send `X-WABEK-Client: wordpress/<version>` / `whmcs/<version>` (and the site
-- host in `X-WABEK-Site`) on every API call. lib/addon-usage.ts records the
-- latest version and last_seen per account + client, at most once per hour,
-- for the admin "Add-ons" page (/admin/addons).

CREATE TABLE IF NOT EXISTS public.addon_installs (
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client     text        NOT NULL,          -- 'wordpress' | 'whmcs'
  version    text        NOT NULL,
  site       text,                          -- host name, when the add-on sends it
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client)
);

CREATE INDEX IF NOT EXISTS addon_installs_client_last_seen_idx
  ON public.addon_installs (client, last_seen DESC);

-- Same lockdown as 026/030/031: server-only table.
ALTER TABLE public.addon_installs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.addon_installs FROM anon, authenticated;
GRANT ALL ON TABLE public.addon_installs TO service_role;
