-- Knowledge Notes Table
-- Simple, natural language observations
-- Phase 2: Post-It Capture

CREATE TABLE IF NOT EXISTS knowledge_notes (
  id VARCHAR(255) PRIMARY KEY DEFAULT ('kn_' || gen_random_uuid()),
  tenant_id VARCHAR(255) NOT NULL,

  -- Core content
  text TEXT NOT NULL,

  -- Metadata
  with_whom VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Optional tags for finding
  tags TEXT[],

  -- References
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_kn_tenant_timestamp ON knowledge_notes(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_kn_with_whom ON knowledge_notes(with_whom);
CREATE INDEX IF NOT EXISTS idx_kn_tags ON knowledge_notes USING GIN (tags);

-- Comment for documentation
COMMENT ON TABLE knowledge_notes IS 'Phase 2: Simple, natural language observations (post-it style capture)';
