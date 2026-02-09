-- Migration Rollback Scripts
-- These scripts can be used to rollback migrations 006-009 if needed

-- Rollback 009: Drop scope+subject indexes
DROP INDEX IF EXISTS idx_events_tenant_scope_ts;
DROP INDEX IF EXISTS idx_events_tenant_project_ts;
DROP INDEX IF EXISTS idx_events_tenant_subject_ts;
DROP INDEX IF EXISTS idx_chunks_tenant_scope_ts;
DROP INDEX IF EXISTS idx_chunks_tenant_project_ts;
DROP INDEX IF EXISTS idx_chunks_tenant_subject_ts;
DROP INDEX IF EXISTS idx_decisions_tenant_scope_project_ts;
DROP INDEX IF EXISTS idx_decisions_tenant_subject_ts;
DROP INDEX IF EXISTS idx_tasks_tenant_scope_ts;
DROP INDEX IF EXISTS idx_tasks_tenant_subject_ts;

-- Rollback 008: Drop memory_edits table
DROP TABLE IF EXISTS memory_edits CASCADE;

-- Rollback 007: Drop capsules table
DROP TABLE IF EXISTS capsules CASCADE;

-- Rollback 006: Remove scope+subject columns
ALTER TABLE tasks DROP COLUMN IF EXISTS project_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS subject_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS subject_type;
ALTER TABLE tasks DROP COLUMN IF EXISTS scope;

ALTER TABLE decisions DROP COLUMN IF EXISTS project_id;
ALTER TABLE decisions DROP COLUMN IF EXISTS subject_id;
ALTER TABLE decisions DROP COLUMN IF EXISTS subject_type;
ALTER TABLE decisions DROP COLUMN IF EXISTS scope;

ALTER TABLE chunks DROP COLUMN IF EXISTS project_id;
ALTER TABLE chunks DROP COLUMN IF EXISTS subject_id;
ALTER TABLE chunks DROP COLUMN IF EXISTS subject_type;
ALTER TABLE chunks DROP COLUMN IF EXISTS scope;

ALTER TABLE events DROP COLUMN IF EXISTS project_id;
ALTER TABLE events DROP COLUMN IF EXISTS subject_id;
ALTER TABLE events DROP COLUMN IF EXISTS subject_type;
ALTER TABLE events DROP COLUMN IF EXISTS scope;
