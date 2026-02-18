-- Stratified Memory System
-- Based on research: Generative Agents (Park et al), human memory architecture
-- Adds: Reflection mechanism, metadata view, importance scoring

-- Layer 1: Memory Metadata View (fast access)
-- Always-current metadata for quick orientation
CREATE MATERIALIZED VIEW IF NOT EXISTS memory_metadata AS
SELECT
  tenant_id,
  COUNT(*) as session_count,
  MIN(created_at) as first_session,
  MAX(created_at) as last_session,
  AVG(significance) as significance_avg,
  array_agg(DISTINCT with_whom) FILTER (WHERE with_whom IS NOT NULL) as key_people,
  (SELECT array_agg(DISTINCT tag)
   FROM (
     SELECT unnest(tags) as tag
     FROM session_handoffs sh
     WHERE sh.tenant_id = session_handoffs.tenant_id
   ) t
  ) as all_tags,
  COUNT(*) FILTER (WHERE significance >= 0.8) as high_significance_count
FROM session_handoffs
GROUP BY tenant_id;

-- Index for fast tenant lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_metadata_tenant
  ON memory_metadata(tenant_id);

-- Refresh function (call after handoff creation)
CREATE OR REPLACE FUNCTION refresh_memory_metadata()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY memory_metadata;
END;
$$ LANGUAGE plpgsql;

-- Layer 2: Memory Reflections (higher-level inferences)
-- Periodic consolidation following Generative Agents pattern:
-- Take N observations → Generate salient questions → Answer → Save insights
CREATE TABLE IF NOT EXISTS memory_reflections (
  reflection_id TEXT PRIMARY KEY DEFAULT ('refl_' || gen_random_uuid()),
  tenant_id TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  session_count INTEGER NOT NULL,

  -- Reflection content (higher-level inferences)
  summary TEXT NOT NULL,              -- Compressed narrative (~200 tokens)
  key_insights TEXT[],                -- 3-5 salient points
  themes TEXT[],                      -- Emerging themes/patterns
  identity_evolution TEXT,            -- How "becoming" changed

  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Foreign key reference
  CONSTRAINT fk_reflection_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_memory_reflections_tenant_period
  ON memory_reflections(tenant_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_memory_reflections_tenant_created
  ON memory_reflections(tenant_id, generated_at DESC);

-- Function to create reflection from handoffs
CREATE OR REPLACE FUNCTION generate_reflection(
  p_tenant_id TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS TEXT AS $$
DECLARE
  v_reflection_id TEXT;
  v_session_count INTEGER;
  v_summary TEXT;
  v_insights TEXT[];
BEGIN
  -- Count sessions in period
  SELECT COUNT(*) INTO v_session_count
  FROM session_handoffs
  WHERE tenant_id = p_tenant_id
    AND created_at >= p_period_start
    AND created_at <= p_period_end;

  -- Generate reflection ID
  v_reflection_id := 'refl_' || encode(gen_random_bytes(16), 'hex');

  -- Insert reflection record
  -- Note: Actual summary/insights generation happens via application layer (LLM)
  INSERT INTO memory_reflections (
    reflection_id,
    tenant_id,
    period_start,
    period_end,
    session_count,
    summary,
    key_insights,
    themes,
    identity_evolution
  ) VALUES (
    v_reflection_id,
    p_tenant_id,
    p_period_start,
    p_period_end,
    v_session_count,
    'Pending generation...',  -- Will be updated by background job
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    NULL
  );

  RETURN v_reflection_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON MATERIALIZED VIEW memory_metadata IS 'Layer 1: Fast metadata access (~50 tokens). Always-current summary of tenant memory state.';
COMMENT ON TABLE memory_reflections IS 'Layer 2: Periodic reflections (~200 tokens). Higher-level inferences generated via consolidation mechanism.';
COMMENT ON FUNCTION generate_reflection IS 'Create reflection record for a time period. Content generated via application layer.';
COMMENT ON FUNCTION refresh_memory_metadata IS 'Refresh materialized view after data changes.';

-- Trigger to refresh metadata after handoff creation (added after view exists)
CREATE OR REPLACE FUNCTION trigger_refresh_metadata()
RETURNS trigger AS $$
BEGIN
  -- Refresh metadata asynchronously (don't block insert)
  REFRESH MATERIALIZED VIEW CONCURRENTLY memory_metadata;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS refresh_metadata_on_handoff ON session_handoffs;
CREATE TRIGGER refresh_metadata_on_handoff
  AFTER INSERT ON session_handoffs
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_metadata();
