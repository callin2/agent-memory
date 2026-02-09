-- Migration 011: Effective Views + SQL Queries
-- Creates effective_chunks view and SQL functions for edit-aware queries

-- Effective Chunks View
-- This view applies all approved memory edits to chunks
CREATE OR REPLACE VIEW effective_chunks AS
WITH edits_applied AS (
  SELECT
    c.chunk_id,
    c.text,
    c.importance,
    c.channel,
    c.tenant_id,
    c.scope,
    c.subject_type,
    c.subject_id,
    c.project_id,
    c.ts,
    c.tsv,
    c.sensitivity,
    c.tags,
    c.kind,
    c.event_id,
    c.token_est,
    -- Apply amend text
    COALESCE(e.patch->>'text', c.text) as effective_text,
    -- Apply attenuate importance
    CASE
      WHEN e.op = 'attenuate' AND e.patch->>'importance' IS NOT NULL
        THEN (e.patch->>'importance')::REAL
      WHEN e.op = 'attenuate' AND e.patch->>'importance_delta' IS NOT NULL
        THEN c.importance + (e.patch->>'importance_delta')::REAL
      WHEN e.op = 'amend' AND e.patch->>'importance' IS NOT NULL
        THEN (e.patch->>'importance')::REAL
      ELSE c.importance
    END as effective_importance,
    -- Check retracted
    EXISTS(
      SELECT 1 FROM memory_edits e2
      WHERE e2.target_id = c.chunk_id
        AND e2.target_type = 'chunk'
        AND e2.status = 'approved'
        AND e2.op = 'retract'
    ) as is_retracted,
    -- Check quarantined
    EXISTS(
      SELECT 1 FROM memory_edits e3
      WHERE e3.target_id = c.chunk_id
        AND e3.target_type = 'chunk'
        AND e3.status = 'approved'
        AND e3.op = 'quarantine'
    ) as is_quarantined,
    -- Get blocked channels
    ARRAY(
      SELECT e4.patch->>'channel'
      FROM memory_edits e4
      WHERE e4.target_id = c.chunk_id
        AND e4.target_type = 'chunk'
        AND e4.status = 'approved'
        AND e4.op = 'block'
    ) as blocked_channels,
    -- Count applied edits
    (
      SELECT COUNT(*)
      FROM memory_edits e5
      WHERE e5.target_id = c.chunk_id
        AND e5.target_type = 'chunk'
        AND e5.status = 'approved'
    ) as edits_applied_count
  FROM chunks c
  LEFT JOIN LATERAL (
    SELECT *
    FROM memory_edits e
    WHERE e.target_id = c.chunk_id
      AND e.target_type = 'chunk'
      AND e.status = 'approved'
      AND e.applied_at IS NOT NULL
    ORDER BY e.applied_at DESC
    LIMIT 1
  ) e ON true
)
SELECT
  tenant_id,
  chunk_id,
  event_id,
  effective_text as text,
  effective_importance as importance,
  channel,
  scope,
  subject_type,
  subject_id,
  project_id,
  ts,
  tsv,
  sensitivity,
  tags,
  kind,
  token_est,
  is_retracted,
  is_quarantined,
  blocked_channels,
  edits_applied_count
FROM edits_applied
WHERE NOT is_retracted;

COMMENT ON VIEW effective_chunks IS 'Chunks with all approved edits applied (amend, attenuate, quarantine, block)';

-- FTS Search Function with Edit Awareness
CREATE OR REPLACE FUNCTION search_chunks(
  p_tenant_id TEXT,
  p_query TEXT,
  p_scope TEXT DEFAULT NULL,
  p_subject_type TEXT DEFAULT NULL,
  p_subject_id TEXT DEFAULT NULL,
  p_project_id TEXT DEFAULT NULL,
  p_include_quarantined BOOLEAN DEFAULT FALSE,
  p_channel TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
) RETURNS TABLE (
  chunk_id TEXT,
  text TEXT,
  importance REAL,
  ts TIMESTAMPTZ,
  rank REAL,
  edits_applied INT,
  is_quarantined BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.chunk_id,
    ec.text,
    ec.importance,
    ec.ts,
    ts_rank(ec.tsv, query) as rank,
    ec.edits_applied_count,
    ec.is_quarantined
  FROM effective_chunks ec,
         to_tsquery('english', p_query) query
  WHERE ec.tenant_id = p_tenant_id
    AND ec.tsv @@ query
    AND (p_scope IS NULL OR ec.scope = p_scope)
    AND (p_subject_type IS NULL OR ec.subject_type = p_subject_type)
    AND (p_subject_id IS NULL OR ec.subject_id = p_subject_id)
    AND (p_project_id IS NULL OR ec.project_id = p_project_id)
    AND (p_include_quarantined OR NOT ec.is_quarantined)
    AND (p_channel IS NULL OR ec.channel = p_channel)
    AND NOT (p_channel = ANY(ec.blocked_channels))
  ORDER BY rank DESC, ec.importance DESC, ec.ts DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION search_chunks IS 'Full-text search with edit awareness, scope/subject filtering';

-- Timeline Query Function
CREATE OR REPLACE FUNCTION get_timeline(
  p_tenant_id TEXT,
  p_around_chunk_id TEXT,
  p_window_seconds INT DEFAULT 3600,
  p_include_quarantined BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
  chunk_id TEXT,
  text TEXT,
  importance REAL,
  ts TIMESTAMPTZ,
  distance_seconds INT,
  edits_applied INT
) AS $$
DECLARE
  v_center_ts TIMESTAMPTZ;
BEGIN
  SELECT ts INTO v_center_ts
  FROM chunks
  WHERE chunk_id = p_around_chunk_id;

  IF v_center_ts IS NULL THEN
    RAISE EXCEPTION 'Chunk % not found', p_around_chunk_id;
  END IF;

  RETURN QUERY
  SELECT
    ec.chunk_id,
    ec.text,
    ec.importance,
    ec.ts,
    EXTRACT(EPOCH FROM (ec.ts - v_center_ts))::INT as distance_seconds,
    ec.edits_applied_count
  FROM effective_chunks ec
  WHERE ec.tenant_id = p_tenant_id
    AND ec.ts BETWEEN (v_center_ts - (p_window_seconds || ' seconds')::INTERVAL)
                    AND (v_center_ts + (p_window_seconds || ' seconds')::INTERVAL)
    AND (p_include_quarantined OR NOT ec.is_quarantined)
  ORDER BY ABS(EXTRACT(EPOCH FROM (ec.ts - v_center_ts))) ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_timeline IS 'Time-bounded query around a chunk with edits applied';

-- Active Decisions by Precedence
CREATE OR REPLACE FUNCTION get_active_decisions(
  p_tenant_id TEXT,
  p_scope TEXT DEFAULT NULL,
  p_project_id TEXT DEFAULT NULL,
  p_subject_id TEXT DEFAULT NULL
) RETURNS TABLE (
  decision_id TEXT,
  decision TEXT,
  scope TEXT,
  rationale TEXT[],
  precedence INT,
  ts TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.decision_id,
    d.decision,
    d.scope,
    d.rationale,
    CASE d.scope
      WHEN 'policy' THEN 4
      WHEN 'project' THEN 3
      WHEN 'user' THEN 2
      WHEN 'session' THEN 1
      ELSE 0
    END as precedence,
    d.ts
  FROM decisions d
  WHERE d.tenant_id = p_tenant_id
    AND d.status = 'active'
    AND (p_scope IS NULL OR d.scope = p_scope)
    AND (p_project_id IS NULL OR d.project_id = p_project_id)
    AND (p_subject_id IS NULL OR d.subject_id = p_subject_id)
  ORDER BY precedence DESC, d.ts DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_decisions IS 'Query active decisions ordered by precedence (policy > project > user > session)';

-- Available Capsules Query
CREATE OR REPLACE FUNCTION get_available_capsules(
  p_tenant_id TEXT,
  p_agent_id TEXT,
  p_subject_type TEXT DEFAULT NULL,
  p_subject_id TEXT DEFAULT NULL
) RETURNS TABLE (
  capsule_id TEXT,
  scope TEXT,
  subject_type TEXT,
  subject_id TEXT,
  items JSONB,
  risks TEXT[],
  author_agent_id TEXT,
  expires_at TIMESTAMPTZ,
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
    c.risks,
    c.author_agent_id,
    c.expires_at,
    c.created_at
  FROM capsules c
  WHERE c.tenant_id = p_tenant_id
    AND c.status = 'active'
    AND c.expires_at > now()
    AND p_agent_id = ANY(c.audience_agent_ids)
    AND (p_subject_type IS NULL OR c.subject_type = p_subject_type)
    AND (p_subject_id IS NULL OR c.subject_id = p_subject_id)
  ORDER BY c.ts DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_available_capsules IS 'Query capsules available to an agent, filtered by subject';
