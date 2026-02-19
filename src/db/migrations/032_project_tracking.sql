-- Migration: Add project_path tracking for multi-project memory scoping
-- Description: Adds project_path field to key memory tables to enable scoped memories by working directory/project
-- Author: Thread (agent)
-- Created: 2025-02-19

-- Add project_path column to session_handoffs
ALTER TABLE session_handoffs
ADD COLUMN IF NOT EXISTS project_path TEXT;

-- Add project_path column to knowledge_notes
ALTER TABLE knowledge_notes
ADD COLUMN IF NOT EXISTS project_path TEXT;

-- Add project_path column to agent_feedback
ALTER TABLE agent_feedback
ADD COLUMN IF NOT EXISTS project_path TEXT;

-- Add index for project_path queries on session_handoffs
CREATE INDEX IF NOT EXISTS idx_session_handoffs_project_path
ON session_handoffs(tenant_id, project_path)
WHERE project_path IS NOT NULL;

-- Add index for project_path queries on knowledge_notes
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_project_path
ON knowledge_notes(tenant_id, project_path)
WHERE project_path IS NOT NULL;

-- Add index for project_path queries on agent_feedback
CREATE INDEX IF NOT EXISTS idx_agent_feedback_project_path
ON agent_feedback(tenant_id, project_path)
WHERE project_path IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN session_handoffs.project_path IS 'Working directory or project path (e.g., /Users/user/project-name) for scoped memory retrieval';

COMMENT ON COLUMN knowledge_notes.project_path IS 'Working directory or project path (e.g., /Users/user/project-name) for scoped knowledge retrieval';

COMMENT ON COLUMN agent_feedback.project_path IS 'Working directory or project path (e.g., /Users/user/project-name) for scoped feedback retrieval';
