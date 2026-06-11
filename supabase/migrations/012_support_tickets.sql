-- =====================================================
-- WABEK Support Tickets System
-- Run this in: Supabase Dashboard → SQL Editor
-- =====================================================

-- Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number INTEGER NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Support messages table
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user','admin','ai')),
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see their own tickets
DROP POLICY IF EXISTS "users_own_tickets" ON support_tickets;
CREATE POLICY "users_own_tickets" ON support_tickets
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_role_tickets" ON support_tickets;
CREATE POLICY "service_role_tickets" ON support_tickets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "users_own_messages" ON support_messages;
CREATE POLICY "users_own_messages" ON support_messages
  FOR ALL USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "service_role_messages" ON support_messages;
CREATE POLICY "service_role_messages" ON support_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS support_tickets_updated ON support_tickets(updated_at DESC);
CREATE INDEX IF NOT EXISTS support_messages_ticket ON support_messages(ticket_id, created_at);

-- Add whatsapp_phone to support_tickets if not exists
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

-- Add wa_message_id to support_messages for status tracking
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS wa_message_id TEXT;
CREATE INDEX IF NOT EXISTS support_messages_wa_id ON support_messages(wa_message_id);
