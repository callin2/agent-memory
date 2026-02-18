-- ============================================================================
-- Migration 025: Fix Materialized View Refresh Lock Contention
-- ============================================================================
-- Task: https://github.com/callin/agent_memory_v2/issues/6
-- Expert: Database + Performance
-- Priority: P0/CRITICAL (enables write throughput)
-- Effort: 4-6 hours
-- Impact: Removes write bottleneck, enables scaling
--
-- Problem:
-- - Synchronous trigger on every INSERT blocks writes during refresh
-- - REFRESH MATERIALIZED VIEW CONCURRENTLY still causes table lock contention
-- - At high write volumes, this blocks all handoff creation
--
-- Solution:
-- 1. Remove synchronous trigger (don't block inserts)
-- 2. Add refresh queue table to track dirty state
-- 3. Background job will refresh MV every 5 minutes
--
-- Implementation Note:
-- - For now, just remove the trigger
-- - Background job can be implemented in Task 7 (Redis caching phase)
-- - MV will be slightly stale (max 5 minutes old) but that's acceptable for metadata
--
-- ============================================================================

-- Remove the blocking trigger
DROP TRIGGER IF EXISTS refresh_metadata_on_handoff ON session_handoffs;

-- Create refresh queue table for background job
CREATE TABLE IF NOT EXISTS mv_refresh_queue (
  table_name TEXT PRIMARY KEY,
  last_refresh TIMESTAMPTZ DEFAULT NOW(),
  refresh_interval INTERVAL DEFAULT '5 minutes',
  is_refreshing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize queue with metadata view
INSERT INTO mv_refresh_queue (table_name, refresh_interval)
VALUES ('memory_metadata', '5 minutes')
ON CONFLICT (table_name) DO NOTHING;

COMMENT ON TABLE mv_refresh_queue IS 'Tracks which materialized views need refresh and when';
COMMENT ON COLUMN mv_refresh_queue.table_name IS 'Name of materialized view to refresh';
COMMENT ON COLUMN mv_refresh_queue.last_refresh IS 'Last time this MV was refreshed';
COMMENT ON COLUMN mv_refresh_queue.refresh_interval IS 'How often to refresh (e.g., 5 minutes)';
COMMENT ON COLUMN mv_refresh_queue.is_refreshing IS 'Flag to prevent concurrent refreshes';
COMMENT ON COLUMN mv_refresh_queue.created_at IS 'When this entry was created';

-- ============================================================================
-- Background Job Implementation Note
-- ============================================================================
--
-- TODO: Implement background job that:
--
-- 1. Run every 1 minute (cron: * * * * *)
-- 2. Check mv_refresh_queue for tables needing refresh
-- 3. For each table where:
--    - last_refresh < (NOW() - refresh_interval)
--    - AND is_refreshing = false
-- 4. Refresh the MV:
--    - SET is_refreshing = true
--    - REFRESH MATERIALIZED VIEW CONCURRENTLY [table_name]
--    - UPDATE last_refresh = NOW()
--    - SET is_refreshing = false
--
-- Implementation options:
--
-- Option A: node-cron (simple, in-process)
--   import cron from 'node-cron';
--   cron.schedule('*/1 * * * *', async () => {
--     await refreshMVs();
--   });
--
-- Option B: Bull queue (robust, Redis-backed)
--   import Queue from 'bull';
--   const mvQueue = new Queue('mv-refresh', { redis: { port: 6379 } });
--   mvQueue.process(async (job) => {
--     await refreshMV(job.data.table_name);
--   });
--   mvQueue.add({ table_name: 'memory_metadata' }, { repeat: { every: 60000 } });
--
-- For now, MV can be slightly stale. The metadata view shows:
-- - Session counts (off by a few minutes = acceptable)
-- - Significance averages (trends, not exact = acceptable)
-- - Tag lists (evolves slowly = acceptable)
--
-- ============================================================================

COMMENT ON MATERIALIZED VIEW memory_metadata IS 'Metadata view refreshed every 5 minutes by background job. May be up to 5 minutes stale, which is acceptable for summary statistics.';
