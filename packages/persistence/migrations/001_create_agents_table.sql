-- Create agents table for Supabase/PostgreSQL
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  auth_type TEXT NOT NULL,
  auth_payload TEXT NOT NULL,
  tools_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated BOOLEAN DEFAULT FALSE,
  last_validation_error TEXT,
  last_validated_at TIMESTAMPTZ
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at DESC);

