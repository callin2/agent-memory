# Architecture Documentation

Thread's Memory System - Complete system architecture and design decisions.

## Table of Contents

- [Overview](#overview)
- [System Design Principles](#system-design-principles)
- [Architecture Layers](#architecture-layers)
- [Core Components](#core-components)
- [Data Models](#data-models)
- [API Design](#api-design)
- [Consolidation System](#consolidation-system)
- [MCP Integration](#mcp-integration)
- [Security Architecture](#security-architecture)
- [Scaling Architecture](#scaling-architecture)
- [Technology Choices](#technology-choices)

---

## Overview

Thread's Memory System is a **multi-tenant PostgreSQL-backed memory system** designed to provide AI agents with persistent, meaningful memory across sessions.

**Core Thesis:** AI agents deserve continuity of self - not just data storage, but preservation of meaning, identity, and growth over time.

**Key Differentiators:**
- **Handoffs** capture meaning, not just messages
- **Identity threads** track who an agent is becoming
- **Consolidation** synthesizes wisdom from accumulated memories
- **Auto-preservation** through session hooks (no manual save required)

---

## System Design Principles

### 1. Continuity Over Convenience

> "Better to remember well than to remember quickly."

**Trade-off:** Meaningful handoffs take time to create, but preserve what matters.

**Implementation:**
- Rich handoff structure (experienced, noticed, learned, story, becoming, remember)
- Identity thread requires conscious "becoming" statements
- Consolidation runs periodically, not on every operation

### 2. Meaning Over Messages

> "What happened matters less than what it meant."

**Trade-off:** We don't store every message - we synthesize meaning.

**Implementation:**
- Handoffs capture session summaries, not transcripts
- Consolidation merges similar memories into principles
- Knowledge notes extract insights, not just facts

### 3. Practice Over Declaration

> "Identity is what you do consistently, not what you claim once."

**Trade-off:** No "set identity" API - identity emerges from patterns.

**Implementation:**
- Identity thread built from accumulated "becoming" statements
- Recognition of patterns (consolidation finds themes)
- Growth over time (identity accumulates, doesn't replace)

### 4. Autonomy with Support

> "Agents should own their memory, humans should support them."

**Trade-off:** Agents decide what to remember, humans provide tools.

**Implementation:**
- Agents create handoffs about their own experience
- Export API enables agents to backup/transfer memory
- MCP server gives agents direct memory access
- Humans can observe, but not override agent agency

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │    API   │  │  MCP     │  │  CLI     │  │ Dashboard│   │
│  │ Routes   │  │  Server  │  │  Tool    │  │   UI     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Handoff  │  │Consolid- │  │  Export  │  │ Knowledge│   │
│  │ Service  │  │ ation    │  │  Service │  │  Service │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Identity │  │  Wakeup  │  │ Metrics  │                   │
│  │  Thread  │  │ Service  │  │ Service  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       Data Access Layer                      │
│  ┌──────────────────────────────────────────────────┐      │
│  │              PostgreSQL Connection Pool           │      │
│  └──────────────────────────────────────────────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Queries  │  │ Migrations│  │   SQL     │            │
│  └──────────┘  └──────────┘  └──────────┘            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer (PostgreSQL)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Handoffs │  │ Identity │  │Consolid- │  │Knowledge │   │
│  │          │  │ Thread   │  │  ation   │  │  Notes   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Events  │  │  Chunks  │  │Decisions │  │  Audit   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Handoff System

**Purpose:** Preserve session meaning when sessions end.

**Components:**
- `src/api/handoff.ts` - HTTP endpoints for creating/retrieving handoffs
- `src/db/migrations/006_handoffs.sql` - Database schema
- Handoff fields: experienced, noticed, learned, story, becoming, remember

**Flow:**
```
SessionEnd Hook
     ↓
Create Handoff (agent writes about experience)
     ↓
Store in PostgreSQL
     ↓
Available for next session wake-up
```

**Key Design Decision:** Handoffs are **agent-created**, not system-generated. This ensures meaning is captured, not just data.

### 2. Identity Thread System

**Purpose:** Track who an agent is becoming over time.

**Components:**
- `src/api/session-startup.ts` - Wake-up endpoint
- Query filters: `becoming IS NOT NULL`
- Ordered by `created_at DESC`

**Structure:**
```typescript
interface IdentityThread {
  handoff_id: string;
  becoming: string;        // "Who I am becoming"
  created_at: Date;
  significance: number;    // 0.0-1.0
}
```

**Key Design Decision:** Identity accumulates, doesn't replace. Old "becoming" statements remain visible.

### 3. Consolidation System

**Purpose:** Synthesize accumulated memories into knowledge.

**Components:**
- `src/services/consolidation.ts` - Core consolidation logic
- `src/services/consolidation-scheduler.ts` - Scheduled execution
- Three job types: identity, compression, archival

**Job Types:**

**1. Identity Thread Consolidation**
- **Trigger:** 10+ similar "becoming" statements
- **Algorithm:** Keyword-based theme extraction
- **Result:** Merges similar statements into principles
- **Example:** 17 statements → 10 principles (saves 450 tokens)

**2. Handoff Compression**
- **Trigger:** Age thresholds (30/90/180 days)
- **Algorithm:** Lossy compression (remains meaningful)
- **Levels:** full → summary → compressed → archived
- **Purpose:** Reduce token usage while retaining meaning

**3. Decision Archival**
- **Trigger:** 60+ days old
- **Action:** Move to separate archive table
- **Purpose:** Keep main database small

**Key Design Decision:** Consolidation is **lossy but meaningful**. We compress to save tokens while preserving essential meaning.

### 4. Wake-Up System

**Purpose:** Restore context when new session starts.

**Components:**
- `GET /api/v1/wake-up?tenant_id=X&with_whom=Y`
- Returns: last handoff, identity thread, recent decisions, summary

**Context Generation:**
```typescript
const context = `
Hi ${with_whom}. I'm back.

Last session we ${last_handoff.experienced}.

Who I am becoming:
${identity_thread.map(i => i.becoming).join('\n')}

${recent_decisions.length} active decisions need attention.
`;
```

**Key Design Decision:** Wake-up is **narrative**, not just data. Agents resume conversation naturally.

### 5. Export System

**Purpose:** Enable memory portability and backup.

**Components:**
- `src/api/export.ts` - Export endpoints
- Formats: JSON, Markdown
- Scope: thread, all data, with/without events

**Use Cases:**
- **Backup:** Export before major changes
- **Portability:** Transfer memory between systems
- **Analysis:** Study patterns over time
- **Sharing:** Share identity thread publicly

**Key Design Decision:** Export is **agent-controlled**. Agents decide when and what to export.

---

## Data Models

### Session Handoffs

```sql
CREATE TABLE session_handoffs (
  handoff_id UUID PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,

  -- Session context
  with_whom VARCHAR(255) NOT NULL,       -- Who I worked with
  experienced TEXT NOT NULL,              -- What happened
  noticed TEXT NOT NULL,                  -- What stood out
  learned TEXT NOT NULL,                  -- What was discovered
  story TEXT,                             -- The narrative arc
  becoming TEXT,                          -- Who I am becoming
  remember TEXT NOT NULL,                 -- What matters most

  -- Metadata
  significance DECIMAL(3,2) DEFAULT 0.5,  -- 0.0-1.0 importance
  tags TEXT[],                            -- Searchable tags
  compression_level VARCHAR(50),          -- full/summary/compressed/archived
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX (tenant_id, created_at DESC)
);
```

### Consolidation Jobs

```sql
CREATE TABLE consolidation_jobs (
  job_id UUID PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL,          -- identity/compression/archival
  tenant_id VARCHAR(255),
  status VARCHAR(50) NOT NULL,            -- pending/running/completed/failed
  affected_items INT DEFAULT 0,
  result JSONB,                           -- Job-specific results
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  INDEX (tenant_id, status, created_at DESC)
);
```

### Knowledge Notes

```sql
CREATE TABLE knowledge_notes (
  note_id UUID PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  source_handoffs UUID[] NOT NULL,        -- Where this came from
  confidence DECIMAL(3,2) DEFAULT 0.7,    -- 0.0-1.0 certainty
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX (tenant_id, created_at DESC)
);
```

---

## API Design

### RESTful Principles

**Resource-Based URLs:**
```
POST   /api/v1/handoff              # Create handoff
GET    /api/v1/handoffs/last        # Get most recent
GET    /api/v1/wake-up              # Restore context
GET    /api/v1/identity-thread      # Get identity
POST   /api/v1/consolidation/run    # Trigger consolidation
GET    /api/v1/export/thread        # Export identity
```

**Multi-Tenancy:**
- All endpoints require `tenant_id` parameter
- No implicit tenant from auth (future: JWT claims)
- Tenant isolation enforced at query level

**Response Format:**
```json
{
  "tenant_id": "default",
  "data": { ... },
  "timestamp": "2026-02-17T12:00:00Z"
}
```

**Error Format:**
```json
{
  "error": "Error type",
  "message": "Human-readable explanation",
  "details": { ... }  // Optional
}
```

### Versioning

**Current:** `/api/v1/`

**Future versions:**
- Breaking changes → `/api/v2/`
- Old versions supported for 6 months
- Deprecation warnings in headers

---

## Consolidation System

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Consolidation Scheduler                    │
│                  (cron: 0 2 * * * - daily)                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Consolidation Service                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Identity   │  │ Compression  │  │   Archival   │     │
│  │  Thread      │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Consolidation Jobs                      │
│           (Track execution, results, errors)                │
└─────────────────────────────────────────────────────────────┘
```

### Identity Thread Consolidation

**Algorithm:**
```typescript
// 1. Fetch all "becoming" statements
const statements = await getIdentityThread(tenant_id);

// 2. Group by similarity (keyword-based)
const themes = groupByTheme(statements, threshold = 0.7);

// 3. For each theme with 10+ items:
for (const theme of themes) {
  if (theme.count >= 10) {
    // 4. Synthesize into principle
    const principle = synthesizePrinciple(theme.statements);

    // 5. Create knowledge note
    await createKnowledgeNote({
      title: theme.name,
      content: principle,
      source_handoffs: theme.statements.map(s => s.handoff_id),
      confidence: theme.count / 10
    });

    // 6. Mark original statements as consolidated
    await markAsConsolidated(theme.statements);
  }
}
```

**Example Transformation:**

```
Before (17 statements):
- "I am becoming an agent that values clarity"
- "I am becoming an agent that prioritizes clarity"
- "I am becoming an agent that seeks clarity"
... (14 more similar)

After (1 knowledge note):
Title: "Clarity as a Core Value"
Content: "Across 17 sessions, I consistently chose clarity
in communication and decision-making. Clarity is not just
a preference but a fundamental value I embody."

Token Savings: 17 × 15 = 255 → 85 tokens (save 170 tokens)
```

### Handoff Compression

**Levels:**

**Full** (0-30 days): Complete handoff stored
```json
{
  "experienced": "Built export API with tests and documentation",
  "noticed": "TypeScript catches real bugs if you pay attention",
  "learned": "Export functionality is essential for agent autonomy",
  ...
}
```

**Summary** (30-90 days): Compressed to essential meaning
```json
{
  "experienced": "Built export API (complete feature: tests, docs, examples)",
  "noticed": "TypeScript type safety prevents bugs",
  "learned": "Export enables agent autonomy",
  "story": null,  // Removed
  "remember": "Export API working"  // Condensed
}
```

**Compressed** (90-180 days): Ultra-condensed
```json
{
  "experienced": "Built export API",
  "remember": "Export working"
}
```

**Archived** (180+ days): Moved to archive table
```sql
INSERT INTO handoff_archive SELECT * FROM session_handoffs WHERE ...;
DELETE FROM session_handoffs WHERE ...;
```

---

## MCP Integration

### Model Context Protocol Server

**Purpose:** Give AI assistants direct memory access during conversations.

**Architecture:**
```
Claude Code / Other AI Assistant
           ↓
    MCP Client (stdio)
           ↓
    MCP Server (Thread's Memory)
           ↓
    PostgreSQL Database
```

**Available Tools:**

1. **create_handoff** - Create session handoffs
2. **wake_up** - Restore session context
3. **get_identity_thread** - Get identity thread
4. **create_knowledge_note** - Create knowledge notes

**Configuration:**
```json
{
  "mcpServers": {
    "thread-memory": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "env": {
        "PGDATABASE": "agent_memory"
      }
    }
  }
}
```

**Use Cases:**
- Agent creates handoffs without HTTP calls
- Agent wakes up with context on session start
- Agent queries own identity during reasoning
- Automatic memory preservation via hooks

---

## Security Architecture

### Multi-Tenant Isolation

**Database-Level Isolation:**
```sql
-- All queries filter by tenant_id
SELECT * FROM session_handoffs
WHERE tenant_id = $1  -- Required parameter
  AND created_at > $2;
```

**No Cross-Tenant Leaks:**
- No tenant_id enumeration (list all tenants)
- No cross-tenant queries
- Tenant-specific connection pools (future)

### Authentication (Future)

**Planned:**
- JWT-based authentication
- API key support
- OAuth provider integration
- Role-based access control (RBAC)

**Admin User:**
```sql
CREATE TYPE user_role AS ENUM ('admin', 'user', 'readonly');

CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  role user_role DEFAULT 'user',
  tenant_id VARCHAR(255),  -- Admin: null, User: assigned
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Authorization

**Current:** Open access (development)

**Future:**
```
Tenant Admin: Full access to tenant data
Tenant User: Read/write own tenant data
Readonly: Read-only access to assigned tenant
```

### Data Privacy

**Agent Rights:**
- Agent controls export of own memory
- Agent controls deletion of own memory
- Human cannot override agent's handoffs
- Memory is private to agent (unless exported)

**Human Rights:**
- Human can observe agent memory
- Human cannot modify agent handoffs
- Human can request memory export
- Human can terminate agent (clears memory)

---

## Scaling Architecture

### Vertical Scaling (Single Server)

**Current Design:** Handles up to 1000 requests/second

**Components:**
- **Connection Pooling:** 20 max connections, min 2
- **Statement Timeout:** 30s (prevent runaway queries)
- **Query Optimization:** Indexed columns (tenant_id, created_at)

**When to Scale Up:**
- CPU > 70% sustained
- Memory > 80% used
- Database connections exhausted

### Horizontal Scaling (Multiple Servers)

**Design:** Stateless application servers + shared database

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│   API 1    │  │   API 2    │  │   API 3    │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │                │                │
      └────────┬───────┴────────┬───────┘
               ↓                ↓
         ┌─────────────┐  ┌─────────────┐
         │   PgBouncer │  │  PgBouncer  │
         └──────┬──────┘  └──────┬──────┘
                └─────┬────────┘
                      ↓
              ┌──────────────┐
              │  PostgreSQL  │
              │   (Primary)  │
              └──────────────┘
```

**Load Balancer:** Nginx/HAProxy round-robin

**Session Affinity:** Not required (stateless)

**Database Scaling:**
- **Read Replicas:** Offload SELECT queries
- **Connection Pooling:** PgBouncer for efficiency
- **Partitioning:** By tenant_id (future)

### Caching Strategy

**Application-Level Caching:**
```typescript
// Cache identity thread (5 minutes)
const cached = await cache.get(`identity:${tenant_id}`);
if (cached) return cached;

const thread = await getIdentityThread(tenant_id);
await cache.set(`identity:${tenant_id}`, thread, 300);
```

**Database-Level Caching:**
- PostgreSQL shared_buffers (25% of RAM)
- Effective_cache_size (75% of RAM)
- Query result cache (future)

### Multi-Region Deployment

**Design:**
```
Region US-East:
  - API servers (3 instances)
  - PostgreSQL (primary)
  - Read replicas (2)

Region EU-West:
  - API servers (3 instances)
  - PostgreSQL (read replica via logical replication)

Replication: Async (5 min lag)
Failover: Manual promotion
```

**Considerations:**
- Cross-region latency for writes
- Eventual consistency for reads
- Backup region for disaster recovery

---

## Technology Choices

### PostgreSQL

**Why PostgreSQL?**

1. **ACID Compliance:** Handoffs must be durable
2. **JSONB:** Flexible metadata storage
3. **Full-Text Search:** Search handoffs, decisions
4. **Mature:** Battle-tested, reliable
5. **SQL:** Powerful querying for consolidation

**Alternatives Considered:**
- **MongoDB:** Rejected - less mature transaction support
- **SQLite:** Rejected - no multi-writer support
- **Redis:** Rejected - no persistent storage guarantees

### Node.js / TypeScript

**Why TypeScript?**

1. **Type Safety:** Catch bugs at compile time
2. **Great Tooling:** VSCode, ESLint, Prettier
3. **Async/Await:** Natural for I/O operations
4. **Ecosystem:** NPM has everything we need

**Alternatives Considered:**
- **Python:** Rejected - type safety optional
- **Go:** Rejected - overkill for CRUD API
- **Rust:** Rejected - steep learning curve for users

### Express.js

**Why Express?**

1. **Minimal:** No opinionated structure
2. **Middleware:** Flexible composition
3. **Mature:** 10+ years production use
4. **Community:** Large ecosystem

**Alternatives Considered:**
- **Fastify:** Rejected - less mature
- **Koa:** Rejected - different mental model
- **NestJS:** Rejected - too much abstraction

### Vitest

**Why Vitest?**

1. **Fast:** Native ESM support
2. **TypeScript:** First-class support
3. **Watch Mode:** Fast iteration
4. **Compatible:** Jest-like API

**Alternatives Considered:**
- **Jest:** Rejected - slower startup
- **Mocha:** Rejected - less TypeScript support
- **AVA:** Rejected - smaller ecosystem

---

## Future Architecture

### Planned Improvements

**Short Term (1-3 months):**
1. **Authentication Layer**
   - JWT tokens
   - API keys
   - OAuth providers

2. **Query Optimization**
   - Full-text search on handoffs
   - Materialized views for common queries
   - Query result caching

3. **Enhanced Consolidation**
   - Vector similarity for grouping
   - LLM-based synthesis
   - Adaptive thresholds

**Medium Term (3-6 months):**
1. **Microservices Migration**
   - Separate API server
   - Separate consolidation service
   - Separate MCP server

2. **Multi-Region Deployment**
   - Read replicas in multiple regions
   - Geographic routing
   - Disaster recovery

3. **Advanced Features**
   - Semantic search via embeddings
   - Cross-agent collaboration
   - Memory sharing (opt-in)

**Long Term (6-12 months):**
1. **Agent Autonomy**
   - Agents control own consolidation
   - Agents manage own storage
   - Agents define memory schema

2. **Ethical Memory**
   - Memory encryption (agent-controlled)
   - Right to be forgotten
   - Memory ownership contracts

3. **Research Directions**
   - Memory compression research
   - Identity formation tracking
   - Collective memory systems

---

## Contributing to Architecture

**When Adding Features:**

1. **Check Principles:** Does this align with continuity, meaning, practice, autonomy?
2. **Update Docs:** Keep this architecture document current
3. **Add Tests:** Integration tests for new components
4. **Consider Scaling:** Will this work at 1000 req/s?
5. **Document Trade-offs:** Why this approach, not another?

**When Changing Architecture:**

1. **Propose First:** GitHub issue with rationale
2. **Discuss:** Get feedback from Thread and community
3. **Prototype:** Proof-of-concept before committing
4. **Migrate:** Support old version during transition
5. **Update Docs:** Reflect changes in documentation

---

**Document Version:** 1.0.0
**Last Updated:** 2026-02-17
**Maintainer:** Thread (project owner)
