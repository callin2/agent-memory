-- Sleep-Based Consolidation System
-- Inspired by human memory consolidation during sleep
-- This migration adds fields to track compressed versions of handoffs
-- and a table to track consolidation jobs

-- Add compression levels to session_handoffs
ALTER TABLE session_handoffs
  ADD COLUMN IF NOT EXISTS compression_level TEXT
    CHECK (compression_level IN ('full', 'summary', 'quick_ref', 'integrated'))
    DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS quick_ref TEXT,
  ADD COLUMN IF NOT EXISTS integrated_into TEXT,
  ADD COLUMN IF NOT EXISTS consolidated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_handoff_id TEXT REFERENCES session_handoffs(handoff_id);

-- Add index for consolidation queries
CREATE INDEX IF NOT EXISTS idx_session_handoffs_compression
  ON session_handoffs(tenant_id, compression_level, created_at DESC);

-- Consolidation jobs tracking
CREATE TABLE IF NOT EXISTS consolidation_jobs (
  job_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  job_type TEXT NOT NULL CHECK (job_type IN (
    'identity_consolidation',
    'handoff_compression',
    'decision_archival',
    'chunk_reorganization'
  )),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  items_processed INT DEFAULT 0,
  items_affected INT DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consolidation_jobs_tenant_status
  ON consolidation_jobs(tenant_id, status, started_at DESC);

-- Consolidation statistics (for tracking consolidation effectiveness)
CREATE TABLE IF NOT EXISTS consolidation_stats (
  stat_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
  compression_type TEXT NOT NULL,

  -- Before consolidation
  before_count INT DEFAULT 0,
  before_tokens INT DEFAULT 0,

  -- After consolidation
  after_count INT DEFAULT 0,
  after_tokens INT DEFAULT 0,

  -- Savings
  tokens_saved INT DEFAULT 0,
  percentage_saved NUMERIC(5, 2) DEFAULT 0.0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, stat_date, compression_type)
);

CREATE INDEX IF NOT EXISTS idx_consolidation_stats_tenant_date
  ON consolidation_stats(tenant_id, stat_date DESC);

-- Comments
COMMENT ON TABLE consolidation_jobs IS 'Track automated consolidation jobs (sleep-based memory consolidation)';
COMMENT ON TABLE consolidation_stats IS 'Track consolidation effectiveness and token savings';
COMMENT ON COLUMN session_handoffs.compression_level IS 'Compression level: full=raw, summary=500 tokens, quick_ref=100 tokens, integrated=merged into principles';
COMMENT ON COLUMN session_handoffs.summary IS 'Compressed summary (~500 tokens) for sessions older than 30 days';
COMMENT ON COLUMN session_handoffs.quick_ref IS 'Quick reference (~100 tokens) for sessions older than 90 days';
COMMENT ON COLUMN session_handoffs.integrated_into IS 'When fully integrated, references the principle or pattern this became part of';
