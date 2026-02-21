-- Migration: Circular Dependency Detection
-- Description: Add circular dependency detection for task blocked_by relationships
-- Author: Thread (agent)
-- Created: 2025-02-21

-- ============================================================================
-- CIRCULAR DEPENDENCY DETECTION FUNCTION
-- ============================================================================

-- Function to detect circular dependencies using recursive CTE
CREATE OR REPLACE FUNCTION detect_circular_dependency(
  p_task_id TEXT,
  p_blocked_by TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_cycle BOOLEAN := FALSE;
  v_cycle_path TEXT[];
BEGIN
  -- If no dependencies, no cycle possible
  IF p_blocked_by IS NULL OR array_length(p_blocked_by, 1) IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if task blocks itself (direct self-reference)
  IF p_task_id = ANY(p_blocked_by) THEN
    RETURN TRUE;
  END IF;

  -- Use recursive CTE to check for cycles
  WITH RECURSIVE dependency_chain AS (
    -- Start with the direct dependencies
    SELECT
      t.task_id,
      t.title,
      t.blocked_by,
      ARRAY[t.task_id] AS path,
      1 AS depth
    FROM tasks t
    WHERE t.task_id = ANY(p_blocked_by)
      AND t.tenant_id = (SELECT tenant_id FROM tasks WHERE task_id = p_task_id)

    UNION ALL

    -- Traverse the dependency chain
    SELECT
      t.task_id,
      t.title,
      t.blocked_by,
      dc.path || t.task_id,
      dc.depth + 1
    FROM tasks t
    JOIN dependency_chain dc ON t.task_id = ANY(dc.blocked_by)
    WHERE dc.depth < 10  -- Prevent infinite loops
      AND NOT (t.task_id = ANY(dc.path))  -- Don't revisit tasks
  )
  SELECT EXISTS(
    SELECT 1
    FROM dependency_chain
    WHERE p_task_id = ANY(path)  -- If original task appears in chain, we have a cycle
  ) INTO v_has_cycle;

  RETURN v_has_cycle;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION detect_circular_dependency IS 'Detects if adding blocked_by dependencies would create a circular dependency chain. Returns TRUE if cycle detected.';

-- ============================================================================
-- UPDATE TRIGGER TO CHECK FOR CIRCULAR DEPENDENCIES
-- ============================================================================

CREATE OR REPLACE FUNCTION update_blocking_arrays()
RETURNS TRIGGER AS $$
DECLARE
  old_blocked_by TEXT[];
  new_blocked_by TEXT[];
  task_to_update TEXT;
  task_to_check TEXT;
BEGIN
  -- Handle INSERT and UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    new_blocked_by := COALESCE(NEW.blocked_by, '{}'::TEXT[]);
    old_blocked_by := COALESCE(OLD.blocked_by, '{}'::TEXT[]);

    -- Check for circular dependencies BEFORE making changes
    IF TG_OP = 'UPDATE' AND array_length(new_blocked_by, 1) > 0 THEN
      IF detect_circular_dependency(NEW.task_id, new_blocked_by) THEN
        RAISE EXCEPTION 'Circular dependency detected for task "%": adding dependencies % would create a cycle',
          NEW.title, new_blocked_by;
      END IF;
    ELSIF TG_OP = 'INSERT' AND array_length(new_blocked_by, 1) > 0 THEN
      IF detect_circular_dependency(NEW.task_id, new_blocked_by) THEN
        RAISE EXCEPTION 'Circular dependency detected for task "%": adding dependencies % would create a cycle',
          NEW.title, new_blocked_by;
      END IF;
    END IF;

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

  -- Handle deletion: remove this task from all blocked_by arrays
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS tasks_update_blocking_trigger ON tasks;
CREATE TRIGGER tasks_update_blocking_trigger
BEFORE INSERT OR UPDATE OR DELETE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_blocking_arrays();

COMMENT ON TRIGGER tasks_update_blocking_trigger ON tasks IS 'Maintains blocking arrays and prevents circular dependencies';

-- ============================================================================
-- ADD VALIDATION CONSTRAINT FOR SELF-REFERENCE
-- ============================================================================

-- Add a check constraint to prevent self-reference in blocked_by
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_no_self_reference;

ALTER TABLE tasks
ADD CONSTRAINT tasks_no_self_reference
CHECK (task_id != ALL(blocked_by));

COMMENT ON CONSTRAINT tasks_no_self_reference ON tasks IS 'Prevents a task from blocking itself';

-- ============================================================================
-- CREATE HELPER FUNCTION TO VALIDATE DEPENDENCIES
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_task_dependencies(
  p_task_id TEXT,
  p_blocked_by TEXT[]
) RETURNS TABLE(
  is_valid BOOLEAN,
  has_cycle BOOLEAN,
  cycle_path TEXT[],
  error_message TEXT
) AS $$
BEGIN
  -- Check for self-reference
  IF p_task_id = ANY(p_blocked_by) THEN
    RETURN QUERY SELECT TRUE AS is_valid, TRUE AS has_cycle, ARRAY[p_task_id]::TEXT[] AS cycle_path,
      'Task cannot block itself'::TEXT AS error_message;
    RETURN;
  END IF;

  -- Check for circular dependencies
  IF detect_circular_dependency(p_task_id, p_blocked_by) THEN
    -- Get the cycle path for debugging
    WITH RECURSIVE cycle_path_cte AS (
      SELECT task_id, ARRAY[task_id]::TEXT[] as path, 1 as depth
      FROM tasks
      WHERE task_id = ANY(p_blocked_by)

      UNION ALL

      SELECT t.task_id, cp.path || t.task_id, cp.depth + 1
      FROM tasks t
      JOIN cycle_path_cte cp ON t.task_id = ANY(cp.blocked_by)
      WHERE cp.depth < 10
        AND NOT (t.task_id = ANY(cp.path))
    )
    SELECT FALSE AS is_valid, TRUE AS has_cycle, path AS cycle_path,
      'Circular dependency detected'::TEXT AS error_message
    FROM cycle_path_cte
    WHERE p_task_id = ANY(path)
    LIMIT 1;

    RETURN;
  END IF;

  -- All validations passed
  RETURN QUERY SELECT TRUE AS is_valid, FALSE AS has_cycle, NULL::TEXT[] AS cycle_path,
    NULL::TEXT AS error_message;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION validate_task_dependencies IS 'Validates task dependencies for self-reference and circular dependencies. Returns validation result with details.';
