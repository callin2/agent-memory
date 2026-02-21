-- Migration 036: Add node_id columns to all content tables
-- Purpose: Enable unified graph-based relationships between any content types
--
-- This adds a universal 'node_id' column to all content tables, allowing
-- the edges table to reference any type of content (knowledge notes,
-- feedback, capsules, semantic memory, tasks) using a single identifier.
--
-- Note: handoffs table is in a separate database/tenant, not in agent_memory_dev

-- ============================================
-- Add node_id column to all content tables
-- ============================================

-- Knowledge notes table (uses 'id' as primary key)
ALTER TABLE knowledge_notes ADD COLUMN IF NOT EXISTS node_id TEXT UNIQUE;

-- Agent feedback table (uses 'feedback_id' as primary key)
ALTER TABLE agent_feedback ADD COLUMN IF NOT EXISTS node_id TEXT UNIQUE;

-- Capsules table (uses 'capsule_id' as primary key)
ALTER TABLE capsules ADD COLUMN IF NOT EXISTS node_id TEXT UNIQUE;

-- Semantic memory table (uses 'semantic_id' as primary key)
ALTER TABLE semantic_memory ADD COLUMN IF NOT EXISTS node_id TEXT UNIQUE;

-- Tasks table (uses 'task_id' as primary key)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS node_id TEXT UNIQUE;

-- ============================================
-- Backfill existing data: node_id = existing ID
-- ============================================

-- Backfill knowledge_notes (uses 'id' column)
UPDATE knowledge_notes
SET node_id = id
WHERE node_id IS NULL;

-- Backfill agent_feedback (uses 'feedback_id' column)
UPDATE agent_feedback
SET node_id = feedback_id
WHERE node_id IS NULL;

-- Backfill capsules (uses 'capsule_id' column)
UPDATE capsules
SET node_id = capsule_id
WHERE node_id IS NULL;

-- Backfill semantic_memory (uses 'semantic_id' column)
UPDATE semantic_memory
SET node_id = semantic_id
WHERE node_id IS NULL;

-- Backfill tasks (uses 'task_id' column)
UPDATE tasks
SET node_id = task_id
WHERE node_id IS NULL;

-- ============================================
-- Add NOT NULL constraints after backfill
-- ============================================

-- Skip handoffs (not in this database)
ALTER TABLE knowledge_notes ALTER COLUMN node_id SET NOT NULL;
ALTER TABLE agent_feedback ALTER COLUMN node_id SET NOT NULL;
ALTER TABLE capsules ALTER COLUMN node_id SET NOT NULL;
ALTER TABLE semantic_memory ALTER COLUMN node_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN node_id SET NOT NULL;

-- ============================================
-- Create unique indexes for node_id lookups
-- ============================================

-- Skip handoffs (not in this database)
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_notes_node_id
ON knowledge_notes(node_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_node_id
ON agent_feedback(node_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_capsules_node_id
ON capsules(node_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_semantic_memory_node_id
ON semantic_memory(node_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_node_id
ON tasks(node_id);

-- ============================================
-- Verification queries (for testing)
-- ============================================

-- Verify all knowledge_notes have node_id
-- SELECT COUNT(*) AS notes_total, COUNT(node_id) AS notes_with_node_id FROM knowledge_notes;

-- Verify all agent_feedback have node_id
-- SELECT COUNT(*) AS feedback_total, COUNT(node_id) AS feedback_with_node_id FROM agent_feedback;

-- Verify all capsules have node_id
-- SELECT COUNT(*) AS capsules_total, COUNT(node_id) AS capsules_with_node_id FROM capsules;

-- Verify all semantic_memory have node_id
-- SELECT COUNT(*) AS semantic_total, COUNT(node_id) AS semantic_with_node_id FROM semantic_memory;

-- Verify all tasks have node_id
-- SELECT COUNT(*) AS tasks_total, COUNT(node_id) AS tasks_with_node_id FROM tasks;
