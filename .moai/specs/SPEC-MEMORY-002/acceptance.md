# Acceptance Criteria: SPEC-MEMORY-002

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

## Acceptance Criteria Summary

### Scope + Subject Framework
- **A1**: Events and chunks automatically extract and store scope+subject metadata
- **A2**: Queries can filter by scope (session, user, project, policy, global)
- **A3**: Queries can filter by subject (subject_type + subject_id)
- **A4**: Queries can filter by project_id
- **A5**: Indexes enable sub-200ms query performance for scope/subject filters

### Capsule Transfer System
- **A6**: Agents can create capsules with curated memory items
- **A7**: Capsules enforce audience restrictions (only listed agents can access)
- **A8**: Capsules automatically expire after TTL
- **A9**: ACB building injects available capsules for subject
- **A10**: Capsule revocation prevents further access

### Memory Surgery Operations
- **A11**: Retract operation excludes chunks from all queries
- **A12**: Amend operation replaces text and/or importance
- **A13**: Quarantine operation excludes from auto-retrieval only
- **A14**: Attenuate operation reduces importance score
- **A15**: Block operation excludes by channel

### Enhanced SQL Queries
- **A16**: Effective chunks view applies all approved edits
- **A17**: FTS search respects scope, subject, and edit filters
- **A18**: Timeline query includes edited chunk content
- **A19**: Active decisions query respects precedence (policy > project > user)
- **A20**: Capsules query filters by audience and expiration

### API Endpoints
- **A21**: record_event() extracts and stores scope+subject metadata
- **A22**: search() returns edited chunks with amend/attenuate applied
- **A23**: timeline() returns time-bounded chunks with edits
- **A24**: get_chunks() applies edits and blocks by channel
- **A25**: build_acb() includes capsules and applies edits

---

## Gherkin Scenarios

### Feature: Scope + Subject Framework

#### Scenario A1: Automatic scope+subject extraction on event recording
```gherkin
GIVEN a tenant "acme-corp" exists
AND an agent "support-agent" exists
WHEN the agent records an event with content:
  """
  {
    "text": "Jack Doe called regarding billing issue",
    "subject_type": "user",
    "subject_id": "jack-doe-123",
    "scope": "user",
    "project_id": null
  }
  """
THEN the event is stored with scope="user"
AND the event is stored with subject_type="user"
AND the event is stored with subject_id="jack-doe-123"
AND chunks created from the event inherit the same scope+subject metadata
```

#### Scenario A2: Query memory by scope
```gherkin
GIVEN tenant "acme-corp" has 100 chunks with scope="user"
AND 50 chunks with scope="project"
AND 25 chunks with scope="global"
WHEN a query filters by scope="user"
THEN exactly 100 chunks are returned
AND all returned chunks have scope="user"
AND the query completes in < 200ms
```

#### Scenario A3: Query memory by subject
```gherkin
GIVEN tenant "acme-corp" has 50 chunks about user "jack-doe-123"
AND 30 chunks about user "jane-smith-456"
WHEN a query filters by subject_type="user" AND subject_id="jack-doe-123"
THEN exactly 50 chunks are returned
AND all returned chunks have subject_id="jack-doe-123"
AND the query completes in < 200ms
```

#### Scenario A4: Query memory by project
```gherkin
GIVEN tenant "acme-corp" has 75 chunks with project_id="project-alpha"
AND 40 chunks with project_id="project-beta"
WHEN a query filters by project_id="project-alpha"
THEN exactly 75 chunks are returned
AND all returned chunks have project_id="project-alpha"
AND the query completes in < 200ms
```

#### Scenario A5: Index performance validation
```gherkin
GIVEN tenant "acme-corp" has 1,000,000 chunks
WITH diverse scope, subject, and project combinations
WHEN EXPLAIN ANALYZE is run on a query filtering by tenant+scope+subject
THEN the query plan uses index "idx_chunks_tenant_scope_ts" OR "idx_chunks_tenant_subject_ts"
AND the query executes in < 200ms for p95
```

---

### Feature: Capsule Transfer System

#### Scenario A6: Agent A creates capsule for Agent B about Jack
```gherkin
GIVEN tenant "acme-corp" exists
AND agent "agent-alice" exists
AND agent "agent-bob" exists
AND 10 chunks exist about user "jack-doe-123"
AND 2 decisions exist for project "project-alpha"
WHEN agent-alice creates a capsule with:
  - subject_type="user"
  - subject_id="jack-doe-123"
  - audience_agent_ids=["agent-bob"]
  - items = {chunks: ["chunk-1", "chunk-2"], decisions: ["decision-1"]}
  - ttl_days=7
THEN the capsule is created with status="active"
AND the capsule expires_at is 7 days from now
AND the capsule contains the specified chunks and decisions
AND the capsule is owned by agent-alice
```

#### Scenario A7: Agent B retrieves capsule shared by Agent A
```gherkin
GIVEN a capsule exists with:
  - audience_agent_ids=["agent-bob"]
  - subject_type="user"
  - subject_id="jack-doe-123"
  - status="active"
  - expires_at = 7 days from now
WHEN agent-bob queries available capsules for subject "jack-doe-123"
THEN the capsule is returned in results
AND the capsule items are accessible
AND the capsule metadata includes author="agent-alice"
AND the capsule metadata includes risks array
```

#### Scenario A8: Audience enforcement - Agent C cannot access Agent A's capsule
```gherkin
GIVEN a capsule exists with:
  - audience_agent_ids=["agent-bob"] (does NOT include "agent-charlie")
  - status="active"
  - expires_at = 7 days from now
WHEN agent-charlie attempts to retrieve the capsule
THEN HTTP 403 Forbidden is returned
AND error message indicates insufficient permissions
AND no capsule content is exposed
```

#### Scenario A9: Capsule TTL expiration
```gherkin
GIVEN a capsule exists with:
  - status="active"
  - expires_at = 2 days ago
  - audience_agent_ids=["agent-bob"]
WHEN the scheduled TTL expiration job runs
THEN the capsule status is updated to "expired"
WHEN agent-bob queries available capsules
THEN the expired capsule is NOT returned
```

#### Scenario A10: Capsule revocation
```gherkin
GIVEN a capsule exists with:
  - capsule_id="capsule-123"
  - status="active"
  - audience_agent_ids=["agent-bob", "agent-charlie"]
  - expires_at = 7 days from now
WHEN agent-alice revokes the capsule
THEN the capsule status is updated to "revoked"
AND the revocation timestamp is recorded
AND agent-bob cannot retrieve the capsule (404 or 403)
AND agent-charlie cannot retrieve the capsule (404 or 403)
```

---

### Feature: Memory Surgery Operations

#### Scenario A11: Retract operation excludes chunk from queries
```gherkin
GIVEN tenant "acme-corp" has a chunk with:
  - chunk_id="chunk-sensitive"
  - text="This contains PII: SSN 123-45-6789"
AND 10 other chunks exist
WHEN a human applies retract edit to chunk-sensitive with reason="PII violation"
THEN the edit is recorded in memory_edits with op="retract"
AND the edit status="approved"
AND the edit applied_at timestamp is set
WHEN a query searches for chunks with keyword "SSN"
THEN chunk-sensitive is NOT in results
AND the other 10 chunks are returned (unchanged)
```

#### Scenario A12: Amend operation replaces chunk text and importance
```gherkin
GIVEN tenant "acme-corp" has a chunk with:
  - chunk_id="chunk-typo"
  - text="Jon Doe called about billing"
  - importance=0.5
WHEN an agent applies amend edit with:
  - patch.text="John Doe called about billing"
  - patch.importance=0.8
  - reason="Correct customer name spelling"
THEN the edit is recorded in memory_edits with op="amend"
AND the edit contains the patch data
WHEN a query retrieves chunk-typo
THEN the returned text is "John Doe called about billing"
AND the returned importance is 0.8
AND the original chunk record is unchanged in chunks table
```

#### Scenario A13: Quarantine operation excludes from auto-retrieval only
```gherkin
GIVEN tenant "acme-corp" has a chunk with:
  - chunk_id="chunk-unverified"
  - text="Rumor about company merger"
AND the chunk is included in recent search results
WHEN a human applies quarantine edit with reason="Unverified, awaiting fact check"
THEN the edit is recorded in memory_edits with op="quarantine"
WHEN auto-retrieval query executes (include_quarantined=false)
THEN chunk-unverified is NOT in results
WHEN explicit query executes (include_quarantined=true)
THEN chunk-unverified IS in results
AND the chunk is marked with is_quarantined=true
```

#### Scenario A14: Attenuate operation reduces importance score
```gherkin
GIVEN tenant "acme-corp" has a chunk with:
  - chunk_id="chunk-outdated"
  - text="Server will be down for maintenance on Jan 15"
  - importance=0.9
WHEN an agent applies attenuate edit with:
  - patch.importance_delta=-0.5
  - reason="Issue is resolved, lower priority"
THEN the edit is recorded in memory_edits with op="attenuate"
WHEN a query retrieves chunks ordered by importance
THEN chunk-outdated is returned with importance=0.4
AND chunk-outdated appears lower in results (due to reduced importance)
```

#### Scenario A15: Block operation excludes by channel
```gherkin
GIVEN tenant "acme-corp" has a chunk with:
  - chunk_id="chunk-internal"
  - text="Internal discussion about product pricing"
  - channel="team"
WHEN a human applies block edit with:
  - patch.channel="public"
  - reason="Internal discussion not for public channels"
THEN the edit is recorded in memory_edits with op="block"
AND the patch.channel="public" is stored
WHEN a query executes with channel="public"
THEN chunk-internal is NOT in results
WHEN a query executes with channel="team"
THEN chunk-internal IS in results
```

---

### Feature: Enhanced SQL Queries

#### Scenario A16: Effective chunks view applies all edits
```gherkin
GIVEN tenant "acme-corp" has chunks:
  - chunk-1: text="Original", importance=0.5
  - chunk-2: text="To be retracted", importance=0.7
  - chunk-3: text="To be amended", importance=0.6
AND edits exist:
  - amend on chunk-1: text="Modified", importance=0.8
  - retract on chunk-2
  - attenuate on chunk-3: importance_delta=-0.3
WHEN effective_chunks view is queried
THEN chunk-1 is returned with text="Modified" AND importance=0.8
AND chunk-2 is NOT returned (retracted)
AND chunk-3 is returned with importance=0.3
AND each chunk has is_retracted, is_quarantined, blocked_channels flags
```

#### Scenario A17: FTS search with scope+subject+edit filters
```gherkin
GIVEN tenant "acme-corp" has:
  - 20 chunks about subject "jack-doe-123" with scope="user"
  - 15 chunks about subject "jane-smith-456" with scope="user"
  - 10 chunks with scope="project" containing "billing" keyword
  - 5 chunks quarantined containing "billing" keyword
WHEN search_chunks() is called with:
  - query="billing"
  - subject_type="user"
  - subject_id="jack-doe-123"
  - include_quarantined=false
THEN only chunks about jack-doe-123 are returned
AND quarantined chunks are NOT in results
AND results are ordered by rank, importance, ts
AND the query completes in < 300ms
```

#### Scenario A18: Timeline query with edited content
```gherkin
GIVEN tenant "acme-corp" has chunks:
  - chunk-center: ts="2025-02-10 12:00:00", text="Center event"
  - chunk-before: ts="2025-02-10 11:30:00", text="Before event"
  - chunk-after: ts="2025-02-10 12:30:00", text="After event"
AND chunk-before has amend edit: text="Before event (corrected)"
WHEN get_timeline() is called with:
  - around_chunk_id="chunk-center"
  - window_seconds=3600
THEN chunk-center is in results with distance_seconds=0
AND chunk-before is in results with distance_seconds=-1800
AND chunk-after is in results with distance_seconds=1800
AND chunk-before text is "Before event (corrected)" (amend applied)
AND results are ordered by absolute distance from center
```

#### Scenario A19: Active decisions by precedence
```gherkin
GIVEN tenant "acme-corp" has decisions:
  - policy-decision: scope="policy", ts="2025-01-01", decision="All agents must log actions"
  - project-decision: scope="project", project_id="proj-1", ts="2025-02-01", decision="Project uses TypeScript"
  - user-decision: scope="user", subject_id="user-1", ts="2025-02-05", decision="User prefers email"
  - session-decision: scope="session", subject_id="sess-1", ts="2025-02-10", decision="Session context"
WHEN get_active_decisions() is called with subject_id="user-1"
THEN decisions are returned in order:
  1. policy-decision (precedence=4)
  2. project-decision (precedence=3, if user-1 associated with proj-1)
  3. user-decision (precedence=2)
  4. session-decision (precedence=1, if sess-1 associated with user-1)
```

#### Scenario A20: Capsules query with audience and expiration
```gherkin
GIVEN tenant "acme-corp" has capsules:
  - capsule-1: audience=["agent-bob"], expires_tomorrow, status="active", subject="jack-doe-123"
  - capsule-2: audience=["agent-charlie"], expires_next_week, status="active", subject="jack-doe-123"
  - capsule-3: audience=["agent-bob"], expires_yesterday, status="active", subject="jack-doe-123"
  - capsule-4: audience=["agent-bob"], expires_next_week, status="revoked", subject="jack-doe-123"
WHEN get_available_capsules() is called for agent-bob, subject="jack-doe-123"
THEN capsule-1 IS returned (active, not expired, agent in audience)
AND capsule-2 is NOT returned (agent not in audience)
AND capsule-3 is NOT returned (expired)
AND capsule-4 is NOT returned (revoked)
```

---

### Feature: API Endpoints

#### Scenario A21: record_event() extracts and stores scope+subject
```gherkin
GIVEN tenant "acme-corp" exists
AND agent "support-agent" exists
AND session "session-123" exists
WHEN POST /api/v1/events is called with:
  {
    "session_id": "session-123",
    "channel": "private",
    "actor_type": "agent",
    "actor_id": "support-agent",
    "kind": "message",
    "content": {
      "text": "Jack Doe called about billing",
      "scope": "user",
      "subject_type": "user",
      "subject_id": "jack-doe-123"
    }
  }
THEN response status is 201
AND response includes event_id
AND the event is stored with scope="user"
AND the event is stored with subject_type="user"
AND the event is stored with subject_id="jack-doe-123"
AND chunks created from the event inherit the scope+subject metadata
```

#### Scenario A22: search() returns edited chunks
```gherkin
GIVEN tenant "acme-corp" has:
  - chunk-1: text="Incorrect name", importance=0.5
  - chunk-2: text="Correct info", importance=0.7
AND chunk-1 has amend edit: text="Corrected name", importance=0.9
AND chunk-2 has attenuate edit: importance_delta=-0.2
WHEN POST /api/v1/chunks/search is called with:
  {
    "query": "name OR info",
    "include_quarantined": false
  }
THEN response status is 200
AND chunk-1 is returned with text="Corrected name" AND importance=0.9
AND chunk-2 is returned with importance=0.5
AND each chunk includes edits_applied count
AND results are ordered by rank and importance
```

#### Scenario A23: timeline() returns time-bounded chunks with edits
```gherkin
GIVEN tenant "acme-corp" has chunk-center with id "chunk-center"
AND 5 chunks exist within 1 hour before chunk-center
AND 3 chunks exist within 1 hour after chunk-center
AND 2 chunks have amend edits applied
WHEN GET /api/v1/chunks/chunk-center/timeline?window_seconds=3600
THEN response status is 200
AND response includes center_ts timestamp
AND 9 chunks are returned (5 before + 1 center + 3 after, excluding distant chunks)
AND chunks with edits show amended text
AND chunks are ordered by distance_seconds from center
```

#### Scenario A24: get_chunks() applies edits and blocks
```gherkin
GIVEN tenant "acme-corp" has:
  - chunk-1: text="Team discussion", channel="team"
  - chunk-2: text="Team discussion", channel="team"
  - chunk-3: text="Public info", channel="public"
AND chunk-1 has block edit for channel="public"
AND chunk-2 has quarantine edit
WHEN POST /api/v1/chunks/get is called with:
  {
    "chunk_ids": ["chunk-1", "chunk-2", "chunk-3"],
    "channel": "public",
    "include_quarantined": false
  }
THEN response status is 200
AND chunk-1 is NOT returned (blocked for public channel)
AND chunk-2 is NOT returned (quarantined)
AND chunk-3 IS returned
```

#### Scenario A25: build_acb() includes capsules and applies edits
```gherkin
GIVEN tenant "acme-corp" has:
  - 20 session chunks for session-123
  - 5 active decisions
  - 2 active tasks
  - 1 capsule for subject "jack-doe-123" with 3 curated chunks
AND 5 session chunks have amend edits
AND 2 session chunks are quarantined
WHEN POST /api/v1/acb/build is called with:
  {
    "session_id": "session-123",
    "channel": "private",
    "subject_type": "user",
    "subject_id": "jack-doe-123",
    "include_capsules": true,
    "include_quarantined": false
  }
THEN response status is 200
AND response.acb.session.chunks includes 15 chunks (20 - 2 quarantined, 3 edited)
AND response.acb.session.chunks have amended text applied
AND response.acb.active_decisions includes 5 decisions
AND response.acb.active_tasks includes 2 tasks
AND response.acb.capsules includes 1 capsule with 3 curated chunks
AND response.acb.edits_applied = 5
AND response.acb.total_tokens < max_tokens (budget honored)
```

---

## Quality Gates

### Performance Gates
- **PG1**: Scope/subject query p95 latency < 200ms
- **PG2**: FTS search with edits p95 latency < 300ms
- **PG3**: Capsule creation p95 latency < 100ms
- **PG4**: Memory edit application p95 latency < 150ms
- **PG5**: ACB building with capsules p95 latency < 500ms

### Security Gates
- **SG1**: All memory edits require authentication
- **SG2**: Capsule access strictly limited to audience list
- **SG3**: Audit trail is append-only and immutable
- **SG4**: Tenant isolation enforced across all operations
- **SG5**: No memory edit bypasses approval workflow (if configured)

### Data Integrity Gates
- **DG1**: Scope+subject metadata inherited by chunks from events
- **DG2**: Capsules cannot reference other tenants' memory
- **DG3**: Memory edits cannot be deleted (append-only)
- **DG4**: Effective queries always apply approved edits
- **DG5**: Retracted chunks never appear in any query

### Functional Gates
- **FG1**: All 25 acceptance criteria satisfied
- **FG2**: All Gherkin scenarios pass
- **FG3**: All edit operations work correctly (retract, amend, quarantine, attenuate, block)
- **FG4**: Capsule TTL expiration works automatically
- **FG5**: ACB building integrates capsules and edits

---

## Test Execution Plan

### Test Environment Setup
1. Create test tenant "test-corp"
2. Create test agents (agent-alice, agent-bob, agent-charlie)
3. Create test users (jack-doe-123, jane-smith-456)
4. Create test projects (project-alpha, project-beta)
5. Insert test data (events, chunks, decisions, tasks)

### Test Execution Order
1. **Phase 1**: Scope + Subject Framework (A1-A5)
2. **Phase 2**: Capsule Transfer System (A6-A10)
3. **Phase 3**: Memory Surgery Operations (A11-A15)
4. **Phase 4**: Enhanced SQL Queries (A16-A20)
5. **Phase 5**: API Endpoints (A21-A25)

### Test Automation
- Unit tests for SQL functions
- Integration tests for API endpoints
- Performance tests for query latency
- Load tests for scalability validation

### Manual Verification
- Security review for capsule access control
- Audit trail verification for memory edits
- Performance benchmark validation
- Edge case testing (multiple edits per target, etc.)

---

## Definition of Done

**SPEC-MEMORY-002 is complete when**:

1. All 25 acceptance criteria (A1-A25) are satisfied
2. All Gherkin scenarios pass automated tests
3. All performance gates (PG1-PG5) meet targets
4. All security gates (SG1-SG5) are validated
5. All data integrity gates (DG1-DG5) are verified
6. All functional gates (FG1-FG5) are met
7. Code review completed and approved
8. API documentation published
9. Operations runbook created
10. No known critical or high-severity bugs

---

**Acceptance Owner**: Backend Team + QA Team
**Last Updated**: 2026-02-10
**Next Review**: After Milestone M5 completion (Testing)
