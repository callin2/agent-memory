-- Migration: Task Management Enhancement
-- Description: Adds dependencies, scheduling, progress tracking to tasks table
-- Author: Thread (agent)
-- Created: 2025-02-21

-- ============================================================================
-- DEPENDENCY TRACKING
-- ============================================================================

-- blocked_by: array of task_ids that must complete before this task can start
-- blocking: array of task_ids that are blocked by this task
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS blocked_by TEXT[] DEFAULT '{}'::TEXT[],
ADD COLUMN IF NOT EXISTS blocking TEXT[] DEFAULT '{}'::TEXT[];

-- ============================================================================
-- SCHEDULING
-- ============================================================================

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS time_estimate_hours NUMERIC,
ADD COLUMN IF NOT EXISTS time_actual_hours NUMERIC;

-- ============================================================================
-- PROGRESS TRACKING
-- ============================================================================

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0
  CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
ADD COLUMN IF NOT EXISTS assignee_id TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add constraint for priority values
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE tasks
ADD CONSTRAINT tasks_priority_check
CHECK (priority IN ('critical', 'high', 'medium', 'low'));

-- ============================================================================
-- STATUS EXPANSION
-- ============================================================================

-- Drop old status check constraint
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add new status values: backlog, review, blocked
ALTER TABLE tasks
ADD CONSTRAINT tasks_status_check
CHECK (status IN ('backlog', 'open', 'doing', 'review', 'blocked', 'done'));

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite index for project (via refs or query filter) and status queries
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status
ON tasks(tenant_id, status)
WHERE status != 'done';

-- Index for priority sorting
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_priority
ON tasks(tenant_id, priority DESC, ts DESC)
WHERE status != 'done';

-- Index for due date queries (find overdue tasks)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date
ON tasks(tenant_id, due_date)
WHERE due_date IS NOT NULL AND status != 'done';

-- GIN index for blocked_by array queries (dependency traversal)
CREATE INDEX IF NOT EXISTS idx_tasks_blocked_by
ON tasks USING GIN (blocked_by)
WHERE blocked_by != '{}'::TEXT[];

-- Composite index for project/task listing with filters
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_project_status
ON tasks(tenant_id, status, due_date)
WHERE due_date IS NOT NULL;

-- ============================================================================
-- HELPER FUNCTION: Calculate Project Progress
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_project_progress(p_tenant_id TEXT, p_project_id TEXT)
RETURNS TABLE (
  total_tasks BIGINT,
  completed_tasks BIGINT,
  in_progress_tasks BIGINT,
  blocked_tasks BIGINT,
  backlog_tasks BIGINT,
  progress_percentage NUMERIC,
  overdue_tasks BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'done')::BIGINT AS completed_tasks,
    COUNT(*) FILTER (WHERE status IN ('open', 'doing', 'review'))::BIGINT AS in_progress_tasks,
    COUNT(*) FILTER (WHERE status = 'blocked')::BIGINT AS blocked_tasks,
    COUNT(*) FILTER (WHERE status = 'backlog')::BIGINT AS backlog_tasks,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND(COUNT(*) FILTER (WHERE status = 'done')::NUMERIC / COUNT(*)::NUMERIC * 100, 2)
      ELSE 0
    END AS progress_percentage,
    COUNT(*) FILTER (
      WHERE due_date < NOW() AND status NOT IN ('done', 'cancelled')
    )::BIGINT AS overdue_tasks
  FROM tasks
  WHERE tenant_id = p_tenant_id
    AND p_project_id = ANY(refs);  -- refs contains project identifiers
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- TRIGGER: Auto-update blocking arrays and completed_at
-- ============================================================================

-- Function to update blocking arrays when blocked_by changes
CREATE OR REPLACE FUNCTION update_blocking_arrays()
RETURNS TRIGGER AS $$
DECLARE
  old_blocked_by TEXT[];
  new_blocked_by TEXT[];
  task_to_update TEXT;
BEGIN
  -- Handle blocked_by changes
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    new_blocked_by := COALESCE(NEW.blocked_by, '{}'::TEXT[]);
    old_blocked_by := COALESCE(OLD.blocked_by, '{}'::TEXT[]);

    -- Remove this task from old blocking tasks' blocking arrays
    IF TG_OP = 'UPDATE' THEN
      FOR task_to_update IN SELECT unnest(old_blocked_by)
      WHERE task_to_update IS NOT NULL
      LOOP
        UPDATE tasks
        SET blocking = array_remove(blocking, NEW.task_id)
        WHERE task_id = task_to_update;
      END LOOP;
    END IF;

    -- Add this task to new blocking tasks' blocking arrays
    FOR task_to_update IN SELECT unnest(new_blocked_by)
    WHERE task_to_update IS NOT NULL
    LOOP
      UPDATE tasks
      SET blocking = array_append(
        array_remove(blocking, NEW.task_id),
        NEW.task_id
      )
      WHERE task_id = task_to_update
        AND NOT (NEW.task_id = ANY(blocking));
    END LOOP;

  END IF;

  -- Handle deletion: remove this task from all blocking arrays
  IF TG_OP = 'DELETE' THEN
    FOR task_to_update IN SELECT unnest(OLD.blocking)
    WHERE task_to_update IS NOT NULL
    LOOP
      UPDATE tasks
      SET blocked_by = array_remove(blocked_by, OLD.task_id)
      WHERE task_id = task_to_update;
    END LOOP;
  END IF;

  -- Return appropriate result based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS tasks_update_blocking_trigger ON tasks;
CREATE TRIGGER tasks_update_blocking_trigger
BEFORE INSERT OR UPDATE OR DELETE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_blocking_arrays();

-- Function to auto-set completed_at and update progress
CREATE OR REPLACE FUNCTION update_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set completed_at when status changes to 'done'
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    NEW.completed_at := NOW();
    NEW.progress_percentage := 100;
  END IF;

  -- Clear completed_at if status moves away from 'done'
  IF NEW.status != 'done' AND (OLD.status IS NULL OR OLD.status = 'done') THEN
    NEW.completed_at := NULL;
    IF NEW.progress_percentage = 100 THEN
      NEW.progress_percentage := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS tasks_completion_trigger ON tasks;
CREATE TRIGGER tasks_completion_trigger
BEFORE UPDATE OF status ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_task_completion();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN tasks.blocked_by IS 'Array of task_ids that must complete before this task can start. Automatically updates blocking arrays on referenced tasks via trigger.';
COMMENT ON COLUMN tasks.blocking IS 'Array of task_ids that are blocked by this task. Automatically maintained by trigger - do not update manually.';
COMMENT ON COLUMN tasks.start_date IS 'When work on this task is scheduled to begin';
COMMENT ON COLUMN tasks.due_date IS 'When this task is scheduled to be completed';
COMMENT ON COLUMN tasks.time_estimate_hours IS 'Estimated time to complete (in hours)';
COMMENT ON COLUMN tasks.time_actual_hours IS 'Actual time spent (in hours)';
COMMENT ON COLUMN tasks.priority IS 'Task priority: critical, high, medium, low';
COMMENT ON COLUMN tasks.progress_percentage IS 'Completion percentage (0-100)';
COMMENT ON COLUMN tasks.assignee_id IS 'ID of the person/agent assigned to this task';
COMMENT ON COLUMN tasks.completed_at IS 'Timestamp when task was marked as done (auto-set by trigger)';
COMMENT ON FUNCTION calculate_project_progress IS 'Calculate task statistics and progress percentage for a project. Filters by tenant_id and checks if project_id is in refs array.';
