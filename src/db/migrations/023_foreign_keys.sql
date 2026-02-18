-- ============================================================================
-- Migration 023: Add Missing Foreign Key Constraints
-- ============================================================================
-- Task: https://github.com/callin/agent_memory_v2/issues/4
-- Expert: Database + Security
-- Priority: P0/CRITICAL (referential integrity)
-- Effort: 4-6 hours
-- Impact: Prevents orphaned records, ensures data consistency
--
-- Problem:
-- - tenant_id columns have no foreign key constraints
-- - Can insert invalid tenant_id references (orphaned records)
-- - No cascade delete when tenant is removed
-- - Potential data integrity violations
--
-- Solution:
-- Add FK constraints with ON DELETE CASCADE to:
-- - session_handoffs.tenant_id → tenants.tenant_id
-- - knowledge_notes.tenant_id → tenants.tenant_id
-- - consolidation_jobs.tenant_id → tenants.tenant_id
-- - consolidation_stats.tenant_id → tenants.tenant_id
--
-- ============================================================================

-- Foreign key for session_handoffs.tenant_id
ALTER TABLE session_handoffs
  ADD CONSTRAINT fk_session_handoffs_tenant
  FOREIGN KEY (tenant_id)
  REFERENCES tenants(tenant_id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT fk_session_handoffs_tenant ON session_handoffs IS
  'Ensures all handoffs belong to valid tenants. Cascade delete when tenant removed.';

-- Foreign key for knowledge_notes.tenant_id
ALTER TABLE knowledge_notes
  ADD CONSTRAINT fk_knowledge_notes_tenant
  FOREIGN KEY (tenant_id)
  REFERENCES tenants(tenant_id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT fk_knowledge_notes_tenant ON knowledge_notes IS
  'Ensures all knowledge notes belong to valid tenants. Cascade delete when tenant removed.';

-- Foreign key for consolidation_jobs.tenant_id
ALTER TABLE consolidation_jobs
  ADD CONSTRAINT fk_consolidation_jobs_tenant
  FOREIGN KEY (tenant_id)
  REFERENCES tenants(tenant_id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT fk_consolidation_jobs_tenant ON consolidation_jobs IS
  'Ensures all consolidation jobs belong to valid tenants. Cascade delete when tenant removed.';

-- Foreign key for consolidation_stats.tenant_id
ALTER TABLE consolidation_stats
  ADD CONSTRAINT fk_consolidation_stats_tenant
  FOREIGN KEY (tenant_id)
  REFERENCES tenants(tenant_id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT fk_consolidation_stats_tenant ON consolidation_stats IS
  'Ensures all consolidation stats belong to valid tenants. Cascade delete when tenant removed.';

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these after migration to verify FK constraints are in place:
--
-- SELECT
--   conname AS constraint_name,
--   conrelid::regclass AS table_name,
--   confrelid::regclass AS references_table,
--   pg_get_constraintdef(oid) AS constraint_definition
-- FROM pg_constraint
-- WHERE conname LIKE '%tenant%'
--   AND conrelid::regclass IN ('session_handoffs', 'knowledge_notes', 'consolidation_jobs', 'consolidation_stats');
--
-- Should show 4 foreign key constraints, all referencing tenants(tenant_id)
--
-- ============================================================================

-- ============================================================================
-- Impact Analysis
-- ============================================================================
--
-- Before these constraints:
-- - Can insert handoffs with non-existent tenant_id (data integrity violation)
-- - Deleting tenant leaves orphaned records (dangling references)
-- - No guarantee of referential integrity
--
-- After these constraints:
-- - INSERT with invalid tenant_id → ERROR (prevents orphaned records)
-- - DELETE tenant → CASCADE (automatically cleans up related records)
-- - Referential integrity enforced at database level
--
-- Performance impact:
-- - Minimal: FKs use existing indexes on tenant_id columns
-- - Small overhead on INSERT/DELETE (constraint checking)
-- - No impact on SELECT queries
--
-- ============================================================================

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================
-- To rollback these changes:
--
-- ALTER TABLE session_handoffs DROP CONSTRAINT IF EXISTS fk_session_handoffs_tenant;
-- ALTER TABLE knowledge_notes DROP CONSTRAINT IF EXISTS fk_knowledge_notes_tenant;
-- ALTER TABLE consolidation_jobs DROP CONSTRAINT IF EXISTS fk_consolidation_jobs_tenant;
-- ALTER TABLE consolidation_stats DROP CONSTRAINT IF EXISTS fk_consolidation_stats_tenant;
--
-- ============================================================================
