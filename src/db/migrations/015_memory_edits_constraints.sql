-- Migration 015: Align memory_edits constraints with service semantics
-- This migration is now idempotent with migration 008
-- The CHECK constraint for proposed_by is already defined in 008

-- Ensure the check constraint exists (idempotent)
ALTER TABLE memory_edits
  DROP CONSTRAINT IF EXISTS memory_edits_proposed_by_check;

ALTER TABLE memory_edits
  ADD CONSTRAINT memory_edits_proposed_by_check
  CHECK (proposed_by IN ('human', 'agent'));

-- Add comment for clarity
COMMENT ON COLUMN memory_edits.proposed_by IS 'Actor type: human or agent';
COMMENT ON COLUMN memory_edits.approved_by IS 'Actor who approved the edit (may be external)';
