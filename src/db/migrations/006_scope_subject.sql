-- Migration 006: Scope + Subject Framework
-- Adds scope, subject_type, subject_id, project_id columns to events, chunks, decisions, tasks
-- This enables scoped memory queries by session, user, project, or policy

-- Add scope+subject columns to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS scope TEXT CHECK (scope IN ('session', 'user', 'project', 'policy', 'global')),
  ADD COLUMN IF NOT EXISTS subject_type TEXT,
  ADD COLUMN IF NOT EXISTS subject_id TEXT,
  ADD COLUMN IF NOT EXISTS project_id TEXT;

-- Add scope+subject columns to chunks table
ALTER TABLE chunks
  ADD COLUMN IF NOT EXISTS scope TEXT CHECK (scope IN ('session', 'user', 'project', 'policy', 'global')),
  ADD COLUMN IF NOT EXISTS subject_type TEXT,
  ADD COLUMN IF NOT EXISTS subject_id TEXT,
  ADD COLUMN IF NOT EXISTS project_id TEXT;

-- Add scope+subject columns to decisions table
ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS scope TEXT CHECK (scope IN ('session', 'user', 'project', 'policy', 'global')),
  ADD COLUMN IF NOT EXISTS subject_type TEXT,
  ADD COLUMN IF NOT EXISTS subject_id TEXT,
  ADD COLUMN IF NOT EXISTS project_id TEXT;

-- Add scope+subject columns to tasks table
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS scope TEXT CHECK (scope IN ('session', 'user', 'project', 'policy', 'global')),
  ADD COLUMN IF NOT EXISTS subject_type TEXT,
  ADD COLUMN IF NOT EXISTS subject_id TEXT,
  ADD COLUMN IF NOT EXISTS project_id TEXT;

-- Comments for documentation
COMMENT ON COLUMN events.scope IS 'Memory scope: session, user, project, policy, or global';
COMMENT ON COLUMN events.subject_type IS 'Type of subject: user, project, etc.';
COMMENT ON COLUMN events.subject_id IS 'ID of the subject this memory is about';
COMMENT ON COLUMN events.project_id IS 'Project ID for project-scoped memory';

COMMENT ON COLUMN chunks.scope IS 'Inherited from parent event';
COMMENT ON COLUMN chunks.subject_type IS 'Inherited from parent event';
COMMENT ON COLUMN chunks.subject_id IS 'Inherited from parent event';
COMMENT ON COLUMN chunks.project_id IS 'Inherited from parent event';

COMMENT ON COLUMN decisions.scope IS 'Decision scope: project, user, or global';
COMMENT ON COLUMN decisions.subject_type IS 'Type of subject if applicable';
COMMENT ON COLUMN decisions.subject_id IS 'ID of subject if applicable';
COMMENT ON COLUMN decisions.project_id IS 'Project ID for project decisions';

COMMENT ON COLUMN tasks.scope IS 'Task scope: session, user, project, policy, or global';
COMMENT ON COLUMN tasks.subject_type IS 'Type of subject if applicable';
COMMENT ON COLUMN tasks.subject_id IS 'ID of subject if applicable';
COMMENT ON COLUMN tasks.project_id IS 'Project ID for project tasks';
