-- Enable Row Level Security and lock table down to service role
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all on agents" ON agents;

CREATE POLICY "service_role_full_access" ON agents
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

