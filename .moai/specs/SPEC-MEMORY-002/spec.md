# SPEC-MEMORY-002: Memory Surgery & Capsule Transfer System

**SPEC ID:** SPEC-MEMORY-002
**Title:** Memory Surgery & Capsule Transfer System
**Status:** Planned
**Priority:** High
**Created:** 2026-02-10
**Updated:** 2026-02-10
**Assigned:** Backend Team
**Lifecycle Level:** spec-anchored

---

## TAG BLOCK

**Tags:** memory-surgery, capsule-transfer, scope-subject, memory-governance, audit-trail
**Related SPECs:** SPEC-ARCH-001
**Epic:** Memory Management & Governance

---

## Environment

### Current State
The Agent Memory System v2.0 currently provides:

- **Basic event storage**: Events, chunks, decisions, tasks stored in PostgreSQL
- **Simple retrieval**: Full-text search, timeline queries, ACB building
- **No scoped queries**: All queries operate on entire tenant dataset
- **No memory editing**: Once written, memory cannot be modified or retracted
- **No inter-agent sharing**: Agents cannot share curated memory bundles with other agents
- **No governance controls**: No approval workflow for memory modifications

### Deployment Context
- **Development**: Local Node.js with PostgreSQL 15+
- **Production**: Containerized deployment with managed PostgreSQL
- **Scale**: Multi-tenant system with growing agent populations
- **Operational Context**: Memory consistency critical for agent behavior

### Problem Statement
The current memory system creates several constraints:

1. **No Memory Governance**: Incorrect or sensitive information cannot be removed or corrected
2. **No Scoped Queries**: Cannot retrieve memory for specific subjects (e.g., "Jack") without filtering entire tenant
3. **No Agent-to-Agent Sharing**: Agent A cannot share curated context about a subject with Agent B
4. **No Privacy Controls**: Cannot quarantine sensitive chunks from auto-retrieval
5. **No Audit Trail**: Memory modifications lack traceability (who made change, when, why)
6. **No Importance Adjustment**: Cannot demote incorrect or less important chunks

---

## Assumptions

### Technical Assumptions
- **Confidence: HIGH** - PostgreSQL 15+ supports generated columns and materialized views
- **Confidence: HIGH** - GIN indexes support efficient FTS with edit awareness
- **Confidence: HIGH** - JSONB columns can store flexible patch data for edits
- **Confidence: MEDIUM** - Effective views with edits can be computed without significant performance degradation
- **Confidence: HIGH** - TTL-based capsule expiration can be enforced via scheduled jobs

### Business Assumptions
- **Confidence: HIGH** - Agents need to share context about specific subjects (users, projects, entities)
- **Confidence: HIGH** - Memory correction is required for production use (errors, PII removal)
- **Confidence: MEDIUM** - Approval workflow required for memory edits in production
- **Confidence: HIGH** - Scoped queries reduce memory retrieval latency and improve relevance

### Integration Assumptions
- **Confidence: HIGH** - ACB building can incorporate capsule injection and edit awareness
- **Confidence: MEDIUM** - MCP tools can expose surgery and capsule operations
- **Confidence: HIGH** - Existing chunking pipeline can incorporate scope/subject metadata
- **Confidence: MEDIUM** - Scheduled job system exists for TTL enforcement

### Risk if Wrong
- **Performance degradation**: If effective views are too slow, may need materialized views with refresh strategy
- **Edit complexity**: If edit patching is complex, may limit operations to retract/block only
- **Capsule abuse**: If capsules lack governance, may create memory spam or information leakage
- **Subject ambiguity**: If subject identification is inconsistent, scoped queries may miss relevant data

---

## Requirements (EARS Format)

### Ubiquitous Requirements (System-Wide)

**WHEN** any memory query executes, the system **shall** apply all pending memory edits to results.

**WHEN** any memory is written, the system **shall** record scope, subject_type, subject_id, and project_id metadata.

**WHEN** a memory edit is applied, the system **shall** create an audit record in memory_edits table.

**WHEN** a capsule is created, the system **shall** validate all referenced chunks exist and belong to tenant.

**WHEN** any memory operation occurs, the system **shall** enforce tenant_id isolation.

### Event-Driven Requirements (Trigger-Based)

**WHEN** an event is recorded, the system **shall** extract and store scope, subject_type, subject_id, and project_id from content.

**WHEN** a chunk is created, the system **shall** inherit scope/subject metadata from parent event.

**WHEN** a memory edit is requested, the system **shall** validate edit operation type and apply patch if approved.

**WHEN** a capsule is created, the system **shall** bundle specified memory items with TTL and audience restrictions.

**WHEN** a capsule TTL expires, the system **shall** revoke capsule access automatically.

**WHEN** build_acb is called, the system **shall** inject available capsules and apply memory edits.

### State-Driven Requirements (Conditional)

**IF** query includes subject filter, **THEN** the system **shall** return only memory matching subject_type and subject_id.

**IF** query includes scope filter, **THEN** the system **shall** return only memory matching scope (session/user/project/policy).

**IF** chunk has retracted edit, **THEN** the system **shall** exclude chunk from all query results.

**IF** chunk has quarantine edit, **THEN** the system **shall** exclude chunk from auto-retrieval unless explicit=true.

**IF** chunk has block edit for channel, **THEN** the system **shall** exclude chunk from queries for that channel.

**IF** capsule audience does not include requesting agent, **THEN** the system **shall** deny capsule access.

**IF** memory edit requires approval, **THEN** the system **shall** apply edit only after approved_by is set.

### Unwanted Requirements (Prohibited Behaviors)

The system **shall not** allow memory edits without recording proposed_by, timestamp, and reason.

The system **shall not** allow capsule access to agents outside the audience_agent_ids list.

The system **shall not** allow queries to bypass memory edits and access raw unedited memory.

The system **shall not** allow subjects to be edited after creation (immutable subject identity).

The system **shall not** allow capsules to reference memory from other tenants.

The system **shall not** allow memory_edits records to be deleted (append-only audit trail).

### Optional Requirements (Nice-to-Have)

**WHERE** feasible, the system **should** provide edit preview showing chunk text before/after amend.

**WHERE** feasible, the system **should** provide capsule usage analytics (access count, last accessed).

**WHERE** feasible, the system **should** support bulk memory edit operations.

**WHERE** feasible, the system **should** support capsule forwarding (Agent B can forward to Agent C with audit trail).

---

## Specifications

### Functional Specifications

#### 1. Scope + Subject Framework

**Purpose**: Enable scoped memory queries by session, user, project, or policy for targeted retrieval.

**Schema Changes**:

Add columns to existing tables:

```sql
-- Add to events table
ALTER TABLE events
  ADD COLUMN scope TEXT CHECK (scope IN ('session', 'user', 'project', 'policy', 'global')),
  ADD COLUMN subject_type TEXT,
  ADD COLUMN subject_id TEXT,
  ADD COLUMN project_id TEXT;

-- Add to chunks table
ALTER TABLE chunks
  ADD COLUMN scope TEXT CHECK (scope IN ('session', 'user', 'project', 'policy', 'global')),
  ADD COLUMN subject_type TEXT,
  ADD COLUMN subject_id TEXT,
  ADD COLUMN project_id TEXT;

-- Add to decisions table
ALTER TABLE decisions
  ADD COLUMN scope TEXT CHECK (scope IN ('session', 'user', 'project', 'policy', 'global')),
  ADD COLUMN subject_type TEXT,
  ADD COLUMN subject_id TEXT,
  ADD COLUMN project_id TEXT;

-- Add to tasks table
ALTER TABLE tasks
  ADD COLUMN scope TEXT CHECK (scope IN ('session', 'user', 'project', 'policy', 'global')),
  ADD COLUMN subject_type TEXT,
  ADD COLUMN subject_id TEXT,
  ADD COLUMN project_id TEXT;
```

**Indexes for Filtering**:

```sql
-- Filter by tenant + scope
CREATE INDEX idx_events_tenant_scope_ts
  ON events (tenant_id, scope, ts DESC)
  WHERE scope IS NOT NULL;

CREATE INDEX idx_chunks_tenant_scope_ts
  ON chunks (tenant_id, scope, ts DESC)
  WHERE scope IS NOT NULL;

-- Filter by tenant + project
CREATE INDEX idx_events_tenant_project_ts
  ON events (tenant_id, project_id, ts DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX idx_chunks_tenant_project_ts
  ON chunks (tenant_id, project_id, ts DESC)
  WHERE project_id IS NOT NULL;

-- Filter by tenant + subject (composite)
CREATE INDEX idx_events_tenant_subject_ts
  ON events (tenant_id, subject_type, subject_id, ts DESC)
  WHERE subject_type IS NOT NULL AND subject_id IS NOT NULL;

CREATE INDEX idx_chunks_tenant_subject_ts
  ON chunks (tenant_id, subject_type, subject_id, ts DESC)
  WHERE subject_type IS NOT NULL AND subject_id IS NOT NULL;
```

**Scope Semantics**:

- `session`: Memory relevant to current conversation session (session_id)
- `user`: Memory about a specific user (subject_id = user_id)
- `project`: Memory relevant to project (project_id)
- `policy`: Memory about decision/policy (decision_id)
- `global`: Memory relevant to all contexts (no subject filtering)

**Query Patterns**:

```sql
-- Get all memory about subject Jack
SELECT * FROM chunks
WHERE tenant_id = $1
  AND subject_type = 'user'
  AND subject_id = 'jack-user-id';

-- Get all project memory
SELECT * FROM chunks
WHERE tenant_id = $1
  AND project_id = 'project-123';

-- Get session-scoped memory
SELECT * FROM chunks
WHERE tenant_id = $1
  AND scope = 'session'
  AND session_id = 'session-456';
```

#### 2. Capsule Transfer System

**Purpose**: Enable Agent A to create curated memory bundles and share with Agent B for specific subjects.

**Schema**:

```sql
CREATE TABLE capsules (
  capsule_id        TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  ts                TIMESTAMPTZ NOT NULL DEFAULT now(),
  scope             TEXT NOT NULL CHECK (scope IN ('session', 'user', 'project', 'policy', 'global')),
  subject_type      TEXT NOT NULL,
  subject_id        TEXT NOT NULL,
  project_id        TEXT,
  author_agent_id   TEXT NOT NULL,
  ttl_days          INT NOT NULL DEFAULT 7,
  status            TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')) DEFAULT 'active',
  audience_agent_ids TEXT[] NOT NULL,
  items             JSONB NOT NULL, -- {chunks: [], decisions: [], artifacts: []}
  risks             TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL
);

-- Indexes
CREATE INDEX idx_capsules_tenant_subject
  ON capsules (tenant_id, subject_type, subject_id, status)
  WHERE status = 'active';

CREATE INDEX idx_capsules_audience
  ON capsules (tenant_id, status)
  WHERE status = 'active';

CREATE INDEX idx_capsules_expires
  ON capsules (tenant_id, status, expires_at)
  WHERE status = 'active';

-- Foreign key validation
ALTER TABLE capsules ADD CONSTRAINT fk_capsule_author
  FOREIGN KEY (author_agent_id) REFERENCES users(user_id) ON DELETE RESTRICT;
```

**API Operations**:

```typescript
interface CreateCapsuleRequest {
  subject_type: string;
  subject_id: string;
  scope: 'session' | 'user' | 'project' | 'policy' | 'global';
  project_id?: string;
  audience_agent_ids: string[];
  items: {
    chunks: string[];      // chunk_ids
    decisions: string[];   // decision_ids
    artifacts: string[];   // artifact_ids
  };
  ttl_days?: number;
  risks?: string[];
}

interface CapsuleResponse {
  capsule_id: string;
  status: 'active' | 'revoked' | 'expired';
  expires_at: Date;
  item_count: number;
}
```

**Use Case Example**:

Agent A working on customer support for user "Jack" creates a capsule:

```json
{
  "subject_type": "user",
  "subject_id": "jack-user-id",
  "scope": "user",
  "audience_agent_ids": ["agent-b-id", "agent-c-id"],
  "items": {
    "chunks": ["chunk-1", "chunk-2", "chunk-3"],
    "decisions": ["decision-1"],
    "artifacts": []
  },
  "ttl_days": 7,
  "risks": ["Jack has elevated support tier", "Recent complaint about billing"]
}
```

Agent B queries available capsules:

```sql
SELECT * FROM capsules
WHERE tenant_id = $1
  AND status = 'active'
  AND expires_at > now()
  AND $2 = ANY(audience_agent_ids)
  AND subject_type = $3
  AND subject_id = $4;
```

#### 3. Memory Surgery Operations

**Purpose**: Enable memory governance with retract, amend, quarantine, attenuate, and block operations.

**Schema**:

```sql
CREATE TABLE memory_edits (
  edit_id         TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  ts              TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_type     TEXT NOT NULL CHECK (target_type IN ('chunk', 'decision', 'capsule')),
  target_id       TEXT NOT NULL,
  op              TEXT NOT NULL CHECK (op IN ('retract', 'amend', 'quarantine', 'attenuate', 'block')),
  reason          TEXT NOT NULL,
  proposed_by     TEXT NOT NULL CHECK (proposed_by IN ('human', 'agent')),
  approved_by     TEXT,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  patch           JSONB NOT NULL, -- {text?: string, importance_delta?: number, channel?: string}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at      TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_edits_tenant_target
  ON memory_edits (tenant_id, target_type, target_id, status)
  WHERE status = 'approved';

CREATE INDEX idx_edits_tenant_status
  ON memory_edits (tenant_id, status, applied_at);

-- Foreign key
ALTER TABLE memory_edits ADD CONSTRAINT fk_edit_proposer
  FOREIGN KEY (proposed_by) REFERENCES users(user_id) ON DELETE RESTRICT;

ALTER TABLE memory_edits ADD CONSTRAINT fk_edit_approver
  FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL;
```

**Operation Semantics**:

**retract**: Exclude from ALL queries (hard delete without data loss)

```json
{
  "op": "retract",
  "reason": "PII violation - contains social security number",
  "proposed_by": "human",
  "patch": {}
}
```

**amend**: Replace text and optionally importance

```json
{
  "op": "amend",
  "reason": "Correct customer name from Jon to John",
  "proposed_by": "agent",
  "patch": {
    "text": "John Doe called regarding billing issue",
    "importance": 0.8
  }
}
```

**quarantine**: Exclude from auto-retrieval unless explicit=true

```json
{
  "op": "quarantine",
  "reason": "Unverified information awaiting fact check",
  "proposed_by": "human",
  "patch": {}
}
```

**attenuate**: Reduce importance score (delta or absolute set)

```json
{
  "op": "attenuate",
  "reason": "Lower priority - resolved issue",
  "proposed_by": "agent",
  "patch": {
    "importance_delta": -0.5
    // or "importance": 0.2
  }
}
```

**block**: Exclude if channel matches blocked list

```json
{
  "op": "block",
  "reason": "Internal discussion not for public channels",
  "proposed_by": "human",
  "patch": {
    "channel": "public"
  }
}
```

**Governance Workflow**:

1. Agent or human proposes edit via API
2. System validates edit operation and target exists
3. If approval required, status=pending
4. Approver reviews and sets approved_by, status=approved
5. System applies edit and sets applied_at timestamp
6. All subsequent queries apply approved edits

#### 4. Enhanced SQL Queries

**Effective Chunks View**:

```sql
CREATE OR REPLACE VIEW effective_chunks AS
WITH edits_applied AS (
  SELECT
    c.chunk_id,
    c.text,
    c.importance,
    c.channel,
    c.tenant_id,
    -- Apply amend text
    COALESCE(e.patch->>'text', c.text) as effective_text,
    -- Apply attenuate importance
    CASE
      WHEN e.op = 'attenuate' AND e.patch->>'importance' IS NOT NULL
        THEN (e.patch->>'importance')::REAL
      WHEN e.op = 'attenuate' AND e.patch->>'importance_delta' IS NOT NULL
        THEN c.importance + (e.patch->>'importance_delta')::REAL
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
    ) as blocked_channels
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
  effective_text as text,
  effective_importance as importance,
  channel,
  scope,
  subject_type,
  subject_id,
  project_id,
  is_retracted,
  is_quarantined,
  blocked_channels,
  ts
FROM edits_applied
WHERE NOT is_retracted;
```

**FTS Search with Scope + Subject + Edit Awareness**:

```sql
-- Search function
CREATE OR REPLACE FUNCTION search_chunks(
  p_tenant_id TEXT,
  p_query TEXT,
  p_scope TEXT DEFAULT NULL,
  p_subject_type TEXT DEFAULT NULL,
  p_subject_id TEXT DEFAULT NULL,
  p_project_id TEXT DEFAULT NULL,
  p_include_quarantined BOOLEAN DEFAULT FALSE,
  p_channel TEXT DEFAULT NULL
) RETURNS TABLE (
  chunk_id TEXT,
  text TEXT,
  importance REAL,
  ts TIMESTAMPTZ,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.chunk_id,
    ec.text,
    ec.importance,
    ec.ts,
    ts_rank(ec.tsv, query) as rank
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
  ORDER BY rank DESC, ec.importance DESC, ec.ts DESC;
END;
$$ LANGUAGE plpgsql;
```

**Timeline Query**:

```sql
CREATE OR REPLACE FUNCTION get_timeline(
  p_tenant_id TEXT,
  p_around_chunk_id TEXT,
  p_window_seconds INT DEFAULT 3600,
  p_include_quarantined BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
  chunk_id TEXT,
  text TEXT,
  ts TIMESTAMPTZ,
  distance_seconds INT
) AS $$
DECLARE
  v_center_ts TIMESTAMPTZ;
BEGIN
  SELECT ts INTO v_center_ts
  FROM chunks
  WHERE chunk_id = p_around_chunk_id;

  RETURN QUERY
  SELECT
    ec.chunk_id,
    ec.text,
    ec.ts,
    EXTRACT(EPOCH FROM (ec.ts - v_center_ts))::INT as distance_seconds
  FROM effective_chunks ec
  WHERE ec.tenant_id = p_tenant_id
    AND ec.ts BETWEEN (v_center_ts - (p_window_seconds || ' seconds')::INTERVAL)
                    AND (v_center_ts + (p_window_seconds || ' seconds')::INTERVAL)
    AND (p_include_quarantined OR NOT ec.is_quarantined)
  ORDER BY ABS(EXTRACT(EPOCH FROM (ec.ts - v_center_ts))) ASC;
END;
$$ LANGUAGE plpgsql;
```

**Active Decisions by Precedence**:

```sql
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
  precedence INT
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
    END as precedence
  FROM decisions d
  WHERE d.tenant_id = p_tenant_id
    AND d.status = 'active'
    AND (p_scope IS NULL OR d.scope = p_scope)
    AND (p_project_id IS NULL OR d.project_id = p_project_id)
    AND (p_subject_id IS NULL OR d.subject_id = p_subject_id)
  ORDER BY precedence DESC, d.ts DESC;
END;
$$ LANGUAGE plpgsql;
```

**Capsules Query**:

```sql
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
  expires_at TIMESTAMPTZ
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
    c.expires_at
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
```

#### 5. API Endpoints

**record_event() - with scope+subject**:

```typescript
POST /api/v1/events

interface RecordEventRequest {
  session_id: string;
  channel: 'private' | 'public' | 'team' | 'agent';
  actor_type: 'human' | 'agent' | 'tool';
  actor_id: string;
  kind: 'message' | 'tool_call' | 'tool_result' | 'decision' | 'task_update' | 'artifact';
  sensitivity?: 'none' | 'low' | 'high' | 'secret';
  tags?: string[];
  content: {
    text?: string;
    scope?: 'session' | 'user' | 'project' | 'policy' | 'global';
    subject_type?: string;
    subject_id?: string;
    project_id?: string;
    // ... other content fields
  };
  refs?: string[];
}

interface RecordEventResponse {
  event_id: string;
  ts: Date;
  status: 'recorded';
}
```

**search() - with edits-aware query**:

```typescript
POST /api/v1/chunks/search

interface SearchRequest {
  query: string;
  scope?: 'session' | 'user' | 'project' | 'policy' | 'global';
  subject_type?: string;
  subject_id?: string;
  project_id?: string;
  include_quarantined?: boolean;
  channel?: 'private' | 'public' | 'team' | 'agent';
  limit?: number;
}

interface SearchResponse {
  chunks: Array<{
    chunk_id: string;
    text: string;
    importance: number;
    ts: Date;
    rank: number;
    edits_applied: number;
  }>;
  total_count: number;
}
```

**timeline() - bounded window**:

```typescript
GET /api/v1/chunks/:chunk_id/timeline?window_seconds=3600

interface TimelineResponse {
  around_chunk_id: string;
  center_ts: Date;
  window_seconds: number;
  chunks: Array<{
    chunk_id: string;
    text: string;
    ts: Date;
    distance_seconds: number;
  }>;
}
```

**get_chunks() - apply edits + block**:

```typescript
POST /api/v1/chunks/get

interface GetChunksRequest {
  chunk_ids: string[];
  include_quarantined?: boolean;
  channel?: 'private' | 'public' | 'team' | 'agent';
}

interface GetChunksResponse {
  chunks: Array<{
    chunk_id: string;
    text: string;
    importance: number;
    is_retracted: boolean;
    is_quarantined: boolean;
    edits_applied: number;
  }>;
}
```

**save_memory() - summary_observation with scope/user+subject**:

```typescript
POST /api/v1/chunks/summary

interface SummaryObservationRequest {
  text: string;
  scope: 'user' | 'project' | 'session';
  subject_type: string;
  subject_id: string;
  project_id?: string;
  importance?: number;
  tags?: string[];
  session_id: string;
  channel: 'private' | 'public' | 'team' | 'agent';
}

interface SummaryObservationResponse {
  chunk_id: string;
  ts: Date;
  status: 'saved';
}
```

**create_capsule()**:

```typescript
POST /api/v1/capsules

interface CreateCapsuleRequest {
  subject_type: string;
  subject_id: string;
  scope: 'session' | 'user' | 'project' | 'policy' | 'global';
  project_id?: string;
  audience_agent_ids: string[];
  items: {
    chunks: string[];
    decisions: string[];
    artifacts: string[];
  };
  ttl_days?: number;
  risks?: string[];
}

interface CreateCapsuleResponse {
  capsule_id: string;
  status: 'active';
  expires_at: Date;
}
```

**revoke_capsule()**:

```typescript
DELETE /api/v1/capsules/:capsule_id

interface RevokeCapsuleResponse {
  capsule_id: string;
  status: 'revoked';
  revoked_at: Date;
}
```

**apply_memory_edit()**:

```typescript
POST /api/v1/edits

interface ApplyMemoryEditRequest {
  target_type: 'chunk' | 'decision' | 'capsule';
  target_id: string;
  op: 'retract' | 'amend' | 'quarantine' | 'attenuate' | 'block';
  reason: string;
  patch: {
    text?: string;
    importance?: number;
    importance_delta?: number;
    channel?: string;
  };
}

interface ApplyMemoryEditResponse {
  edit_id: string;
  status: 'approved' | 'pending';
  applied_at?: Date;
}
```

**build_acb() - combine all above**:

```typescript
POST /api/v1/acb/build

interface BuildACBRequest {
  session_id: string;
  channel: 'private' | 'public' | 'team' | 'agent';
  subject_type?: string;
  subject_id?: string;
  project_id?: string;
  include_capsules?: boolean;
  include_quarantined?: boolean;
  max_tokens?: number;
}

interface BuildACBResponse {
  acb: {
    session: {
      events: Event[];
      chunks: Chunk[];
    };
    active_decisions: Decision[];
    active_tasks: Task[];
    capsules: Capsule[];
    edits_applied: number;
    total_tokens: number;
  };
}
```

### Non-Functional Specifications

#### Performance

- **Effective chunks view**: p95 latency ≤ 200ms for 1000 chunks
- **FTS search with edits**: p95 latency ≤ 300ms for top 50 results
- **Capsule creation**: p95 latency ≤ 100ms
- **Memory edit application**: p95 latency ≤ 150ms
- **ACB building with capsules**: p95 latency ≤ 500ms

#### Scalability

- Support 100K+ memory edits per tenant without performance degradation
- Support 10K+ active capsules per tenant
- Indexes maintain query performance with 10M+ chunks
- TTL expiration job completes within maintenance window

#### Security

- All memory edits require authentication and authorization
- Capsule access strictly limited to audience_agent_ids list
- Audit trail for all memory edits (immutable)
- No memory edit can bypass approval workflow if configured
- Tenant isolation enforced across all operations

#### Maintainability

- Clear edit operation semantics (retract, amend, quarantine, attenuate, block)
- Comprehensive audit trail for governance
- Indexes support query performance without manual tuning
- Materialized view option if effective view performance degrades

#### Availability

- Memory edits apply atomically (no partial application)
- Capsule TTL expiration job has retry logic
- Effective queries handle missing edits gracefully
- No single point of failure in edit application path

---

## Data Architecture

### Database Schema Summary

**New Tables**:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `capsules` | Memory bundles for agent-to-agent sharing | capsule_id, audience_agent_ids, items, expires_at |
| `memory_edits` | Audit trail for memory modifications | edit_id, target_type, target_id, op, status, patch |

**Schema Changes**:

| Table | New Columns |
|-------|-------------|
| `events` | scope, subject_type, subject_id, project_id |
| `chunks` | scope, subject_type, subject_id, project_id |
| `decisions` | scope, subject_type, subject_id, project_id |
| `tasks` | scope, subject_type, subject_id, project_id |

**New Indexes**:

| Index | Purpose | Pattern |
|-------|---------|---------|
| `idx_events_tenant_scope_ts` | Filter by tenant+scope | Partial index on scope NOT NULL |
| `idx_events_tenant_project_ts` | Filter by tenant+project | Partial index on project_id NOT NULL |
| `idx_events_tenant_subject_ts` | Filter by tenant+subject | Composite on subject_type+subject_id |
| `idx_chunks_tenant_scope_ts` | Filter chunks by scope | Partial index on scope NOT NULL |
| `idx_chunks_tenant_project_ts` | Filter chunks by project | Partial index on project_id NOT NULL |
| `idx_chunks_tenant_subject_ts` | Filter chunks by subject | Composite on subject_type+subject_id |
| `idx_capsules_tenant_subject` | Query capsules by subject | Composite on subject_type+subject_id+status |
| `idx_capsules_audience` | Query capsules by audience | Partial index on status='active' |
| `idx_edits_tenant_target` | Apply edits by target | Composite on target_type+target_id+status |
| `idx_edits_tenant_status` | Audit pending edits | Composite on status+applied_at |

**New Views**:

| View | Purpose | Query Pattern |
|------|---------|---------------|
| `effective_chunks` | Apply all edits to chunks | LATERAL JOIN with latest edit per chunk |
| `search_chunks()` | FTS with edit awareness | Function using effective_chunks |
| `get_timeline()` | Time-bounded query | Function using effective_chunks |
| `get_active_decisions()` | Precedence-based decisions | Function with precedence ordering |
| `get_available_capsules()` | Audience-filtered capsules | Function with audience check |

### Edit Application Order

**Edit Precedence** (highest to lowest):

1. **retract**: Always exclude (highest priority)
2. **block**: Exclude if channel matches
3. **quarantine**: Exclude from auto-retrieval
4. **amend**: Replace text/importance
5. **attenuate**: Reduce importance

**Edit Application Logic**:

```
FOR each chunk in query:
  APPLY latest edit by applied_at timestamp
  IF edit.op = 'retract': EXCLUDE from results
  IF edit.op = 'block' AND query.channel IN edit.blocked_channels: EXCLUDE
  IF edit.op = 'quarantine' AND NOT query.include_quarantined: EXCLUDE
  IF edit.op = 'amend': REPLACE text and/or importance
  IF edit.op = 'attenuate': REDUCE importance (delta or absolute)
RETURN chunk
```

---

## Traceability

**TAG**: SPEC-MEMORY-002

**Requirements Traceability**:
- Scope + Subject Framework → Acceptance Criteria A1-A5
- Capsule Transfer System → Acceptance Criteria A6-A10
- Memory Surgery Operations → Acceptance Criteria A11-A15
- Enhanced SQL Queries → Acceptance Criteria A16-A20
- API Endpoints → Acceptance Criteria A21-A25

**Implementation Traceability**:
- Phase 1 (DDL migration + indexes) → Plan.md Milestone M1
- Phase 2 (Effective views + SQL queries) → Plan.md Milestone M2
- Phase 3 (API endpoints) → Plan.md Milestone M3
- Phase 4 (ACB integration) → Plan.md Milestone M4
- Phase 5 (Testing) → Plan.md Milestone M5

**Test Coverage**:
- All EARS requirements mapped to acceptance test scenarios
- Performance requirements validated via load testing
- Security requirements validated via penetration testing
- Edit operation semantics validated via integration tests

---

## Success Criteria

The Memory Surgery & Capsule Transfer System is considered successful when:

1. Scope + subject metadata is automatically extracted and stored on all new memory
2. Queries can filter by scope, subject, or project with < 200ms p95 latency
3. Capsules can be created and shared between agents with proper audience enforcement
4. Memory edits (retract, amend, quarantine, attenuate, block) can be applied via API
5. All memory queries automatically apply approved edits without manual intervention
6. Effective chunks view returns edited content (amended text, attenuated importance)
7. Quarantined chunks excluded from auto-retrieval but available with explicit=true
8. Retracted chunks never appear in any query results
9. Capsule TTL expiration revokes access automatically
10. Memory edit audit trail is append-only and immutable
11. ACB building includes relevant capsules and applies all edits
12. FTS search respects scope, subject, and edit filters
13. Timeline queries include edited chunk content
14. Performance targets met for all new query patterns
15. All acceptance criteria satisfied

---

**Document Owner**: Backend Team
**Review Cycle**: Weekly during implementation phase
**Next Review**: After Phase 1 completion (DDL migration + indexes)
