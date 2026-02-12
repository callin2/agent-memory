-- Migration 011: Effective Views + SQL Queries
-- Creates effective_chunks view and SQL functions for edit-aware queries

BEGIN;

-- Effective Chunks View
-- This view applies all approved memory edits to chunks
CREATE OR REPLACE VIEW effective_chunks AS
WITH latest_amend AS (
  -- Get the latest amend with text for each chunk
  SELECT DISTINCT ON (target_id)
    target_id as chunk_id,
    patch->>'text' as amended_text,
    applied_at
  FROM memory_edits
  WHERE target_type = 'chunk'
    AND status = 'approved'
    AND op = 'amend'
    AND patch->>'text' IS NOT NULL
    AND applied_at IS NOT NULL
  ORDER BY target_id, applied_at DESC
),
latest_importance_op AS (
  -- Get the latest operation that affects importance (absolute or delta)
  SELECT DISTINCT ON (target_id)
    target_id as chunk_id,
    op,
    patch,
    applied_at
  FROM memory_edits
  WHERE target_type = 'chunk'
    AND status = 'approved'
    AND (
      (op = 'amend' AND patch->>'importance' IS NOT NULL)
      OR
      (op = 'attenuate' AND (patch->>'importance' IS NOT NULL OR patch->>'importance_delta' IS NOT NULL))
    )
    AND applied_at IS NOT NULL
  ORDER BY target_id, applied_at DESC
),
effective_importance_calc AS (
  -- Calculate effective importance based on latest operation
  SELECT
    c.chunk_id,
    CASE
      -- Latest op sets importance absolutely
      WHEN li.op IN ('amend', 'attenuate') AND li.patch->>'importance' IS NOT NULL
        THEN (li.patch->>'importance')::REAL +
             COALESCE(
               -- Sum all delta edits AFTER this absolute importance edit
               (
                 SELECT SUM((me.patch->>'importance_delta')::REAL)
                 FROM memory_edits me
                 WHERE me.target_id = c.chunk_id
                   AND me.target_type = 'chunk'
                   AND me.status = 'approved'
                   AND me.op = 'attenuate'
                   AND me.patch->>'importance_delta' IS NOT NULL
                   AND me.applied_at IS NOT NULL
                   AND me.applied_at > li.applied_at
               ),
               0
             )
      -- Latest op is a delta, find the base importance
      WHEN li.op = 'attenuate' AND li.patch->>'importance_delta' IS NOT NULL
        THEN COALESCE(
          -- If there was an earlier absolute importance edit, use that as base
          (
            SELECT (me2.patch->>'importance')::REAL +
                   COALESCE((
                     SELECT SUM((me3.patch->>'importance_delta')::REAL)
                     FROM memory_edits me3
                     WHERE me3.target_id = c.chunk_id
                       AND me3.target_type = 'chunk'
                       AND me3.status = 'approved'
                       AND me3.op = 'attenuate'
                       AND me3.patch->>'importance_delta' IS NOT NULL
                       AND me3.applied_at IS NOT NULL
                       AND me3.applied_at > me2.applied_at
                       AND me3.applied_at < li.applied_at
                       AND NOT EXISTS (
                         SELECT 1 FROM memory_edits me_abs2
                         WHERE me_abs2.target_id = c.chunk_id
                           AND me_abs2.target_type = 'chunk'
                           AND me_abs2.status = 'approved'
                           AND me_abs2.op IN ('amend', 'attenuate')
                           AND me_abs2.patch->>'importance' IS NOT NULL
                           AND me_abs2.applied_at IS NOT NULL
                           AND me_abs2.applied_at > me2.applied_at
                           AND me_abs2.applied_at < me3.applied_at
                       )
                   ), 0)
            FROM memory_edits me2
            WHERE me2.target_id = c.chunk_id
              AND me2.target_type = 'chunk'
              AND me2.status = 'approved'
              AND me2.op IN ('amend', 'attenuate')
              AND me2.patch->>'importance' IS NOT NULL
              AND me2.applied_at IS NOT NULL
              AND me2.applied_at < li.applied_at
              AND NOT EXISTS (
                SELECT 1 FROM memory_edits me_abs
                WHERE me_abs.target_id = c.chunk_id
                  AND me_abs.target_type = 'chunk'
                  AND me_abs.status = 'approved'
                  AND me_abs.op IN ('amend', 'attenuate')
                  AND me_abs.patch->>'importance' IS NOT NULL
                  AND me_abs.applied_at IS NOT NULL
                  AND me_abs.applied_at > me2.applied_at
                  AND me_abs.applied_at < li.applied_at
              )
            ORDER BY me2.applied_at DESC
            LIMIT 1
          ),
          -- Otherwise use original importance
          c.importance
        ) + (li.patch->>'importance_delta')::REAL
      -- No importance edits, use original
      ELSE c.importance
    END as effective_importance
  FROM chunks c
  LEFT JOIN latest_importance_op li ON li.chunk_id = c.chunk_id
)
SELECT
  c.chunk_id,
  COALESCE(la.amended_text, c.text) as text,
  COALESCE(eic.effective_importance, c.importance) as importance,
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
  (SELECT COUNT(*)::INT FROM memory_edits e5 WHERE e5.target_id = c.chunk_id AND e5.target_type = 'chunk' AND e5.status = 'approved') as edits_applied_count
FROM chunks c
LEFT JOIN latest_amend la ON la.chunk_id = c.chunk_id
LEFT JOIN effective_importance_calc eic ON eic.chunk_id = c.chunk_id
WHERE NOT EXISTS(
  SELECT 1 FROM memory_edits e
  WHERE e.target_id = c.chunk_id
    AND e.target_type = 'chunk'
    AND e.status = 'approved'
    AND e.op = 'retract'
);

COMMENT ON VIEW effective_chunks IS 'Chunks with all approved edits applied (amend, attenuate, quarantine, block)';

-- FTS Search Function with Edit Awareness
DROP FUNCTION IF EXISTS search_chunks(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, INT);

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
  is_quarantined BOOLEAN,
  subject_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.chunk_id,
    ec.text,
    ec.importance,
    ec.ts,
    ts_rank(ec.tsv, query) as rank,
    ec.edits_applied_count::INT,
    ec.is_quarantined,
    ec.subject_id
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
    AND (p_channel IS NULL OR NOT (p_channel = ANY(ec.blocked_channels)))
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
  SELECT ec.ts INTO v_center_ts
  FROM effective_chunks ec
  WHERE ec.chunk_id = p_around_chunk_id AND ec.tenant_id = p_tenant_id;

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
    ec.edits_applied_count::INT
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

COMMIT;
