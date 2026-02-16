# Agent Memory System v2.0 - System Overview

**At a Glance for Stakeholders**

---

## What Is This?

A **memory service** for AI agents that:
- ✅ Remembers everything (messages, tool outputs, decisions)
- ✅ Forgets selectively (only sends relevant context to LLM)
- ✅ Serves multiple agents simultaneously
- ✅ Keeps costs low with strict 65K token budget

---

## The Core Problem

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT SITUATION                         │
├─────────────────────────────────────────────────────────────┤
│  Agent Session 1: "Let's use TypeScript for this project"   │
│  ❌ Agent forgets after session ends                        │
│                                                             │
│  Agent Session 2 (next day): "What language should we use?" │
│  ❌ Agent has no memory, asks again                         │
│                                                             │
│  Result: Repetitive conversations, lost context, frustration│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    WITH MEMORY SYSTEM                       │
├─────────────────────────────────────────────────────────────┤
│  Session 1: "Let's use TypeScript" → Stored in memory      │
│  ✅ Decision recorded with evidence                         │
│                                                             │
│  Session 2: "What language?" → Retrieved from memory       │
│  ✅ Agent recalls: "We chose TypeScript on [date] because..."│
│                                                             │
│  Result: Continuous context, better decisions, happy users  │
└─────────────────────────────────────────────────────────────┘
```

---

## How It Works

### 1. Record Everything (Append-Only)

```
User Message
    │
    ▼
┌─────────────┐
│ Event Store │ ← PostgreSQL "events" table
│ (Append-Only│   - Never delete
│   Log)      │   - Full audit trail
└─────────────┘
    │
    ▼
Auto-Chunking
    │
    ├─ Extract text
    ├─ Estimate tokens
    └─ Store in "chunks" table with FTS index
```

### 2. Retrieve Only What's Needed (Curated Context)

```
User Question
    │
    ▼
┌──────────────────┐
│  Query Analysis  │ → What's the intent?
└────────┬─────────┘
         │
         ▼
┌─────────────────────┐
│  Search Index (FTS) │ ← Find relevant chunks
└────────┬────────────┘
         │
         ▼
┌──────────────────┐
│   Score & Rank   │ → Relevance + Recency + Importance
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Pack Under     │ ← Max 65K tokens
│   Budget Limit   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Active Context  │ → Send to LLM
│     Bundle       │
└──────────────────┘
```

---

## Database Schema (Simplified)

```
┌────────────────────────────────────────────────────────────┐
│  EVENTS (Ground Truth - Append Only)                      │
│  ├─ event_id                                              │
│  ├─ tenant_id, session_id, channel                        │
│  ├─ actor_type, actor_id (human/agent/tool)               │
│  ├─ kind (message/tool_call/tool_result/decision)         │
│  ├─ sensitivity (none/low/high/secret)                    │
│  ├─ tags []                                               │
│  ├─ content (JSONB)                                       │
│  └─ refs []                                               │
└────────────────────────────────────────────────────────────┘
              │ 1:N
              ▼
┌────────────────────────────────────────────────────────────┐
│  CHUNKS (Retrieval Units - Searchable)                    │
│  ├─ chunk_id                                              │
│  ├─ event_id → events                                     │
│  ├─ text (excerpt)                                        │
│  ├─ token_est (computed once)                             │
│  ├─ importance (0.0-1.0)                                  │
│  └─ tsv (tsvector for FTS)                                │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  DECISIONS (First-Class Decisions)                        │
│  ├─ decision_id                                           │
│  ├─ status (active/superseded)                            │
│  ├─ decision, rationale, constraints                      │
│  └─ refs → events/chunks                                  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  TASKS (Operational State)                                │
│  ├─ task_id                                               │
│  ├─ status (open/doing/done)                              │
│  ├─ title, details                                        │
│  └─ refs → events/chunks                                  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  ARTIFACTS (Large Binary Storage)                         │
│  ├─ artifact_id                                           │
│  ├─ bytes (BYTEA)                                         │
│  └─ refs → events                                         │
└────────────────────────────────────────────────────────────┘
```

---

## API Overview

### Write: Record Event
```http
POST /api/v1/events
Content-Type: application/json

{
  "tenant_id": "acme-corp",
  "session_id": "session-123",
  "channel": "private",
  "actor": {"type": "human", "id": "user-42"},
  "kind": "message",
  "sensitivity": "none",
  "tags": ["topic:architecture"],
  "content": {"text": "We should use microservices"},
  "refs": []
}

→ Response: {"event_id": "evt_abc123", "chunk_ids": ["chk_def456"]}
```

### Read: Build Active Context
```http
POST /api/v1/acb/build
Content-Type: application/json

{
  "tenant_id": "acme-corp",
  "session_id": "session-123",
  "agent_id": "architect-agent",
  "channel": "private",
  "intent": "architecture_review",
  "query_text": "What did we decide about services?",
  "max_tokens": 65000
}

→ Response: {
    "acb_id": "acb_xyz789",
    "budget_tokens": 65000,
    "token_used_est": 18400,
    "sections": [
      {"name": "rules", "items": [...], "token_est": 1200},
      {"name": "recent_window", "items": [...], "token_est": 500},
      {"name": "retrieved_evidence", "items": [...], "token_est": 15000},
      {"name": "relevant_decisions", "items": [...], "token_est": 1700}
    ],
    "provenance": {...}
  }
```

---

## Active Context Bundle (ACB) Structure

```
┌────────────────────────────────────────────────────────┐
│           Active Context Bundle (≤65K tokens)          │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ IDENTITY/RULES        ~1.2K tokens                │ │
│  │ "You are an architect agent for Acme Corp..."     │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ RECENT WINDOW         ~0.8K tokens                │ │
│  │ "User: What did we decide about services?"       │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ RETRIEVED EVIDENCE    ~28K tokens                  │ │
│  │ • "We chose microservices on Jan 15 because..."   │ │
│  │ • "Service boundaries based on domain-driven..."  │ │
│  │ • "API Gateway: Kong" (from meeting notes)        │ │
│  │ • [17 more relevant chunks]                       │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ DECISIONS             ~4K tokens                   │ │
│  │ D-001: "Use microservices architecture"           │ │
│  │   Status: active                                  │
│  │   Rationale: [ scalability, team autonomy ]       │ │
│  │   Refs: evt_abc123, chk_def456                    │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Total: ~18K tokens (well under 65K limit)             │
└────────────────────────────────────────────────────────┘
```

---

## Privacy Model

```
┌─────────────────────────────────────────────────────────────┐
│                    CHANNEL ISOLATION                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PUBLIC CHANNEL       TEAM CHANNEL        PRIVATE CHANNEL   │
│  (Slack #general)    (Engineering team)   (1:1 DM)          │
│  │                   │                    │                  │
│  ├─ sensitivity:     ├─ sensitivity:      ├─ sensitivity:   │
│  │   none, low       │   none, low, high  │   none,low,high │
│  │                   │                    │                  │
│  ├─ No user prefs    ├─ Team decisions    ├─ Everything     │
│  ├─ No secrets       ├─ Shared context    ├─ Personal prefs │
│  └─ Safe to leak     └─ Internal use only └─ Private only   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SECRET HANDLING                          │
├─────────────────────────────────────────────────────────────┤
│  "My API key is sk-abc123..."                               │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────┐                                       │
│  │  DETECTION       │ ← Pattern matching for secrets       │
│  │  sk-* tokens     │
│  └────────┬─────────┘                                       │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────┐                                       │
│  │  REDACTION       │ ← Replace with [SECRET_REDACTED]     │
│  │  OR REJECT       │
│  └──────────────────┘                                       │
│           │                                                 │
│           ▼                                                 │
│  Event stored as: "My API key is [SECRET_REDACTED]"         │
│  sensitivity: secret                                        │
│  Never loaded in ANY channel                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Multi-Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DAEMON SERVICE                           │
│                   (One Process)                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Agent A │  │ Agent B │  │ Agent C │  │ Agent D │        │
│  │(Coder)  │  │(Tester) │  │(Reviewer)│ │(Planner) │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
│       └────────────┴────────────┴────────────┘              │
│                         │                                   │
│                    HTTP/REST API                            │
│                         │                                   │
│              ┌──────────▼──────────┐                        │
│              │  Memory Daemon      │                        │
│              │  - Stateless        │                        │
│              │  - Multi-tenant     │                        │
│              │  - Postgres pool    │                        │
│              └──────────┬──────────┘                        │
│                         │                                   │
│              ┌──────────▼──────────┐                        │
│              │    PostgreSQL       │                        │
│              │  - Events table     │                        │
│              │  - Chunks table     │                        │
│              │  - Decisions table  │                        │
│              │  - FTS indexes      │                        │
│              └─────────────────────┘                        │
│                                                             │
│  Isolation: tenant_id + session_id + agent_id              │
└─────────────────────────────────────────────────────────────┘
```

---

## Performance Targets

```
┌─────────────────────────────────────────────────────────────┐
│                    LATENCY SLA                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FAST PATH (Hotset Hit)      ████████░░  150ms p95         │
│  - No retrieval needed                                       │
│  - Recent context only                                       │
│                                                             │
│  RETRIEVAL PATH (FTS)       ████████████  500ms p95        │
│  - Full-text search                                          │
│  - 2000 candidate pool                                       │
│  - Score + pack                                              │
│                                                             │
│  COLD START                  ██████████████ 1500ms max     │
│  - First query ever                                          │
│  - Cache miss                                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    BOUND LIMITS                             │
├─────────────────────────────────────────────────────────────┤
│  Max ACB Size:              65,000 tokens (HARD LIMIT)      │
│  Candidate Pool:            2,000 chunks                    │
│  Retrieved Chunks:          200 chunks                      │
│  Max Tool Result Excerpt:   64 KB                           │
│  File Reads Per Call:       ≤ 20 files                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Decision Ledger Example

```json
{
  "decision_id": "dec_20250115_microservices",
  "tenant_id": "acme-corp",
  "timestamp": "2025-01-15T10:30:00Z",
  "status": "active",
  "scope": "project",
  "decision": "Adopt microservices architecture",
  "rationale": [
    "Independent scaling per service",
    "Team autonomy (different teams own different services)",
    "Technology diversity (Node for APIs, Python for ML)"
  ],
  "constraints": [
    "Must share PostgreSQL for consistency",
    "API Gateway required (Kong)",
    "Service discovery via Consul"
  ],
  "alternatives": [
    "Monolith (rejected: scaling bottleneck)",
    "Modular monolith (rejected: still coupled deployment)"
  ],
  "consequences": [
    "Increased operational complexity",
    "Need for distributed tracing",
    "Network latency between services"
  ],
  "refs": ["evt_abc123", "chk_def456", "evt_ghi789"]
}
```

---

## Success Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **ACB Budget Compliance** | 100% ≤ 65K | Controls LLM costs |
| **Retrieval Latency** | p95 ≤ 500ms | User experience |
| **Event Persistence** | 100% stored | Audit trail |
| **Secret Leakage** | 0 incidents | Security |
| **Multi-Agent Concurrency** | 10+ agents | Team scalability |

---

## When to Use This System

✅ **Good Fit:**
- Long-running projects (weeks/months)
- Multi-agent collaborations
- Complex decision tracking
- Regulatory compliance (audit trails)
- Cost-conscious LLM usage

❌ **Not Ideal For:**
- Single ephemeral conversations
- Stateless microservices
- Real-time streaming (latency critical)
- Simple Q&A without context needs

---

## Quick Comparison

| Feature | Without Memory | With Memory System |
|---------|----------------|-------------------|
| Context Retention | Session only | Forever |
| Decision Tracking | None | Full ledger with refs |
| Cost Control | Manual context curation | Automatic 65K budget |
| Multi-Agent | No shared memory | Shared decision ledger |
| Audit Trail | None | Complete event log |
| Privacy | All-or-nothing | Channel-based filtering |

---

**For full technical details, see `PRD.md`**
**For implementation steps, see `IMPLEMENTATION_GUIDE.md`**
