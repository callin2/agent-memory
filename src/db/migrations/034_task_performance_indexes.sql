-- Migration: Task Performance Indexes
-- Description: Add missing indexes for assignee and project queries
-- Author: Thread (agent)
-- Created: 2025-02-21

-- ============================================================================
-- MISSING INDEXES FROM EXPERT REVIEW
-- ============================================================================

-- Index for assignee queries (filtering tasks by assignee)
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assignee
ON tasks(tenant_id, assignee_id, priority DESC)
WHERE assignee_id IS NOT NULL AND status != 'done';

-- Index for project queries (via refs array)
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_project_refs
ON tasks(tenant_id, refs)
WHERE refs != '{}'::TEXT[];

-- Index for start_date queries (task scheduling)
CREATE INDEX IF NOT EXISTS idx_tasks_start_date
ON tasks(tenant_id, start_date)
WHERE start_date IS NOT NULL AND status != 'done';

-- Composite index for assignee + status combination
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assignee_status
ON tasks(tenant_id, assignee_id, status, priority DESC)
WHERE assignee_id IS NOT NULL;

-- Composite index for project + status + priority
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_project_status_priority
ON tasks(tenant_id, refs, status, priority DESC)
WHERE refs != '{}'::TEXT[];

-- Add comments for documentation
COMMENT ON INDEX idx_tasks_tenant_assignee IS 'Optimizes queries filtering tasks by assignee';
COMMENT ON INDEX idx_tasks_tenant_project_refs IS 'Optimizes queries filtering by project (via refs array)';
COMMENT ON INDEX idx_tasks_start_date IS 'Optimizes queries for scheduled tasks';
COMMENT ON INDEX idx_tasks_tenant_assignee_status IS 'Optimizes assignee task lists with status filtering';
COMMENT ON INDEX idx_tasks_tenant_project_status_priority IS 'Optimizes project task lists with sorting';
