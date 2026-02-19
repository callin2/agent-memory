-- ============================================================================
-- Migration 031: Add Embeddings to Feedback, Notes, Capsules
-- ============================================================================
-- Task: MCP Tools Redesign - Step 1
-- Priority: P0/HIGH (foundational for recall tool)
-- Effort: 4-6 hours
--
-- Problem:
-- - Only session_handoffs and semantic_memory have embeddings
-- - Can't search agent_feedback, knowledge_notes, capsules semantically
-- - recall() tool needs universal search across all memory types
--
-- Solution:
-- 1. Add embedding columns to: agent_feedback, knowledge_notes, capsules
-- 2. Create HNSW indexes for fast vector search
-- 3. Add helper functions for batch embedding generation
--
-- ============================================================================

-- Enable pgvector extension (should already be enabled from migration 028)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Add embedding column to agent_feedback
-- ============================================================================

ALTER TABLE agent_feedback
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

COMMENT ON COLUMN agent_feedback.embedding IS
  'Vector embedding for semantic similarity search. Generated from description field. Uses local Qwen3 model (1024 dimensions).';

-- HNSW index for fast vector search
CREATE INDEX IF NOT EXISTS idx_agent_feedback_embedding_hnsw
  ON agent_feedback USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX idx_agent_feedback_embedding_hnsw IS
  'HNSW index for agent feedback vector similarity search';

-- ============================================================================
-- Add embedding column to knowledge_notes
-- ============================================================================

ALTER TABLE knowledge_notes
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

COMMENT ON COLUMN knowledge_notes.embedding IS
  'Vector embedding for semantic similarity search. Generated from text field. Uses local Qwen3 model (1024 dimensions).';

-- HNSW index for fast vector search
CREATE INDEX IF NOT EXISTS idx_knowledge_notes_embedding_hnsw
  ON knowledge_notes USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX idx_knowledge_notes_embedding_hnsw IS
  'HNSW index for knowledge notes vector similarity search';

-- ============================================================================
-- Add embedding column to capsules
-- ============================================================================

ALTER TABLE capsules
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

COMMENT ON COLUMN capsules.embedding IS
  'Vector embedding for semantic similarity search. Generated from items JSONB (concatenates chunks, decisions, artifacts). Uses local Qwen3 model (1024 dimensions).';

-- HNSW index for fast vector search
CREATE INDEX IF NOT EXISTS idx_capsules_embedding_hnsw
  ON capsules USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX idx_capsules_embedding_hnsw IS
  'HNSW index for capsules vector similarity search';

-- ============================================================================
-- Helper function: Get embedding progress for all tables
-- ============================================================================

CREATE OR REPLACE FUNCTION get_embedding_progress_all(p_tenant_id TEXT DEFAULT 'default')
RETURNS TABLE (
  table_name TEXT,
  total_records INT,
  with_embeddings INT,
  without_embeddings INT,
  progress_percent FLOAT
) AS $$
BEGIN
  -- Agent feedback progress
  RETURN QUERY
  SELECT
    'agent_feedback'::TEXT,
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE embedding IS NOT NULL)::INT,
    COUNT(*) FILTER (WHERE embedding IS NULL)::INT,
    CASE
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE embedding IS NOT NULL)::FLOAT / COUNT(*) * 100)
      ELSE 0
    END
  FROM agent_feedback
  WHERE tenant_id = p_tenant_id

  UNION ALL

  -- Knowledge notes progress
  SELECT
    'knowledge_notes'::TEXT,
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE embedding IS NOT NULL)::INT,
    COUNT(*) FILTER (WHERE embedding IS NULL)::INT,
    CASE
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE embedding IS NOT NULL)::FLOAT / COUNT(*) * 100)
      ELSE 0
    END
  FROM knowledge_notes
  WHERE tenant_id = p_tenant_id

  UNION ALL

  -- Capsules progress
  SELECT
    'capsules'::TEXT,
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE embedding IS NOT NULL)::INT,
    COUNT(*) FILTER (WHERE embedding IS NULL)::INT,
    CASE
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE embedding IS NOT NULL)::FLOAT / COUNT(*) * 100)
      ELSE 0
    END
  FROM capsules
  WHERE tenant_id = p_tenant_id;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_embedding_progress_all IS
  'Check embedding generation progress across all memory types (feedback, notes, capsules)';

-- ============================================================================
-- Vector similarity search functions for each table
-- ============================================================================

-- Find similar agent feedback
CREATE OR REPLACE FUNCTION find_similar_feedback(
  p_tenant_id TEXT,
  p_embedding vector(1024),
  p_limit INT DEFAULT 5,
  p_min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  feedback_id TEXT,
  category TEXT,
  type TEXT,
  description TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    af.feedback_id,
    af.category,
    af.type,
    af.description,
    1 - (af.embedding <=> p_embedding) AS similarity,
    af.created_at
  FROM agent_feedback af
  WHERE af.tenant_id = p_tenant_id
    AND af.embedding IS NOT NULL
    AND (af.embedding <=> p_embedding) < (1 - p_min_similarity)
  ORDER BY af.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Find similar knowledge notes
CREATE OR REPLACE FUNCTION find_similar_notes(
  p_tenant_id TEXT,
  p_embedding vector(1024),
  p_limit INT DEFAULT 5,
  p_min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id TEXT,
  text TEXT,
  tags TEXT[],
  similarity FLOAT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kn.id,
    kn.text,
    kn.tags,
    1 - (kn.embedding <=> p_embedding) AS similarity,
    kn.created_at
  FROM knowledge_notes kn
  WHERE kn.tenant_id = p_tenant_id
    AND kn.embedding IS NOT NULL
    AND (kn.embedding <=> p_embedding) < (1 - p_min_similarity)
  ORDER BY kn.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Find similar capsules
CREATE OR REPLACE FUNCTION find_similar_capsules(
  p_tenant_id TEXT,
  p_embedding vector(1024),
  p_limit INT DEFAULT 5,
  p_min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  capsule_id TEXT,
  scope TEXT,
  subject_type TEXT,
  subject_id TEXT,
  items JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.capsule_id,
    c.scope,
    c.subject_type,
    c.subject_id,
    c.items,
    1 - (c.embedding <=> p_embedding) AS similarity,
    c.created_at
  FROM capsules c
  WHERE c.tenant_id = p_tenant_id
    AND c.embedding IS NOT NULL
    AND c.status = 'active'
    AND (c.embedding <=> p_embedding) < (1 - p_min_similarity)
  ORDER BY c.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Usage Examples
-- ============================================================================
--
-- 1. Check progress:
--    SELECT * FROM get_embedding_progress_all('default');
--
-- 2. Generate embeddings (via EmbeddingService):
--    - agent_feedback: use description field
--    - knowledge_notes: use text field
--    - capsules: flatten items JSONB (chunks + decisions + artifacts)
--
-- 3. Semantic search examples:
--    SELECT * FROM find_similar_feedback(
--      'default',
--      '[...query embedding...]',
--      5,
--      0.7
--    );
--
-- 4. For capsules, the text to embed should be:
--    items->>'chunks' || items->>'decisions' || items->>'artifacts'
--    (Concatenate all text fields in the JSONB)
--
-- ============================================================================
