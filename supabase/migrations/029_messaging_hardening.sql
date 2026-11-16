-- =====================================================
-- 029 Messaging hardening (additive, idempotent, non-destructive)
--
-- 1. Inbound dedupe: unique (instance_id, wa_message_id) for inbound rows,
--    so a redelivered webhook cannot create a second row (the app then
--    skips re-running bots for it). Created ONLY if no duplicates exist —
--    nothing is deleted; otherwise a NOTICE lists what to clean up.
-- 2. Lookup index for instance-scoped status updates.
-- 3. One WABEK account per Wix store: unique wix_user_links(wix_instance_id),
--    again only if there are no existing duplicates.
-- No change to whatsapp_instances or wa_sessions.
-- =====================================================

-- 1. Inbound dedupe
DO $$
DECLARE dup_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'messages_inbound_instance_wa_id_uniq') THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO dup_count FROM (
    SELECT instance_id, wa_message_id
    FROM messages
    WHERE direction = 'inbound' AND wa_message_id IS NOT NULL
    GROUP BY instance_id, wa_message_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count = 0 THEN
    CREATE UNIQUE INDEX messages_inbound_instance_wa_id_uniq
      ON messages (instance_id, wa_message_id)
      WHERE direction = 'inbound' AND wa_message_id IS NOT NULL;
  ELSE
    RAISE NOTICE '029: % duplicate inbound (instance_id, wa_message_id) groups exist — unique index NOT created. Review with: SELECT instance_id, wa_message_id, COUNT(*) FROM messages WHERE direction = ''inbound'' AND wa_message_id IS NOT NULL GROUP BY 1,2 HAVING COUNT(*) > 1; then re-run this migration.', dup_count;
  END IF;
END $$;

-- 2. Status updates are scoped by instance
CREATE INDEX IF NOT EXISTS idx_messages_instance_wa_message_id
  ON messages (instance_id, wa_message_id)
  WHERE wa_message_id IS NOT NULL;

-- 3. A Wix store belongs to one WABEK account
DO $$
DECLARE dup_count INTEGER;
BEGIN
  IF to_regclass('public.wix_user_links') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'wix_user_links_instance_uniq') THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO dup_count FROM (
    SELECT wix_instance_id FROM wix_user_links GROUP BY wix_instance_id HAVING COUNT(*) > 1
  ) d;

  IF dup_count = 0 THEN
    CREATE UNIQUE INDEX wix_user_links_instance_uniq ON wix_user_links (wix_instance_id);
  ELSE
    RAISE NOTICE '029: % Wix stores are linked to more than one account — unique index NOT created. Review with: SELECT wix_instance_id, array_agg(user_id) FROM wix_user_links GROUP BY 1 HAVING COUNT(*) > 1; then re-run this migration.', dup_count;
  END IF;
END $$;
