-- Migration 009: Scope + Subject Indexes
-- Creates indexes for efficient scope, subject, and project queries

-- Events indexes

-- Filter events by tenant + scope
CREATE INDEX idx_events_tenant_scope_ts
  ON events (tenant_id, scope, ts DESC)
  WHERE scope IS NOT NULL;

-- Filter events by tenant + project
CREATE INDEX idx_events_tenant_project_ts
  ON events (tenant_id, project_id, ts DESC)
  WHERE project_id IS NOT NULL;

-- Filter events by tenant + subject (composite)
CREATE INDEX idx_events_tenant_subject_ts
  ON events (tenant_id, subject_type, subject_id, ts DESC)
  WHERE subject_type IS NOT NULL AND subject_id IS NOT NULL;

-- Chunks indexes

-- Filter chunks by tenant + scope
CREATE INDEX idx_chunks_tenant_scope_ts
  ON chunks (tenant_id, scope, ts DESC)
  WHERE scope IS NOT NULL;

-- Filter chunks by tenant + project
CREATE INDEX idx_chunks_tenant_project_ts
  ON chunks (tenant_id, project_id, ts DESC)
  WHERE project_id IS NOT NULL;

-- Filter chunks by tenant + subject (composite)
CREATE INDEX idx_chunks_tenant_subject_ts
  ON chunks (tenant_id, subject_type, subject_id, ts DESC)
  WHERE subject_type IS NOT NULL AND subject_id IS NOT NULL;

-- Decisions indexes

-- Filter decisions by tenant + scope
CREATE INDEX idx_decisions_tenant_scope_project_ts
  ON decisions (tenant_id, scope, project_id, ts DESC)
  WHERE scope IS NOT NULL;

-- Filter decisions by tenant + subject
CREATE INDEX idx_decisions_tenant_subject_ts
  ON decisions (tenant_id, subject_type, subject_id, ts DESC)
  WHERE subject_type IS NOT NULL AND subject_id IS NOT NULL;

-- Tasks indexes

-- Filter tasks by tenant + scope
CREATE INDEX idx_tasks_tenant_scope_ts
  ON tasks (tenant_id, scope, ts DESC)
  WHERE scope IS NOT NULL;

-- Filter tasks by tenant + subject
CREATE INDEX idx_tasks_tenant_subject_ts
  ON tasks (tenant_id, subject_type, subject_id, ts DESC)
  WHERE subject_type IS NOT NULL AND subject_id IS NOT NULL;

-- Comments for documentation
COMMENT ON INDEX idx_events_tenant_scope_ts IS 'Partial index for scope-filtered event queries';
COMMENT ON INDEX idx_events_tenant_project_ts IS 'Partial index for project-filtered event queries';
COMMENT ON INDEX idx_events_tenant_subject_ts IS 'Partial index for subject-filtered event queries';

COMMENT ON INDEX idx_chunks_tenant_scope_ts IS 'Partial index for scope-filtered chunk queries';
COMMENT ON INDEX idx_chunks_tenant_project_ts IS 'Partial index for project-filtered chunk queries';
COMMENT ON INDEX idx_chunks_tenant_subject_ts IS 'Partial index for subject-filtered chunk queries';

COMMENT ON INDEX idx_decisions_tenant_scope_project_ts IS 'Composite index for decision queries by scope and project';
COMMENT ON INDEX idx_decisions_tenant_subject_ts IS 'Partial index for subject-filtered decision queries';

COMMENT ON INDEX idx_tasks_tenant_scope_ts IS 'Partial index for scope-filtered task queries';
COMMENT ON INDEX idx_tasks_tenant_subject_ts IS 'Partial index for subject-filtered task queries';
