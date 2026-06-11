-- ============================================================
-- WABEK Migration 004 - OTP Auth System + Settings
-- Run in Supabase SQL Editor
-- ============================================================

-- Add OTP/security fields to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS otp_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS otp_mode TEXT NOT NULL DEFAULT 'disabled' CHECK (otp_mode IN ('disabled', 'always', 'new_device')),
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_login_device TEXT,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- System settings table (admin controls)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Trusted devices table
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  trusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fp ON trusted_devices(device_fingerprint);

-- OTP pending verifications (for registration)
CREATE TABLE IF NOT EXISTS otp_pending (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'registration',
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_pending_user ON otp_pending(user_id);

-- Default system settings
INSERT INTO system_settings (key, value, description) VALUES
  ('otp_required_on_register', '"false"', 'Require OTP phone verification on registration'),
  ('otp_provider', '"wa_web"', 'OTP provider: wa_web or cloud_api'),
  ('otp_expiry_minutes', '10', 'OTP expiry time in minutes'),
  ('otp_max_attempts', '3', 'Max OTP verification attempts'),
  ('allow_registration', '"true"', 'Allow new user registrations'),
  ('maintenance_mode', '"false"', 'Enable maintenance mode'),
  ('default_trial_days', '14', 'Default trial period in days'),
  ('max_login_attempts', '5', 'Max failed login attempts before lockout'),
  ('lockout_minutes', '15', 'Account lockout duration in minutes'),
  ('require_strong_password', '"true"', 'Require strong passwords (8+ chars, mixed case)'),
  ('smtp_host', 'null', 'SMTP host for email sending'),
  ('smtp_port', '587', 'SMTP port'),
  ('smtp_user', 'null', 'SMTP username'),
  ('smtp_from', '"noreply@waabek.com"', 'From email address'),
  ('support_email', '"support@waabek.com"', 'Support contact email'),
  ('platform_name', '"WABEK"', 'Platform display name'),
  ('platform_logo', 'null', 'Platform logo URL')
ON CONFLICT (key) DO NOTHING;
