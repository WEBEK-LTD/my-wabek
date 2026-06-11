-- ============================================================
-- WABEK Migration 002 - WhatsApp Web Support
-- Run this in Supabase SQL Editor AFTER 001_initial.sql
-- ============================================================

-- Add instance_type and session columns to whatsapp_instances
ALTER TABLE whatsapp_instances 
  ADD COLUMN IF NOT EXISTS instance_type TEXT NOT NULL DEFAULT 'cloud_api' 
    CHECK (instance_type IN ('cloud_api', 'wa_web')),
  ADD COLUMN IF NOT EXISTS session_data JSONB,
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS battery_level INTEGER,
  ADD COLUMN IF NOT EXISTS is_phone_connected BOOLEAN DEFAULT true;

-- Index for type filtering
CREATE INDEX IF NOT EXISTS idx_instances_type ON whatsapp_instances(instance_type);
CREATE INDEX IF NOT EXISTS idx_instances_status_type ON whatsapp_instances(status, instance_type);

-- Update status check to include 'qr_pending' for WA Web
ALTER TABLE whatsapp_instances 
  DROP CONSTRAINT IF EXISTS whatsapp_instances_status_check;
ALTER TABLE whatsapp_instances 
  ADD CONSTRAINT whatsapp_instances_status_check 
  CHECK (status IN ('connected', 'disconnected', 'pending', 'banned', 'qr_pending', 'initializing'));
