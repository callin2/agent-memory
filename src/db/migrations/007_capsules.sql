-- Migration 007: Capsule Transfer System
-- Creates capsules table for agent-to-agent memory sharing

CREATE TABLE IF NOT EXISTS capsules (
  capsule_id        TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  ts                TIMESTAMPTZ NOT NULL DEFAULT now(),
  scope             TEXT NOT NULL CHECK (scope IN ('session', 'user', 'project', 'policy', 'global')),
  subject_type      TEXT NOT NULL,
  subject_id        TEXT NOT NULL,
  project_id        TEXT,
  author_agent_id   TEXT NOT NULL,
  ttl_days          INT NOT NULL DEFAULT 7,
  status            TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')) DEFAULT 'active',
  audience_agent_ids TEXT[] NOT NULL,
  items             JSONB NOT NULL, -- {chunks: [], decisions: [], artifacts: []}
  risks             TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,

  -- Foreign key constraints
  CONSTRAINT fk_capsule_author
    FOREIGN KEY (author_agent_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- Indexes for capsule queries

-- Query capsules by tenant and subject
CREATE INDEX idx_capsules_tenant_subject
  ON capsules (tenant_id, subject_type, subject_id, status)
  WHERE status = 'active';

-- Query capsules by audience (for agents retrieving available capsules)
CREATE INDEX idx_capsules_audience
  ON capsules (tenant_id, status)
  WHERE status = 'active';

-- Query capsules by expiration (for TTL cleanup job)
CREATE INDEX idx_capsules_expires
  ON capsules (tenant_id, status, expires_at)
  WHERE status = 'active';

-- Index for author queries
CREATE INDEX idx_capsules_author
  ON capsules (tenant_id, author_agent_id, ts DESC);

-- Comments for documentation
COMMENT ON TABLE capsules IS 'Memory bundles for agent-to-agent sharing with TTL and audience restrictions';
COMMENT ON COLUMN capsules.capsule_id IS 'Unique capsule identifier';
COMMENT ON COLUMN capsules.tenant_id IS 'Tenant ID for isolation';
COMMENT ON COLUMN capsules.scope IS 'Scope: session, user, project, policy, or global';
COMMENT ON COLUMN capsules.subject_type IS 'Type of subject (user, project, etc.)';
COMMENT ON COLUMN capsules.subject_id IS 'ID of the subject this capsule is about';
COMMENT ON COLUMN capsules.project_id IS 'Project ID if project-scoped';
COMMENT ON COLUMN capsules.author_agent_id IS 'Agent who created the capsule';
COMMENT ON COLUMN capsules.ttl_days IS 'Time to live in days (1-365)';
COMMENT ON COLUMN capsules.status IS 'active, revoked, or expired';
COMMENT ON COLUMN capsules.audience_agent_ids IS 'List of agents who can access this capsule';
COMMENT ON COLUMN capsules.items IS 'JSONB with chunks, decisions, artifacts arrays';
COMMENT ON COLUMN capsules.risks IS 'Array of risk warnings for consumers';
COMMENT ON COLUMN capsules.expires_at IS 'Expiration timestamp (created_at + ttl_days)';
