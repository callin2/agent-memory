-- Audit logs table for security event tracking
-- This table stores all security-relevant events for compliance and forensics

CREATE TABLE IF NOT EXISTS audit_logs (
  log_id        TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  user_id       TEXT,

  -- Event details
  event_type    TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  action        TEXT NOT NULL,
  outcome       TEXT NOT NULL, -- success, failure, partial

  -- Request context
  ip_address    INET,
  user_agent    TEXT,

  -- Additional details
  details       JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_audit_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE SET NULL
);

-- Index for tenant-level queries (most common)
CREATE INDEX idx_audit_logs_tenant_created
  ON audit_logs (tenant_id, created_at DESC);

-- Index for user activity queries
CREATE INDEX idx_audit_logs_user_created
  ON audit_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Index for event type filtering
CREATE INDEX idx_audit_logs_event_type
  ON audit_logs (event_type, created_at DESC);

-- Index for resource tracking
CREATE INDEX idx_audit_logs_resource
  ON audit_logs (resource_type, resource_id, created_at DESC)
  WHERE resource_type IS NOT NULL;

-- Index for outcome filtering (success/failure analysis)
CREATE INDEX idx_audit_logs_outcome
  ON audit_logs (outcome, created_at DESC);

-- Index for IP-based security analysis
CREATE INDEX idx_audit_logs_ip
  ON audit_logs (ip_address, created_at DESC)
  WHERE ip_address IS NOT NULL;

-- GIN index for JSONB details searching
CREATE INDEX idx_audit_logs_details_gin
  ON audit_logs USING GIN (details);

COMMENT ON TABLE audit_logs IS 'Security event logging for compliance and forensics';
COMMENT ON COLUMN audit_logs.event_type IS 'Event type (auth, api_key, session, data_access, etc.)';
COMMENT ON COLUMN audit_logs.outcome IS 'Event outcome (success, failure, partial)';
COMMENT ON COLUMN audit_logs.details IS 'JSONB with additional context, error messages, etc.';

-- Create a partitioned version for high-volume systems (optional, commented out)
-- Uncomment if expecting millions of log entries per month
/*
CREATE TABLE audit_logs_partitioned (LIKE audit_logs INCLUDING ALL)
  PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
*/
