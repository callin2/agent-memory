# Agent Memory System v2.0 - Product Requirements Document

**Document Version:** 1.0
**Last Updated:** 2025-02-09
**Status:** Ready for Development

---

## 1. Executive Summary

The Agent Memory System is a PostgreSQL-backed daemon service that enables AI agents to maintain persistent memory across sessions while keeping active LLM context small. The system persists nearly all interactions (messages, tool I/O, decisions) but curates only relevant context (up to 65K tokens) for each LLM API call.

### Key Differentiators
- **Persist Almost Everything**: Full event log with append-only storage
- **Small Active Context**: Curated bundles under strict 65K token budget
- **Multi-Agent Support**: Daemon service serving multiple concurrent agents
- **Fast Curation**: Sub-500ms p95 for context assembly
- **Minimal Codebase**: Leverages PostgreSQL for indexing/retrieval complexity

---

## 2. Problem Statement

### Current Limitations
Modern AI agents lack persistent memory across sessions. Each conversation starts with zero context, requiring users to repeat:
- Project-specific knowledge
- Previously made decisions
- User preferences and constraints
- Historical interactions and outcomes

### Target Users
1. **AI Agent Developers**: Building autonomous agents that need long-term memory
2. **Multi-Agent Systems**: Teams of agents collaborating on complex tasks
3. **Agentic Development Tools**: IDE assistants and coding agents maintaining project context

### Core Challenge
How to persist near-total dialogue/events while keeping active LLM context small enough for:
- Single API call constraints
- Cost control
- Performance optimization
- Maintaining coherence and identity over long time horizons

---

## 3. Goals and Success Metrics

### Primary Goals
| Goal | Description | Success Metric |
|------|-------------|----------------|
| **G1** | Persist almost all dialog + tool I/O | 100% of events stored in append-only log |
| **G2** | Curate small active context | ACB ≤ 65K tokens per call (never exceed) |
| **G3** | Serve multiple agents concurrently | Support 10+ simultaneous agents without degradation |
| **G4** | Fast context assembly | p95 ≤ 500ms for retrieval path |
| **G5** | Minimal codebase | Daemon code < 2000 LOC (delegates complexity to Postgres) |

### Non-Functional Requirements
| Requirement | Target |
|-------------|--------|
| Fast-path ACB (no retrieval) | p95 ≤ 150ms |
| Retrieval-path ACB | p95 ≤ 500ms |
| Cold-cache recovery | ≤ 1500ms |
| Candidate pool size | ≤ 2000 chunks |
| Retrieved chunks | ≤ 200 chunks |
| Max bytes per tool result | 64KB excerpt |

---

## 4. Design Principles

These principles guide all technical decisions:

| Principle | Description |
|-----------|-------------|
| **P1** | **Ground truth is append-only** - Never rewrite primary event logs |
| **P2** | **Derived views are disposable** - Indexes/summaries can be regenerated |
| **P3** | **Active context is a product** - Context assembly is explicit, testable, budgeted |
| **P4** | **Traceability by reference** - Every summary/decision cites source event IDs |
| **P5** | **Least-privilege memory loading** - Public/private separation; sensitive data not loaded by default |
| **P6** | **Human-legible override** - Key memory views are readable/editable (markdown/yaml/json) |
| **P7** | **Determinism where possible** - Memory selection policy is reproducible given inputs |
| **P8** | **Scenario-driven validation** - Every feature satisfies a scenario + measurable outcomes |

---

## 5. Architecture Overview

### 5.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Multiple Agents                          │
│  (Agent A)   (Agent B)   (Agent C)   (Agent D)                  │
└─────┬─────────┬─────────┬─────────┬────────────────────────────┘
      │         │         │         │
      └─────────┴─────────┴─────────┘
                    │
            ┌───────▼────────┐
            │  Memory Daemon │  ← HTTP/REST API
            │   (MCP Server) │
            └───────┬────────┘
                    │
    ┌───────────────┼────────────────┐
    │               │                │
┌───▼────┐   ┌─────▼─────┐   ┌─────▼─────┐
│  Auto  │   │  Context  │   │  Privacy  │
│Chunking│   │Orchestrator│  │  Filter   │
└───┬────┘   └─────┬─────┘   └─────┬─────┘
    │              │               │
    └──────────────┴───────────────┘
                   │
           ┌───────▼────────┐
           │   PostgreSQL   │
           │  - Events      │
           │  - Chunks      │
           │  - Decisions   │
           │  - Tasks       │
           │  - Artifacts   │
           └────────────────┘
```

### 5.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Memory Daemon** | HTTP API server, stateless except DB connection, exposes tools |
| **Recorder** | Writes events to append-only log, triggers chunking |
| **Auto-Chunker** | Extracts text from events, creates chunks with token estimates |
| **Context Orchestrator** | Builds Active Context Bundles per request |
| **Privacy Filter** | Enforces channel-based sensitivity rules |
| **PostgreSQL** | Ground truth storage, FTS indexing, retrieval engine |

---

## 6. Data Model (PostgreSQL DDL)

### 6.1 Schema Overview

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ground truth events (append-only logically)
CREATE TABLE IF NOT EXISTS events (
  event_id     TEXT PRIMARY KEY,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id    TEXT NOT NULL,
  session_id   TEXT NOT NULL,
  channel      TEXT NOT NULL,          -- private|public|team|agent
  actor_type   TEXT NOT NULL,          -- human|agent|tool
  actor_id     TEXT NOT NULL,
  kind         TEXT NOT NULL,          -- message|tool_call|tool_result|decision|task_update|artifact
  sensitivity  TEXT NOT NULL DEFAULT 'none',  -- none|low|high|secret
  tags         TEXT[] NOT NULL DEFAULT '{}',
  content      JSONB NOT NULL,
  refs         TEXT[] NOT NULL DEFAULT '{}'
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_events_tenant_ts
  ON events (tenant_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant_session_ts
  ON events (tenant_id, session_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_tags_gin
  ON events USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_events_content_gin
  ON events USING GIN (content);

-- Retrieval units (excerpts / normalized text)
CREATE TABLE IF NOT EXISTS chunks (
  chunk_id     TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  event_id     TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  ts           TIMESTAMPTZ NOT NULL,
  kind         TEXT NOT NULL,
  channel      TEXT NOT NULL,
  sensitivity  TEXT NOT NULL DEFAULT 'none',
  tags         TEXT[] NOT NULL DEFAULT '{}',
  token_est    INT NOT NULL,
  importance   REAL NOT NULL DEFAULT 0.0,
  text         TEXT NOT NULL,
  tsv          TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);

-- Indexes for chunks
CREATE INDEX IF NOT EXISTS idx_chunks_tenant_ts
  ON chunks (tenant_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_chunks_tenant_kind
  ON chunks (tenant_id, kind);
CREATE INDEX IF NOT EXISTS idx_chunks_tsv_gin
  ON chunks USING GIN (tsv);
CREATE INDEX IF NOT EXISTS idx_chunks_tags_gin
  ON chunks USING GIN (tags);

-- Decisions (first-class, traceable)
CREATE TABLE IF NOT EXISTS decisions (
  decision_id   TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL,         -- active|superseded
  scope         TEXT NOT NULL,         -- project|user|global
  decision      TEXT NOT NULL,
  rationale     TEXT[] NOT NULL DEFAULT '{}',
  constraints   TEXT[] NOT NULL DEFAULT '{}',
  alternatives  TEXT[] NOT NULL DEFAULT '{}',
  consequences  TEXT[] NOT NULL DEFAULT '{}',
  refs          TEXT[] NOT NULL DEFAULT '{}'  -- event_ids or chunk_ids
);

CREATE INDEX IF NOT EXISTS idx_decisions_tenant_status_ts
  ON decisions (tenant_id, status, ts DESC);

-- Tasks (optional but useful for agentic dev)
CREATE TABLE IF NOT EXISTS tasks (
  task_id     TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      TEXT NOT NULL,          -- open|doing|done
  title       TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  refs        TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_ts
  ON tasks (tenant_id, status, ts DESC);

-- Artifacts: store large tool outputs
CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id  TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind         TEXT NOT NULL,         -- tool_output|blob
  bytes        BYTEA,
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  refs         TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_ts
  ON artifacts (tenant_id, ts DESC);
```

### 6.2 Entity Relationships

```
events (1) ──< (N) chunks
  │
  └───> artifacts (for large tool results)

decisions (independent, refs to events/chunks)
tasks (independent, refs to events/chunks)
```

---

## 7. API Specification

### 7.1 Core Write API: `record_event`

The only write API needed. All persistence flows through this endpoint.

**Endpoint:** `POST /api/v1/events`

**Request:**
```json
{
  "tenant_id": "t1",
  "session_id": "s1",
  "channel": "private",
  "actor": {"type": "human", "id": "user"},
  "kind": "message",
  "sensitivity": "none",
  "tags": ["topic:onboarding", "repo:legacy"],
  "content": {
    "text": "what this project for?"
  },
  "refs": []
}
```

**Response:**
```json
{
  "event_id": "evt_01J...",
  "chunk_ids": ["chk_01J..."],
  "created_at": "2025-02-09T10:30:00Z"
}
```

**Side Effects:**
1. Creates event record in `events` table
2. Auto-creates 1+ chunk records in `chunks` table
3. For `tool_result` kind: stores large outputs in `artifacts` if needed
4. Updates FTS indexes automatically

### 7.2 Core Read API: `build_acb`

Builds an Active Context Bundle for the next LLM call.

**Endpoint:** `POST /api/v1/acb/build`

**Request:**
```json
{
  "tenant_id": "t1",
  "session_id": "s1",
  "agent_id": "agentA",
  "channel": "private",
  "intent": "repo_onboarding",
  "query_text": "what this project for?",
  "max_tokens": 65000
}
```

**Response:**
```json
{
  "acb_id": "acb_01J...",
  "budget_tokens": 65000,
  "token_used_est": 18400,
  "sections": [
    {
      "name": "rules",
      "items": [
        {
          "type": "text",
          "text": "(identity/rules text...)",
          "refs": ["view:rules.project"]
        }
      ],
      "token_est": 1200
    },
    {
      "name": "recent_window",
      "items": [
        {
          "type": "text",
          "text": "User: what this project for?",
          "refs": ["evt_01J..."]
        }
      ],
      "token_est": 120
    },
    {
      "name": "retrieved_evidence",
      "items": [
        {
          "type": "text",
          "text": "README excerpt...",
          "refs": ["chk_01J...", "evt_01J..."]
        }
      ],
      "token_est": 9000
    },
    {
      "name": "relevant_decisions",
      "items": [
        {
          "type": "decision",
          "decision_id": "dec_01J...",
          "text": "...",
          "refs": ["evt_..."]
        }
      ],
      "token_est": 800
    }
  ],
  "omissions": [
    {
      "reason": "truncated_tool_output",
      "candidates": ["evt_..."],
      "artifact_id": "art_..."
    }
  ],
  "provenance": {
    "intent": "repo_onboarding",
    "query_terms": ["project", "for"],
    "candidate_pool_size": 800,
    "filters": {
      "sensitivity_allowed": ["none", "low", "high"]
    },
    "scoring": {
      "alpha": 0.6,
      "beta": 0.3,
      "gamma": 0.1
    }
  }
}
```

### 7.3 Optional APIs

| API | Purpose | Required |
|-----|---------|----------|
| `GET /api/v1/artifacts/{id}` | Retrieve full artifact | Optional |
| `POST /api/v1/decisions` | Record decision | Optional (can use event kind=decision) |
| `GET /api/v1/decisions/query` | Query decisions | Optional convenience |
| `POST /api/v1/tasks` | Create/update task | Optional |

### 7.4 Tool Result Normalization

For `kind=tool_result`, the daemon MUST normalize content:

```json
{
  "tool": "fs.read_file",
  "path": "README.md",
  "excerpt_text": "... (up to 64KB)",
  "line_range": [1, 120],
  "truncated": true,
  "artifact_id": "art_01J..."  // present only when truncated
}
```

**Rules:**
- Store excerpt in `events.content.excerpt_text` (≤ 64KB)
- If full output exceeds limit, store bytes in `artifacts.bytes`
- Always include `line_range` for file reads
- Set `truncated: true` when artifact is created

---

## 8. Active Context Bundle (ACB) Structure

### 8.1 Section Budget Allocation

Default 65K budget allocation:

| Section | Max Tokens | Priority | Description |
|---------|------------|----------|-------------|
| `identity` | 1,200 | 10 | Agent identity, role, behavior |
| `rules` | 6,000 | 9 | Project/user/org rules and conventions |
| `task_state` | 3,000 | 8 | Current goal, plan step, constraints |
| `decision_ledger` | 4,000 | 7 | Relevant past decisions |
| `retrieved_evidence` | 28,000 | 6 | Retrieved chunks from episodic memory |
| `recent_window` | 8,000 | 5 | Recent dialogue turns |
| `handoff_packet` | 6,000 | 7 | Multi-agent handoff context |
| `reserve` | 8,800 | - | Headroom for user/tool payloads |
| **Total** | **65,000** | | |

### 8.2 Retrieval Scoring Function

```
score = α * semantic_similarity
      + β * recency_decay
      + γ * importance_score

Where:
- α = 0.6 (semantic relevance from FTS)
- β = 0.3 (recency: exponential decay over time)
- γ = 0.1 (importance: decisions > tasks > messages)
```

**Bounded Retrieval:**
- `candidate_pool_max = 2000` (max chunks considered)
- `retrieved_chunks_max = 200` (max chunks scored)
- Pack by `token_est` until section cap

---

## 9. Privacy and Security

### 9.1 Channel-Based Sensitivity Rules

| Channel | Allowed Sensitivities | Behavior |
|---------|----------------------|----------|
| `public` | `none`, `low` | Excludes preferences, private decisions |
| `private` | `none`, `low`, `high` | Default for 1:1 conversations |
| `team` | `none`, `low`, `high` | Shared within team |
| `agent` | `none`, `low` | Inter-agent communication |

### 9.2 Secret Handling Policy

**v2.0 Recommendation:** Never store secrets.

| Sensitivity | Storage | Loading |
|-------------|---------|---------|
| `secret` | Redacted OR not stored | Never loaded in any channel |
| `high` | Encrypted at rest | Private/team channels only |
| `low` | Plain text | All channels except public |
| `none` | Plain text | All channels |

### 9.3 Multi-Agent Isolation

Every API call MUST include:
- `tenant_id` - Workspace/org isolation
- `session_id` - Conversation scope
- `agent_id` - Agent identity

**All queries MUST filter by `tenant_id`.**

---

## 10. Acceptance Test Scenarios

### Scenario Catalog

| ID | Name | Validates |
|----|------|-----------|
| A1 | Legacy Project Onboarding | P1, P3, P4 - Full workflow |
| A2 | Old Decision Recall | P3, P4 - Long-term retrieval |
| A3 | Decision Supersession | P4 - Traceability |
| A4 | Summary Drift Guard | P2, P4 - Ground truth priority |
| A5 | Task Continuity | P2 - Task state persistence |
| A6 | Multi-Agent Handoff | P3 - Minimal context transfer |
| A7 | Public Channel Suppression | P5 - Least privilege |
| A8 | Secret Handling | P5, P8 - Never store secrets |
| A9 | Fast Path Assembly | NFR - Speed (hotset) |
| A10 | Retrieval Path Bounded | NFR - Speed (FTS) |
| A11 | Cold Cache Recovery | NFR - Rebuildability |
| A12 | Dedupe Prevention | NFR - Token stability |

### Key Scenario: A1 - Legacy Project Onboarding

**Setup:**
- Legacy repo with README.md, package.json, src/ entrypoint
- Empty memory (fresh start)
- Policies: zero-dep, 65K budget

**Steps:**
1. User: "what this project for?"
2. Agent calls `list_root`, `read_file(README.md)`, `read_file(package.json)`
3. Agent synthesizes answer with evidence citations
4. Agent creates optional decision: "Project purpose hypothesis v0.1"

**Assertions:**
- ✅ All events stored (message, tool_calls, tool_results)
- ✅ ACB ≤ 65K tokens
- ✅ Retrieved evidence ≤ 28K tokens
- ✅ Decision has refs to evidence chunks
- ✅ p95 ≤ 500ms

---

## 11. MCP Tool Mapping (Optional)

If exposing via Model Context Protocol:

| Tool Name | Description |
|-----------|-------------|
| `memory.record_event` | Record any event (message, tool_call, tool_result, decision) |
| `memory.build_acb` | Build active context bundle for next LLM call |
| `memory.get_artifact` | Retrieve full artifact (optional) |
| `memory.query_decisions` | Query decision ledger (optional) |

**Transport:** HTTP (for multi-client daemon support)

---

## 12. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] PostgreSQL schema setup
- [ ] Basic event recording (`record_event`)
- [ ] Auto-chunking with token estimation
- [ ] Basic FTS indexing

### Phase 2: Context Assembly (Week 2-3)
- [ ] `build_acb` API implementation
- [ ] Section budget enforcement
- [ ] FTS retrieval with scoring
- [ ] Privacy filtering by channel

### Phase 3: Advanced Features (Week 3-4)
- [ ] Decision ledger support
- [ ] Task state tracking
- [ ] Artifact storage for large outputs
- [ ] Tool result normalization

### Phase 4: Performance & Testing (Week 4-5)
- [ ] Performance optimization (target p95 ≤ 500ms)
- [ ] All 12 acceptance scenarios passing
- [ ] Multi-agent concurrent testing
- [ ] MCP server implementation (optional)

### Phase 5: Production Readiness (Week 5-6)
- [ ] Documentation (API docs, deployment guide)
- [ ] Monitoring/metrics integration
- [ ] Security audit
- [ ] Load testing

---

## 13. Success Criteria

The system is considered production-ready when:

1. ✅ All 12 acceptance scenarios pass consistently
2. ✅ p95 latency ≤ 500ms for retrieval path
3. ✅ ACB never exceeds 65K token budget
4. ✅ Supports 10+ concurrent agents without degradation
5. ✅ Daemon codebase ≤ 2000 LOC (complexity delegated to Postgres)
6. ✅ All events persisted with append-only guarantee
7. ✅ Zero secret leakage in any channel
8. ✅ Multi-agent isolation enforced at tenant/session/agent level

---

## 14. Open Questions / TBD

| Question | Impact | Target Decision |
|----------|--------|-----------------|
| Exact token counting algorithm | Accuracy vs speed | Choose tiktoken or simple heuristic |
| Hotset caching strategy | Fast-path performance | In-memory Redis vs Postgres query |
| Decision supersedence rules | Long-term coherence | Manual vs auto-detection |
| Artifact retention policy | Storage growth | TTL based deletion policy |
| MCP vs plain HTTP first | Integration complexity | Start with HTTP, add MCP wrapper |

---

## 15. References

- Design Research: `dialog_parts/02_comparison_systems.md`
- Spec Evolution: `dialog_parts/03_spec_v1_formal.md` → `12_spec_v2.0_postgres_final.md`
- Acceptance Scenarios: `dialog_parts/07_acceptance_scenarios.md`
- Detailed Workflow: `dialog_parts/08_scenario_a1_legacy_onboarding.md`

---

**Document Owner:** AI Agent Memory Team
**Review Cycle:** Weekly during development phase
**Next Review:** After Phase 2 completion
