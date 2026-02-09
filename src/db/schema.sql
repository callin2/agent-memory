-- Agent Memory System v2.0 - PostgreSQL Schema
-- This file creates all tables, indexes, and extensions needed

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Ground truth events (append-only logically)
CREATE TABLE IF NOT EXISTS events (
  event_id     TEXT PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id    TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  channel      TEXT NOT NULL CHECK (channel IN ('private', 'public', 'team', 'agent')),
  actor_type   TEXT NOT NULL CHECK (actor_type IN ('human', 'agent', 'tool')),
  actor_id     TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('message', 'tool_call', 'tool_result', 'decision', 'task_update', 'artifact')),
  sensitivity  TEXT NOT NULL DEFAULT 'none' CHECK (sensitivity IN ('none', 'low', 'high', 'secret')),
  tags         TEXT[] NOT NULL DEFAULT '{}',
  content      JSONB NOT NULL,
  refs         TEXT[] NOT NULL DEFAULT '{}'
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_events_tenant_ts
  ON events (tenant_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_events_tenant_session_ts
  ON events (tenant_id, session_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_events_tenant_channel
  ON events (tenant_id, channel);

CREATE INDEX IF NOT EXISTS idx_events_tags_gin
  ON events USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_events_content_gin
  ON events USING GIN (content);

-- Retrieval units (excerpts / normalized text)
CREATE TABLE IF NOT EXISTS chunks (
  chunk_id     TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  event_id     TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  ts           TIMESTAMPTZ NOT NULL,
  kind         TEXT NOT NULL,
  channel      TEXT NOT NULL,
  sensitivity  TEXT NOT NULL DEFAULT 'none' CHECK (sensitivity IN ('none', 'low', 'high', 'secret')),
  tags         TEXT[] NOT NULL DEFAULT '{}',
  token_est    INT NOT NULL,
  importance   REAL NOT NULL DEFAULT 0.0,
  text         TEXT NOT NULL,
  tsv          TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);

-- Indexes for chunks
CREATE INDEX IF NOT EXISTS idx_chunks_tenant_ts
  ON chunks (tenant_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_chunks_tenant_kind
  ON chunks (tenant_id, kind);

CREATE INDEX IF NOT EXISTS idx_chunks_tenant_sensitivity
  ON chunks (tenant_id, sensitivity);

CREATE INDEX IF NOT EXISTS idx_chunks_importance
  ON chunks (importance DESC, ts DESC);

CREATE INDEX IF NOT EXISTS idx_chunks_tsv_gin
  ON chunks USING GIN (tsv);

CREATE INDEX IF NOT EXISTS idx_chunks_tags_gin
  ON chunks USING GIN (tags);

-- Decisions (first-class, traceable)
CREATE TABLE IF NOT EXISTS decisions (
  decision_id   TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL CHECK (status IN ('active', 'superseded')),
  scope         TEXT NOT NULL CHECK (scope IN ('project', 'user', 'global')),
  decision      TEXT NOT NULL,
  rationale     TEXT[] NOT NULL DEFAULT '{}',
  constraints   TEXT[] NOT NULL DEFAULT '{}',
  alternatives  TEXT[] NOT NULL DEFAULT '{}',
  consequences  TEXT[] NOT NULL DEFAULT '{}',
  refs          TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_decisions_tenant_status_ts
  ON decisions (tenant_id, status, ts DESC);

CREATE INDEX IF NOT EXISTS idx_decisions_tenant_scope
  ON decisions (tenant_id, scope);

-- Tasks (optional but useful for agentic dev)
CREATE TABLE IF NOT EXISTS tasks (
  task_id     TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      TEXT NOT NULL CHECK (status IN ('open', 'doing', 'done')),
  title       TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  refs        TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_ts
  ON tasks (tenant_id, status, ts DESC);

-- Artifacts: store large tool outputs simply (bytea)
CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id  TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind         TEXT NOT NULL CHECK (kind IN ('tool_output', 'blob')),
  bytes        BYTEA,
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  refs         TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_ts
  ON artifacts (tenant_id, ts DESC);

-- Rules/Identity views (can be stored as JSONB for simplicity)
CREATE TABLE IF NOT EXISTS rules (
  rule_id      TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  scope        TEXT NOT NULL CHECK (scope IN ('org', 'project', 'user')),
  channel      TEXT NOT NULL CHECK (channel IN ('private', 'public', 'team', 'agent')),
  priority     INT NOT NULL DEFAULT 0,
  content      TEXT NOT NULL,
  token_est    INT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rules_tenant_scope_priority
  ON rules (tenant_id, scope, priority DESC);

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  user_id      TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  username     TEXT NOT NULL,
  email        TEXT,
  password_hash TEXT NOT NULL,
  roles        TEXT[] NOT NULL DEFAULT '{user}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login   TIMESTAMPTZ,
  UNIQUE(tenant_id, username)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

COMMENT ON TABLE events IS 'Append-only ground truth log';
COMMENT ON TABLE chunks IS 'Retrieval units with FTS indexing';
COMMENT ON TABLE decisions IS 'First-class decisions with traceability';
COMMENT ON TABLE tasks IS 'Operational task state';
COMMENT ON TABLE artifacts IS 'Large binary storage for tool outputs';
COMMENT ON TABLE rules IS 'Identity and rule views for ACB assembly';
COMMENT ON TABLE users IS 'User accounts for authentication';
