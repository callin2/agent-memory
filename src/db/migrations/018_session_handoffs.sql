-- Session Handoffs Table
-- Enables MCP tools for agent to remember across sessions
CREATE TABLE IF NOT EXISTS session_handoffs (
    handoff_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    session_id TEXT NOT NULL,
    with_whom TEXT NOT NULL,

    -- What happened in the session
    experienced TEXT,
    noticed TEXT,
    learned TEXT,
    story TEXT,

    -- Identity evolution
    becoming TEXT,

    -- What to remember next time
    remember TEXT,

    -- Metadata
    significance NUMERIC(3, 2) DEFAULT 0.5 CHECK (significance >= 0 AND significance <= 1),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_session_handoffs_tenant_created ON session_handoffs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_handoffs_with_whom ON session_handoffs(tenant_id, with_whom, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_handoffs_session ON session_handoffs(session_id);

-- Add comment
COMMENT ON TABLE session_handoffs IS 'Agent session handoffs for cross-session memory via MCP tools';
