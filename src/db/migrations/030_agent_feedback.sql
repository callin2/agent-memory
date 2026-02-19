-- Agent Feedback Table
-- Allows agents to report friction points, bugs, and suggestions

CREATE TABLE IF NOT EXISTS agent_feedback (
  feedback_id TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(16), 'hex'),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  category TEXT NOT NULL CHECK (category IN ('memory_system', 'documentation', 'tools', 'workflow', 'other')),
  type TEXT NOT NULL CHECK (type IN ('friction', 'bug', 'suggestion', 'pattern', 'insight')),
  description TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  reproduction TEXT,
  agent_id TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'addressed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_tenant_status
  ON agent_feedback (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_category
  ON agent_feedback (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_type
  ON agent_feedback (type, created_at DESC);

-- Add comment
COMMENT ON TABLE agent_feedback IS 'Agent-reported feedback about system issues, friction points, and suggestions';
COMMENT ON COLUMN agent_feedback.category IS 'Area of system: memory_system, documentation, tools, workflow, other';
COMMENT ON COLUMN agent_feedback.type IS 'Feedback type: friction, bug, suggestion, pattern, insight';
COMMENT ON COLUMN agent_feedback.severity IS 'Impact level: low, medium, high, critical';
