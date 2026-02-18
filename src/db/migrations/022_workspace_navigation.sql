-- ============================================================================
-- Migration 022: Workspace Navigation Tools
-- Adds support for cross-workspace navigation and discovery
-- ============================================================================

-- 1. Add owner_id to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS owner_id TEXT;

-- Set default owner_id for existing tenants
-- In production, owner_id should be set during tenant creation
UPDATE tenants
SET owner_id = tenant_id  -- Default: self-owned for existing data
WHERE owner_id IS NULL;

ALTER TABLE tenants
ALTER COLUMN owner_id SET NOT NULL;

-- 2. Add display_name (human-readable workspace name)
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Generate display names from tenant_id for existing data
UPDATE tenants
SET display_name = REPLACE(tenant_id, '_', ' ')
WHERE display_name IS NULL;

-- 3. Add last_accessed timestamp for optimization
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 4. Add index for owner-based queries
CREATE INDEX IF NOT EXISTS idx_tenants_owner
ON tenants(owner_id);

CREATE INDEX IF NOT EXISTS idx_tenants_last_accessed
ON tenants(last_accessed DESC);

-- 5. Full-text search index on handoffs
CREATE INDEX IF NOT EXISTS idx_handoffs_fts
ON session_handoffs
USING GIN (to_tsvector('english',
  coalesce(experienced, '') || ' ' ||
  coalesce(learned, '') || ' ' ||
  coalesce(story, '') || ' ' ||
  coalesce(becoming, '') || ' ' ||
  coalesce(remember, '')
));

-- 6. System features table (for explore_room)
CREATE TABLE IF NOT EXISTS system_features (
  feature_name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert known features
INSERT INTO system_features (feature_name, enabled, description) VALUES
  ('stratified_memory', true, 'Stratified memory consolidation with 4 layers'),
  ('consolidation', true, 'Automatic memory consolidation jobs'),
  ('cross_tenant_search', true, 'Search across workspaces with same owner')
ON CONFLICT (feature_name) DO NOTHING;

-- 7. Materialized view for workspace summaries (fast list_workspaces)
CREATE MATERIALIZED VIEW IF NOT EXISTS workspace_summaries AS
SELECT
  t.tenant_id,
  t.display_name,
  t.owner_id,
  t.last_accessed,
  COUNT(sh.handoff_id) as handoff_count,
  MAX(sh.created_at) as last_updated,
  -- Most frequent tag (primary focus)
  (
    SELECT tag
    FROM (
      SELECT unnest(tags) as tag
      FROM session_handoffs sh2
      WHERE sh2.tenant_id = t.tenant_id
    ) all_tags
    GROUP BY tag
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) as primary_focus
FROM tenants t
LEFT JOIN session_handoffs sh ON t.tenant_id = sh.tenant_id
GROUP BY t.tenant_id, t.display_name, t.owner_id, t.last_accessed;

-- Create unique index on tenant_id for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_summaries_tenant
ON workspace_summaries(tenant_id);

-- Index on owner_id for fast filtering
CREATE INDEX IF NOT EXISTS idx_workspace_summaries_owner
ON workspace_summaries(owner_id);

-- 8. Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_workspace_summaries()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY workspace_summaries;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger to update last_accessed
CREATE OR REPLACE FUNCTION update_last_accessed()
RETURNS trigger AS $$
BEGIN
  UPDATE tenants
  SET last_accessed = NOW()
  WHERE tenant_id = NEW.tenant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_last_accessed ON session_handoffs;
CREATE TRIGGER trigger_update_last_accessed
AFTER INSERT ON session_handoffs
FOR EACH ROW
EXECUTE FUNCTION update_last_accessed();

-- 10. Function for cross-workspace search
CREATE OR REPLACE FUNCTION search_all_workspaces(
  p_owner_id TEXT,
  p_query TEXT,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  tenant_id TEXT,
  handoff_id TEXT,
  match_type TEXT,
  relevance REAL,
  snippet TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sh.tenant_id,
    sh.handoff_id,
    'handoff' as match_type,
    ts_rank(
      to_tsvector('english',
        coalesce(sh.experienced, '') || ' ' ||
        coalesce(sh.learned, '') || ' ' ||
        coalesce(sh.story, '')
      ),
      plainto_tsquery('english', p_query)
    ) as relevance,
    LEFT(sh.experienced, 200) as snippet,
    sh.created_at
  FROM session_handoffs sh
  JOIN tenants t ON sh.tenant_id = t.tenant_id
  WHERE t.owner_id = p_owner_id
    AND to_tsvector('english',
      coalesce(sh.experienced, '') || ' ' ||
      coalesce(sh.learned, '') || ' ' ||
      coalesce(sh.story, '')
    ) @@ plainto_tsquery('english', p_query)
  ORDER BY relevance DESC, sh.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 11. Function to get workspace snapshot
CREATE OR REPLACE FUNCTION get_workspace_snapshot(
  p_tenant_id TEXT,
  p_max_tokens INTEGER DEFAULT 100
)
RETURNS TABLE (
  what_is_this TEXT,
  current_state TEXT,
  recent_focus TEXT[],
  key_learnings TEXT[],
  priming_tags TEXT[],
  token_count INTEGER
) AS $$
DECLARE
  v_what_is_this TEXT;
  v_current_state TEXT;
  v_recent_focus TEXT[];
  v_key_learnings TEXT[];
  v_priming_tags TEXT[];
  v_token_count INTEGER;
BEGIN
  -- Get most recent handoff for "what is this"
  SELECT
    'Workspace: ' || COALESCE(ws.display_name, ws.tenant_id)
  INTO v_what_is_this
  FROM workspace_summaries ws
  WHERE ws.tenant_id = p_tenant_id;

  -- Get current state from recent handoffs
  SELECT
    STRING_AGG(DISTINCT sh.experienced, '. ' ORDER BY sh.created_at DESC)
  INTO v_current_state
  FROM session_handoffs sh
  WHERE sh.tenant_id = p_tenant_id
    AND sh.created_at > NOW() - INTERVAL '7 days'
  LIMIT 3;

  -- Get recent focus (last 3 session topics)
  SELECT ARRAY_AGG(DISTINCT session_id ORDER BY created_at DESC)
  INTO v_recent_focus
  FROM (
    SELECT session_id, created_at
    FROM session_handoffs
    WHERE tenant_id = p_tenant_id
    ORDER BY created_at DESC
    LIMIT 3
  ) sub;

  -- Get key learnings (from "remember" field)
  SELECT ARRAY_AGG(DISTINCT remember ORDER BY created_at DESC)
  INTO v_key_learnings
  FROM (
    SELECT remember, created_at
    FROM session_handoffs
    WHERE tenant_id = p_tenant_id
      AND remember IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 3
  ) sub;

  -- Get priming tags (most frequent tags)
  SELECT ARRAY_AGG(tag ORDER BY freq DESC)
  INTO v_priming_tags
  FROM (
    SELECT unnest(tags) as tag, COUNT(*) as freq
    FROM session_handoffs
    WHERE tenant_id = p_tenant_id
    GROUP BY tag
    ORDER BY freq DESC
    LIMIT 3
  ) sub;

  -- Estimate token count (rough estimate: 1 token ≈ 4 characters)
  v_token_count := LENGTH(COALESCE(v_what_is_this, '') +
                       COALESCE(v_current_state, '')) / 4;

  RETURN QUERY SELECT v_what_is_this, v_current_state,
                      v_recent_focus, v_key_learnings, v_priming_tags, v_token_count;
END;
$$ LANGUAGE plpgsql;

-- 12. Add comment for documentation
COMMENT ON MATERIALIZED VIEW workspace_summaries IS 'Pre-computed workspace metadata for fast list_workspaces queries';
COMMENT ON FUNCTION search_all_workspaces IS 'Search handoffs across all workspaces owned by same user';
COMMENT ON FUNCTION get_workspace_snapshot IS 'Get compressed snapshot of workspace context (polaroid view)';
COMMENT ON FUNCTION refresh_workspace_summaries IS 'Refresh the workspace summaries materialized view';

-- ============================================================================
-- Migration complete
-- ============================================================================
