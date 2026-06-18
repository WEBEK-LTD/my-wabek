-- Team members (sub-accounts) should see their owner's data.
-- sub_account_of stores the owner's user_id so APIs can use it
-- to filter data (instances, contacts, messages, etc.).

ALTER TABLE users ADD COLUMN IF NOT EXISTS sub_account_of UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_sub_account_of ON users(sub_account_of) WHERE sub_account_of IS NOT NULL;
