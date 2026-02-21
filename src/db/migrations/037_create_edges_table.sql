-- Migration 037: Create edges table and helper functions
-- Purpose: Enable graph-based relationships between any content types
--
-- This creates the 'edges' table which stores typed relationships between nodes,
-- along with helper functions for graph traversal and validation.

-- ============================================
-- Create edges table
-- ============================================

CREATE TABLE IF NOT EXISTS edges (
  edge_id TEXT PRIMARY KEY,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  type TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  tenant_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraint: Only allowed relationship types
  CONSTRAINT valid_edge_type
    CHECK (type IN (
      'parent_of',      -- Hierarchical: parent contains child
      'child_of',       -- Hierarchical: child belongs to parent
      'references',     -- Cross-reference: one item references another
      'created_by',     -- Attribution: item was created by agent/task
      'related_to',     -- Loose association: items are related
      'depends_on'      -- Dependency: one item depends on another
    ))
);

-- ============================================
-- Create indexes for fast graph traversal
-- ============================================

-- Index for finding outgoing edges from a node
CREATE INDEX IF NOT EXISTS idx_edges_from
ON edges(from_node_id, tenant_id);

-- Index for finding incoming edges to a node
CREATE INDEX IF NOT EXISTS idx_edges_to
ON edges(to_node_id, tenant_id);

-- Index for finding edges by type from a node
CREATE INDEX IF NOT EXISTS idx_edges_from_type
ON edges(from_node_id, type, tenant_id);

-- Index for finding edges by type to a node
CREATE INDEX IF NOT EXISTS idx_edges_to_type
ON edges(to_node_id, type, tenant_id);

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_edges_tenant
ON edges(tenant_id);

-- Composite index for full graph queries
CREATE INDEX IF NOT EXISTS idx_edges_graph
ON edges(from_node_id, to_node_id, type, tenant_id);

-- GIN index for properties JSONB queries (e.g., find edges with status='doing')
CREATE INDEX IF NOT EXISTS idx_edges_properties
ON edges USING GIN (properties);

-- ============================================
-- Create trigger for updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_edges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER edges_update_timestamp
BEFORE UPDATE ON edges
FOR EACH ROW
EXECUTE FUNCTION update_edges_updated_at();

-- ============================================
-- Helper function: Resolve node (find content by node_id)
-- ============================================

-- This function queries all tables to find a node by its node_id.
-- It returns the node_type (e.g., 'knowledge_note', 'feedback') and the content as JSONB.
-- This enables the edges table to reference any content type without foreign keys.
--
-- Note: handoffs are in a separate database/tenant, not included here

CREATE OR REPLACE FUNCTION resolve_node(p_node_id TEXT, p_tenant_id TEXT DEFAULT 'default')
RETURNS TABLE(
  node_type TEXT,
  node_id TEXT,
  tenant_id TEXT,
  content JSONB
) AS $$
DECLARE
  v_found BOOLEAN := FALSE;
BEGIN
  -- Try knowledge_notes table
  IF NOT v_found THEN
    RETURN QUERY
    SELECT
      'knowledge_note'::TEXT AS node_type,
      kn.node_id::TEXT,
      kn.tenant_id::TEXT,
      to_jsonb(kn) AS content
    FROM knowledge_notes kn
    WHERE kn.node_id = p_node_id
      AND (p_tenant_id IS NULL OR kn.tenant_id = p_tenant_id);

    IF FOUND THEN
      v_found := TRUE;
    END IF;
  END IF;

  -- Try agent_feedback table
  IF NOT v_found THEN
    RETURN QUERY
    SELECT
      'feedback'::TEXT AS node_type,
      af.node_id::TEXT,
      af.tenant_id::TEXT,
      to_jsonb(af) AS content
    FROM agent_feedback af
    WHERE af.node_id = p_node_id
      AND (p_tenant_id IS NULL OR af.tenant_id = p_tenant_id);

    IF FOUND THEN
      v_found := TRUE;
    END IF;
  END IF;

  -- Try capsules table
  IF NOT v_found THEN
    RETURN QUERY
    SELECT
      'capsule'::TEXT AS node_type,
      c.node_id,
      c.tenant_id,
      to_jsonb(c) AS content
    FROM capsules c
    WHERE c.node_id = p_node_id
      AND (c.tenant_id IS NULL OR c.tenant_id = p_tenant_id);

    IF FOUND THEN
      v_found := TRUE;
    END IF;
  END IF;

  -- Try semantic_memory table
  IF NOT v_found THEN
    RETURN QUERY
    SELECT
      'semantic_memory'::TEXT AS node_type,
      sm.node_id,
      sm.tenant_id,
      to_jsonb(sm) AS content
    FROM semantic_memory sm
    WHERE sm.node_id = p_node_id
      AND (p_tenant_id IS NULL OR sm.tenant_id = p_tenant_id);

    IF FOUND THEN
      v_found := TRUE;
    END IF;
  END IF;

  -- Try tasks table
  IF NOT v_found THEN
    RETURN QUERY
    SELECT
      'task'::TEXT AS node_type,
      t.node_id,
      t.tenant_id,
      to_jsonb(t) AS content
    FROM tasks t
    WHERE t.node_id = p_node_id
      AND (p_tenant_id IS NULL OR t.tenant_id = p_tenant_id);

    IF FOUND THEN
      v_found := TRUE;
    END IF;
  END IF;

  -- If not found in any table, return empty result set
  RETURN;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Helper function: Detect circular dependencies
-- ============================================

-- This function detects if adding a 'depends_on' edge would create a circular dependency.
-- Uses recursive CTE to traverse the dependency chain up to 10 levels deep.

CREATE OR REPLACE FUNCTION detect_dependency_cycle(p_from_id TEXT, p_to_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_cycle BOOLEAN := FALSE;
BEGIN
  WITH RECURSIVE dep_chain AS (
    -- Start from the node we're depending on
    SELECT e.to_node_id AS node_id, 1 AS depth
    FROM edges e
    WHERE e.from_node_id = p_to_id
      AND e.type = 'depends_on'

    UNION ALL

    -- Follow all depends_on edges
    SELECT e.to_node_id, dc.depth + 1
    FROM edges e
    JOIN dep_chain dc ON e.from_node_id = dc.node_id
    WHERE e.type = 'depends_on'
      AND dc.depth < 10  -- Prevent infinite loops
  )
  SELECT EXISTS(
    SELECT 1 FROM dep_chain WHERE node_id = p_from_id
  ) INTO v_has_cycle;

  RETURN v_has_cycle;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Helper function: Cleanup orphaned edges
-- ============================================

-- This function is called by triggers to delete edges when a node is deleted.
-- It removes all edges that reference the deleted node (either as from or to).

CREATE OR REPLACE FUNCTION cleanup_orphaned_edges()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM edges
  WHERE from_node_id = OLD.node_id
     OR to_node_id = OLD.node_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Add cleanup triggers to all content tables
-- ============================================

-- Note: handoffs table is in a separate database/tenant

-- Knowledge notes
DROP TRIGGER IF EXISTS knowledge_note_cleanup_edges ON knowledge_notes;
CREATE TRIGGER knowledge_note_cleanup_edges
BEFORE DELETE ON knowledge_notes
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_edges();

-- Agent feedback
DROP TRIGGER IF EXISTS feedback_cleanup_edges ON agent_feedback;
CREATE TRIGGER feedback_cleanup_edges
BEFORE DELETE ON agent_feedback
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_edges();

-- Capsules
DROP TRIGGER IF EXISTS capsule_cleanup_edges ON capsules;
CREATE TRIGGER capsule_cleanup_edges
BEFORE DELETE ON capsules
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_edges();

-- Semantic memory
DROP TRIGGER IF EXISTS semantic_memory_cleanup_edges ON semantic_memory;
CREATE TRIGGER semantic_memory_cleanup_edges
BEFORE DELETE ON semantic_memory
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_edges();

-- Tasks
DROP TRIGGER IF EXISTS task_cleanup_edges ON tasks;
CREATE TRIGGER task_cleanup_edges
BEFORE DELETE ON tasks
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_edges();

-- ============================================
-- Verification queries (for testing)
-- ============================================

-- Test resolve_node function:
-- SELECT * FROM resolve_node('sh_abc123...', 'default');

-- Test detect_dependency_cycle function:
-- SELECT detect_dependency_cycle('node_a', 'node_b');

-- View all edge types:
-- SELECT DISTINCT type FROM edges;

-- Count edges by type:
-- SELECT type, COUNT(*) FROM edges GROUP BY type;

-- Find orphaned nodes (nodes with no edges):
-- This query would need to be run manually for specific node types
