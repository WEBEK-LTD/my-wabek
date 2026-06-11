-- Enable Supabase Realtime for message status updates
-- (safe to run even if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;

-- Fix duplicate whatsapp_instances — keep only latest per id
-- The id column IS the primary key, so duplicates shouldn't exist
-- But if they do via upsert bugs, this cleans them up
DELETE FROM whatsapp_instances a
  USING whatsapp_instances b
  WHERE a.ctid < b.ctid AND a.id = b.id;

-- Ensure unique constraint on id (should already be PK but just in case)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_instances_pkey'
  ) THEN
    ALTER TABLE whatsapp_instances ADD PRIMARY KEY (id);
  END IF;
END $$;
