-- Table: saved_accounts
-- Stores Roblox accounts with API keys
CREATE TABLE IF NOT EXISTS saved_accounts (
  id TEXT PRIMARY KEY,
  account_name TEXT NOT NULL,
  creator_type TEXT NOT NULL CHECK (creator_type IN ('user', 'group')),
  api_key_encrypted TEXT NOT NULL,
  user_id TEXT,
  group_id TEXT,
  quota TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_accounts_created_at ON saved_accounts(created_at DESC);

-- Table: upload_history
-- Stores audio upload history
CREATE TABLE IF NOT EXISTS upload_history (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL,
  file_size BIGINT,
  duration REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_history_uploaded_at ON upload_history(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_history_asset_id ON upload_history(asset_id);

-- Enable Row Level Security (optional, for production)
ALTER TABLE saved_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;

-- Policies: Allow all operations for now (adjust based on auth requirements)
CREATE POLICY "Allow all on saved_accounts" ON saved_accounts FOR ALL USING (true);
CREATE POLICY "Allow all on upload_history" ON upload_history FOR ALL USING (true);
