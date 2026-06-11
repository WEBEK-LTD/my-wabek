-- Fix messages default status
-- Outbound messages should start as 'sent' not 'pending'
-- The 'pending' status was causing confusion in the UI
ALTER TABLE messages ALTER COLUMN status SET DEFAULT 'sent';

-- Update any old pending outbound messages to sent
UPDATE messages SET status = 'sent' WHERE status = 'pending' AND direction = 'outbound';
