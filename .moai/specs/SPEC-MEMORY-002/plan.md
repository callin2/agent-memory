# Implementation Plan: SPEC-MEMORY-002

**SPEC ID:** SPEC-MEMORY-002
**Title:** Memory Surgery & Capsule Transfer System
**Status:** Planned
**Priority:** High
**Created:** 2026-02-10

---

## TAG BLOCK

**Tags:** memory-surgery, capsule-transfer, scope-subject, memory-governance, audit-trail
**Related SPECs:** SPEC-ARCH-001
**Epic:** Memory Management & Governance

---

## Implementation Milestones

### Milestone M1 (Priority High): DDL Migration + Indexes

**Objective**: Apply schema changes and create indexes for scope+subject framework and new tables.

**Tasks**:
1. Create migration file `006_scope_subject.sql`
   - Add scope, subject_type, subject_id, project_id columns to events, chunks, decisions, tasks
   - Add CHECK constraints for scope column
2. Create migration file `007_capsules.sql`
   - Create capsules table with all columns and constraints
   - Create indexes for tenant+subject and audience queries
3. Create migration file `008_memory_edits.sql`
   - Create memory_edits table with audit columns
   - Create indexes for target and status queries
4. Create migration file `009_scope_subject_indexes.sql`
   - Create partial indexes for scope filtering
   - Create composite indexes for subject filtering
   - Create partial indexes for project filtering
5. Run migrations in development database
6. Validate index creation with EXPLAIN ANALYZE
7. Create rollback scripts for each migration

**Success Criteria**:
- All migrations apply without errors
- Indexes exist and are valid
- EXPLAIN ANALYZE shows index usage for scope/subject queries
- Rollback scripts tested successfully

**Estimated Effort**: 3-4 hours

**Dependencies**:
- Database access (development environment)
- Migration tooling (existing framework)

---

### Milestone M2 (Priority High): Effective Views + SQL Queries

**Objective**: Create effective_chunks view and SQL functions for edit-aware queries.

**Tasks**:
1. Create `effective_chunks` view
   - LATERAL JOIN with latest memory_edits per chunk
   - Apply amend text replacement
   - Compute attenuated importance
   - Flag retracted, quarantined, blocked chunks
2. Create `search_chunks()` function
   - FTS query with to_tsquery
   - Filter by scope, subject, project
   - Exclude retracted and blocked (by channel)
   - Optionally exclude quarantined
   - Order by rank, importance, ts
3. Create `get_timeline()` function
   - Time-bounded query around chunk
   - Use effective_chunks view
   - Return distance from center
   - Optionally exclude quarantined
4. Create `get_active_decisions()` function
   - Query by scope precedence (policy > project > user > session)
   - Filter by subject/project if provided
   - Order by precedence DESC, ts DESC
5. Create `get_available_capsules()` function
   - Filter by tenant, agent (audience), status
   - Filter by subject if provided
   - Check expires_at > now()
6. Benchmark query performance
   - Test with 1K, 10K, 100K chunks
   - Validate p95 latency < 300ms
   - Add materialized view option if needed

**Success Criteria**:
- All functions execute without errors
- Query performance meets p95 targets
- Effective view correctly applies all edit types
- Benchmark results documented

**Estimated Effort**: 5-6 hours

**Dependencies**:
- Milestone M1 complete (schema with indexes)
- Test data with various edit scenarios

---

### Milestone M3 (Priority High): API Endpoints

**Objective**: Implement API endpoints for memory surgery and capsule operations.

**Tasks**:

**Memory Recording Endpoints**:
1. Enhance `POST /api/v1/events` to extract and store scope+subject metadata
2. Create `POST /api/v1/chunks/summary` for summary_observation with scope

**Memory Query Endpoints**:
3. Create `POST /api/v1/chunks/search` using search_chunks() function
4. Create `GET /api/v1/chunks/:chunk_id/timeline` using get_timeline()
5. Enhance `POST /api/v1/chunks/get` to apply edits and block channels

**Capsule Endpoints**:
6. Create `POST /api/v1/capsules` for capsule creation
   - Validate all referenced chunks/decisions/artifacts exist
   - Validate audience_agent_ids are valid users
   - Calculate expires_at from ttl_days
7. Create `GET /api/v1/capsules` for listing available capsules
8. Create `GET /api/v1/capsules/:capsule_id` for capsule retrieval
9. Create `DELETE /api/v1/capsules/:capsule_id` for revocation

**Memory Surgery Endpoints**:
10. Create `POST /api/v1/edits` for applying memory edits
    - Validate target_type and target_id exist
    - Validate op is supported operation
    - Check approval workflow (if configured)
    - Apply edit immediately or set status=pending
    - Return edit_id and status
11. Create `GET /api/v1/edits` for listing edits (audit)
12. Create `GET /api/v1/edits/:edit_id` for edit details
13. Create `PUT /api/v1/edits/:edit_id/approve` for approval workflow

**ACB Integration**:
14. Enhance `POST /api/v1/acb/build` to:
    - Inject available capsules for subject
    - Apply all memory edits to chunks
    - Return edits_applied count

**Error Handling**:
15. Add validation for all request schemas
16. Add 404 responses for missing targets (chunks, capsules)
17. Add 403 responses for unauthorized capsule access
18. Add 400 responses for invalid edit operations

**Success Criteria**:
- All endpoints return expected responses
- Request validation catches invalid inputs
- Error responses include helpful messages
- Integration tests pass for all endpoints

**Estimated Effort**: 8-10 hours

**Dependencies**:
- Milestone M1 complete (schema)
- Milestone M2 complete (SQL functions)
- Existing API framework (Express.js)

---

### Milestone M4 (Priority High): ACB Integration

**Objective**: Integrate capsules and memory edits into Active Context Bundle building.

**Tasks**:

**Capsule Integration**:
1. Modify `buildACB()` function to:
   - Call `get_available_capsules()` for subject
   - Extract chunks, decisions, artifacts from capsules
   - Merge capsule items into ACB with source tagging
   - Track capsule origin in metadata

**Memory Edit Integration**:
2. Modify `buildACB()` function to:
   - Use `effective_chunks` view instead of raw chunks table
   - Filter quarantined chunks unless explicit=true
   - Apply text replacements from amend edits
   - Compute importance with attenuate edits
   - Exclude retracted chunks entirely
   - Exclude blocked chunks by channel

**ACB Structure Update**:
3. Update ACB response schema:
   ```typescript
   interface ACB {
     session: {
       events: Event[];
       chunks: Chunk[];
     };
     active_decisions: Decision[];
     active_tasks: Task[];
     capsules: Capsule[];
     edits_applied: number;
     total_tokens: number;
   }
   ```

**Token Budget Management**:
4. Implement smart token budgeting:
   - Prioritize capsule chunks (curated content)
   - Deprioritize quarantined chunks (even if included)
   - Respect importance scores after edits
   - Truncate by importance if exceeding max_tokens

**Testing**:
5. Test ACB building with:
   - No capsules or edits (baseline)
   - Capsules only
   - Memory edits only
   - Both capsules and edits
   - Mixed subject scopes

**Success Criteria**:
- ACB includes relevant capsules for subject
- ACB applies all approved edits
- Token budget honored with smart prioritization
- ACB building p95 latency < 500ms
- Integration tests pass

**Estimated Effort**: 4-5 hours

**Dependencies**:
- Milestone M2 complete (SQL functions)
- Milestone M3 complete (API endpoints)
- Existing ACB building logic

---

### Milestone M5 (Priority Medium): Testing

**Objective**: Comprehensive integration and acceptance testing.

**Tasks**:

**Unit Tests**:
1. Test SQL functions:
   - search_chunks() with various filters
   - get_timeline() with different windows
   - get_active_decisions() with precedence
   - get_available_capsules() with audience check

**Integration Tests**:
2. Test scope+subject metadata extraction:
   - Record event with subject in content
   - Verify chunks inherit subject metadata
   - Query by subject and verify results

3. Test capsule operations:
   - Create capsule with various item types
   - Query available capsules by agent
   - Verify audience enforcement (403 for non-audience)
   - Test capsule revocation
   - Test TTL expiration

4. Test memory surgery operations:
   - Apply retract edit → verify excluded
   - Apply amend edit → verify text changed
   - Apply quarantine edit → verify excluded from auto
   - Apply attenuate edit → verify importance reduced
   - Apply block edit → verify excluded by channel

5. Test ACB integration:
   - Build ACB with capsules → verify included
   - Build ACB with edits → verify applied
   - Build ACB with both → verify combined
   - Test token budgeting

**Performance Tests**:
6. Load test query performance:
   - 1000 chunks with 100 edits
   - 10000 chunks with 1000 edits
   - Measure p50, p95, p99 latency

7. Load test capsule operations:
   - Create 1000 capsules
   - Query available capsules
   - Measure latency degradation

**Acceptance Tests**:
8. Execute all acceptance criteria scenarios from acceptance.md
9. Verify Gherkin scenarios pass
10. Document any failed scenarios for remediation

**Success Criteria**:
- All unit tests pass
- All integration tests pass
- Performance targets met (p95 latency)
- All acceptance criteria satisfied

**Estimated Effort**: 6-8 hours

**Dependencies**:
- Milestone M4 complete (ACB integration)
- Test framework setup

---

### Milestone M6 (Priority Low): Documentation & Operations

**Objective**: Document usage and set up operational tooling.

**Tasks**:

**Documentation**:
1. Update API documentation with new endpoints
2. Create "Memory Surgery Guide" for operators
3. Create "Capsule Sharing Guide" for developers
4. Add examples for each edit operation type
5. Document approval workflow (if configured)

**Operational Tooling**:
6. Create TTL expiration job:
   - Scheduled job (cron or database job)
   - Update capsule status to 'expired'
   - Log expired capsules count
7. Create memory edit audit report:
   - Daily summary of edits applied
   - Alert on unusual edit patterns
8. Create capsule usage analytics:
   - Track capsule access frequency
   - Identify unused capsules
   - Report capsule churn

**Monitoring**:
9. Add metrics for:
   - Edit operation counts by type
   - Capsule creation/revocation counts
   - Query latency with edits applied
   - ACB building latency with capsules

**Success Criteria**:
- API documentation updated and published
- Operational guides created
- TTL job scheduled and tested
- Metrics dashboard created

**Estimated Effort**: 3-4 hours

**Dependencies**:
- Milestone M5 complete (testing)

---

## Technical Approach

### Architecture Pattern

**Layered Architecture**:

```
API Layer (Express.js)
  ├── Request validation (Zod schemas)
  ├── Business logic (TypeScript services)
  └── Response formatting

Service Layer
  ├── MemoryService (record, query, edit)
  ├── CapsuleService (create, query, revoke)
  └── ACBService (build with edits + capsules)

Data Layer (PostgreSQL)
  ├── Tables (events, chunks, capsules, memory_edits)
  ├── Views (effective_chunks)
  └── Functions (search_chunks, get_timeline, etc.)
```

### Edit Application Strategy

**On-Demand Application**:
- Edits applied at query time via effective_chunks view
- No permanent modification to source data
- Audit trail preserved in memory_edits table
- Performance optimization: Materialized view if needed

**Edit Merging Logic**:
```typescript
function applyEdits(chunks: Chunk[], edits: MemoryEdit[]): Chunk[] {
  const editsByTarget = groupBy(edits, 'target_id');

  return chunks
    .filter(chunk => {
      const edits = editsByTarget[chunk.chunk_id] || [];
      return !edits.some(e => e.op === 'retract');
    })
    .map(chunk => {
      const edits = editsByTarget[chunk.chunk_id] || [];
      const latestEdit = edits.sort(byAppliedAt)[0];

      if (!latestEdit) return chunk;

      switch (latestEdit.op) {
        case 'amend':
          return {
            ...chunk,
            text: latestEdit.patch.text || chunk.text,
            importance: latestEdit.patch.importance || chunk.importance
          };
        case 'attenuate':
          return {
            ...chunk,
            importance: latestEdit.patch.importance_delta
              ? chunk.importance + latestEdit.patch.importance_delta
              : latestEdit.patch.importance
          };
        default:
          return chunk;
      }
    });
}
```

### Capsule Validation

**Pre-creation Checks**:
1. Verify all referenced chunks exist (tenant_id match)
2. Verify all referenced decisions exist (tenant_id match)
3. Verify all referenced artifacts exist (tenant_id match)
4. Verify audience_agent_ids are valid users in tenant
5. Validate TTL is within allowed range (1-365 days)

**Access Control**:
```typescript
function canAccessCapsule(capsule: Capsule, agentId: string): boolean {
  return (
    capsule.status === 'active' &&
    capsule.expires_at > new Date() &&
    capsule.audience_agent_ids.includes(agentId)
  );
}
```

### Performance Optimization

**Index Strategy**:
- Partial indexes for NULL-filtered columns (scope, project_id, subject_id)
- Composite indexes for common query patterns (tenant+subject)
- GIN indexes for JSONB content search

**Query Optimization**:
- Use EXPLAIN ANALYZE to validate index usage
- Add query hints if needed (PostgreSQL doesn't support hints, use CTEs)
- Consider materialized view if effective_chunks view is slow
- Use connection pooling for high concurrency

**Caching Strategy**:
- Cache effective_chunks view results by tenant_id + subject_id
- Invalidate cache on new edit approval
- TTL of 5 minutes for cached results
- Use Redis or in-memory cache

---

## Risks and Mitigation Plans

### Risk R1: Performance Degradation from Effective View

**Risk Level**: Medium

**Description**: The effective_chunks view with LATERAL JOIN may be slow for large datasets.

**Mitigation**:
- Benchmark with 10K, 100K, 1M chunks
- If p95 > 300ms, implement materialized view strategy:
  - Refresh materialized view on edit approval
  - Use triggers to invalidate cache
  - Batch refresh every 5 minutes if high edit volume
- Add query result caching (Redis)

**Contingency**:
- Simplify edit operations to retract/block only (no text replacement)
- Remove LATERAL JOIN, use application-side edit merging

### Risk R2: Subject Identification Inconsistency

**Risk Level**: Medium

**Description**: Content may not reliably contain subject information for extraction.

**Mitigation**:
- Define subject extraction rules in specification
- Default subject_type='session' if subject not found
- Provide API override for manual subject assignment
- Add subject validation endpoint

**Contingency**:
- Require explicit subject parameter in record_event API
- Defer subject framework to later phase

### Risk R3: Capsule Abuse (Spam or Information Leakage)

**Risk Level**: Medium

**Description**: Agents may create excessive capsules or share inappropriately.

**Mitigation**:
- Rate limit capsule creation per agent (10/hour)
- Require approval for capsules with > 100 items
- Log all capsule access for audit
- Implement capsule forwarding restrictions

**Contingency**:
- Require manual approval for all capsule creation
- Disable capsule sharing feature temporarily

### Risk R4: Memory Edit Complexity

**Risk Level**: Low

**Description**: Edit operations (amend, attenuate) may have edge cases.

**Mitigation**:
- Comprehensive unit tests for each operation type
- Integration tests with multiple edits per target
- Document edit precedence clearly
- Provide edit preview API

**Contingency**:
- Simplify to retract only (remove other operations)
- Require manual review for complex edits

### Risk R5: TTL Expiration Job Failure

**Risk Level**: Low

**Description**: Scheduled job may fail to expire capsules.

**Mitigation**:
- Implement job retry logic with exponential backoff
- Log job failures for manual intervention
- Add expires_at check in query (defense in depth)
- Monitor job execution with alerts

**Contingency**:
- Manual SQL script to expire overdue capsules
- Disable TTL feature and require manual revocation

---

## Dependencies

### Internal Dependencies
- **SPEC-ARCH-001**: Microservices architecture (must complete for API Server separation)
- **PostgreSQL 15+**: Required for generated columns and LATERAL JOIN
- **Existing migration framework**: For applying DDL changes
- **Existing API framework**: Express.js with TypeScript

### External Dependencies
- **pgcrypto extension**: For secure hash generation (edit_id, capsule_id)
- **pg_trgm extension**: For trigram-based text search (existing)

### Blocking Dependencies
None - this SPEC can proceed independently once SPEC-ARCH-001 Phase 2 (API Server extraction) is complete.

---

## Effort Estimation

**Total Estimated Effort**: 29-37 hours

| Milestone | Effort | Priority |
|-----------|--------|----------|
| M1: DDL Migration + Indexes | 3-4 hours | High |
| M2: Effective Views + SQL Queries | 5-6 hours | High |
| M3: API Endpoints | 8-10 hours | High |
| M4: ACB Integration | 4-5 hours | High |
| M5: Testing | 6-8 hours | Medium |
| M6: Documentation & Operations | 3-4 hours | Low |

**Recommended Sequence**:
1. M1 → M2 → M3 → M4 (core implementation, 20-25 hours)
2. M5 (testing, 6-8 hours)
3. M6 (documentation, 3-4 hours)

**Critical Path**: M1 → M2 → M3 → M4 → M5

---

## Definition of Done

A milestone is considered complete when:

1. All tasks in milestone are implemented
2. All unit tests pass
3. All integration tests pass
4. Code review completed and approved
5. Documentation updated (if applicable)
6. Performance benchmarks meet targets
7. No known critical bugs

**SPEC is complete when**:
1. All milestones M1-M5 are complete
2. All acceptance criteria in acceptance.md are satisfied
3. Performance targets validated (p95 latency)
4. Security review passed
5. API documentation published
6. Operations runbook created

---

**Plan Owner**: Backend Team
**Last Updated**: 2026-02-10
**Next Review**: After Milestone M2 completion (Effective Views + SQL Queries)
