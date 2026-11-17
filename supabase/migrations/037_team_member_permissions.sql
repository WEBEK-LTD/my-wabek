-- Per-section dashboard permissions for team members.
-- { "preset": "developer", "areas": { "inbox": "none", "integrations": "edit", ... } }
-- NULL = defaults of the member's role (lib/team-permissions.ts).
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS permissions JSONB;
