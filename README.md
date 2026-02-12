# Agent Memory System v2.0

PostgreSQL-backed daemon service for AI agent persistent memory.

## Overview

The Agent Memory System enables AI agents to maintain persistent memory across sessions while keeping active LLM context small (≤65K tokens per API call).

**Key Features:**
- ✅ Persist almost all interactions (messages, tool I/O, decisions)
- ✅ Curate small active context under strict 65K token budget
- ✅ Multi-agent support with microservices architecture
- ✅ Fast context assembly (p95 ≤ 500ms)
- ✅ Channel-based privacy filtering (public/private/team/agent)
- ✅ JWT-based authentication and API key support
- ✅ Memory Surgery: retract, amend, quarantine, attenuate, and block memory
- ✅ Capsule Transfer: share curated memory bundles between agents
- ✅ Scope + Subject filtering: target memory by session, user, project, or policy

## Architecture

The system is transitioning from a monolithic architecture to microservices (see [SPEC-ARCH-001](.moai/specs/SPEC-ARCH-001/spec.md)).

### Current State (v2.1.0 - In Progress)

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Memory System                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Admin Server │  │ API Server   │  │ MCP Server   │      │
│  │   (Port 3001) │  │  (Port 3002) │  │  (stdio)     │      │
│  │              │  │              │  │              │      │
│  │ • Auth       │  │ • Events     │  │ • MCP Tools  │      │
│  │ • Users      │  │ • ACB        │  │ • HTTP API   │      │
│  │ • OAuth      │  │ • Chunks     │  │              │      │
│  │ • API Keys   │  │ • Decisions  │  │              │      │
│  │              │  │ • Tasks      │  │              │      │
│  │ ⚠ WIP        │  │              │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                           │                                 │
│                           ▼                                 │
│                  ┌─────────────────┐                        │
│                  │   PostgreSQL    │                        │
│                  │   (Shared DB)   │                        │
│                  └─────────────────┘                        │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │         Shared Libraries (packages/)                │  │
│  │  • @agent-memory/auth (JWT, API Keys, Middleware)  │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

Legend: ✅ Complete | ⚠ Work in Progress | ❌ Not Started
```

### Component Status

| Component | Port | Status | Description |
|-----------|------|--------|-------------|
| **Admin Server** | 3001 | 🟡 WIP | User auth, OAuth, API keys (Phase 1) |
| **API Server** | 3002 | 🟢 Monolith | Memory operations (to be extracted) |
| **MCP Server** | stdio | 🟢 Monolith | Model Context Protocol (to be separated) |
| **@agent-memory/auth** | - | 🟢 Complete | Shared authentication library |
| **Landing Page** | 3000/80 | 🔴 Planned | Public marketing site (Phase 4) |
| **Documentation** | - | 🔴 Planned | Developer docs (Phase 5) |

### Migration Progress (SPEC-ARCH-001)

**Phase 1: Admin Server Extraction** (In Progress - 60%)
- ✅ TASK-001: Admin Server project setup
- ✅ TASK-002: Shared authentication library
- 🟡 TASK-003: Authentication endpoints
- 🔴 TASK-004: OAuth provider configuration
- 🔴 TASK-005: API key management
- 🔴 TASK-006: User administration
- 🟡 TASK-007: Infrastructure and tooling

**Phase 2-5:** API Server, MCP Server, Landing Page, Documentation (Planned)

See [progress report](.moai/specs/SPEC-ARCH-001/progress.md) for details.

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### 1. Clone and Install

```bash
# Install dependencies
npm install
```

### 2. Setup Database

**For Development:**

```bash
# Use development database template
cp .env.dev .env

# Run setup script (requires postgres superuser)
bash setup-dev-db.sh

# Or manually apply migrations
PGDATABASE=agent_memory_dev psql -f src/db/schema.sql
for f in src/db/migrations/*.sql; do
    PGDATABASE=agent_memory_dev psql -f "$f"
done
```

**Available Migrations**:
- `001-005`: Core schema (events, chunks, decisions, tasks, artifacts)
- `006-011`: Authentication system (users, sessions, api_keys, oauth_connections)
- `012`: Tenants table for multi-tenant isolation
- `013`: Decision scope enhancement
- `014`: Audit logs (no foreign key constraints)
- `015`: Memory edits constraints
- `008-015`: Memory Surgery & Capsule Transfer (see [SPEC-MEMORY-002](.moai/specs/SPEC-MEMORY-002/spec.md))
```

**For Production:**

```bash
# Use production environment template
cp .env.prod .env
# IMPORTANT: Edit .env and change all secrets!

# Create and setup database
createdb agent_memory
psql agent_memory < src/db/schema.sql

# Apply migrations
for f in src/db/migrations/*.sql; do
    psql agent_memory -f "$f"
done
```

> **See [DATABASE_SETUP.md](DATABASE_SETUP.md)** for comprehensive database setup and environment switching guide.

### 3. Configure Environment

```bash
# Development (uses agent_memory_dev)
cp .env.dev .env

# Production (uses agent_memory)
cp .env.prod .env
# IMPORTANT: Change all secrets and passwords in .env!
```

### 4. Start Server

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

The server will start on http://localhost:3000

**Database Switching:** The server uses the `PGDATABASE` environment variable. To switch databases:

```bash
# Use development database
PGDATABASE=agent_memory_dev npm run dev

# Use production database
PGDATABASE=agent_memory npm start
```

## Docker Deployment

```bash
# Start PostgreSQL and memory daemon
docker-compose up -d

# View logs
docker-compose logs -f memory-daemon

# Stop
docker-compose down
```

## API Usage

### Record Event

```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp",
    "session_id": "session-123",
    "channel": "private",
    "actor": {"type": "human", "id": "user-42"},
    "kind": "message",
    "sensitivity": "none",
    "tags": ["topic:architecture"],
    "content": {
      "text": "We should use microservices",
      "scope": "user",
      "subject_type": "user",
      "subject_id": "user-42",
      "project_id": "project-architecture"
    },
    "refs": []
  }'
```

### Build Active Context Bundle

```bash
curl -X POST http://localhost:3000/api/v1/acb/build \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "acme-corp",
    "session_id": "session-123",
    "agent_id": "architect-agent",
    "channel": "private",
    "intent": "architecture_review",
    "query_text": "What did we decide about services?",
    "scope": "project",
    "subject_type": "project",
    "subject_id": "project-architecture",
    "max_tokens": 65000
  }'
```

## Development

### Project Structure

```
src/
├── db/
│   └── schema.sql          # PostgreSQL DDL
├── api/
│   └── routes.ts           # HTTP endpoints
├── core/
│   ├── recorder.ts         # Event recording
│   ├── chunker.ts          # Auto-chunking
│   ├── orchestrator.ts     # ACB builder
│   └── privacy.ts          # Sensitivity filtering
├── utils/
│   ├── id-generator.ts     # ID generation
│   └── token-counter.ts    # Token estimation
└── server.ts               # Express server
```

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Compile TypeScript
npm test             # Run all tests
npm run test:scenario A1  # Run specific scenario
npm run db:migrate   # Apply database schema
npm run db:reset     # Reset database (drop + create + migrate)
```

### Running Tests

```bash
# Run all scenarios
npm test

# Run specific scenario
npx tsx tests/scenarios/a1-legacy-onboarding.test.ts

# Run with test database
PGDATABASE=agent_memory_test npm test
```

## Architecture

### Data Flow

```
┌─────────────┐
│   Agent     │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  HTTP API (/api/v1) │
└──────┬──────────────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌─────────────┐ ┌────────────┐ ┌────────────┐
│  Recorder   │ │ Orchestrator│ │  Privacy   │
│  (Write)    │ │  (Read)     │ │  (Filter)  │
└──────┬──────┘ └──────┬─────┘ └────────────┘
       │               │
       └───────────────┴────────┐
                               ▼
                      ┌─────────────────┐
                      │   PostgreSQL    │
                      │ - events        │
                      │ - chunks (FTS)  │
                      │ - decisions     │
                      │ - tasks         │
                      │ - artifacts     │
                      └─────────────────┘
```

### Design Principles

1. **P1**: Ground truth is append-only
2. **P2**: Derived views are disposable
3. **P3**: Active context is a product
4. **P4**: Traceability by reference
5. **P5**: Least-privilege memory loading
6. **P6**: Human-legible override
7. **P7**: Determinism where possible
8. **P8**: Scenario-driven validation

See `CLAUDE.md` for full architectural context.

## Active Context Bundle Structure

| Section | Max Tokens | Description |
|---------|------------|-------------|
| identity | 1,200 | Agent identity, role |
| rules | 6,000 | Project/user/org rules |
| task_state | 3,000 | Current goal, plan |
| decision_ledger | 4,000 | Relevant past decisions |
| retrieved_evidence | 28,000 | FTS-retrieved chunks |
| recent_window | 8,000 | Recent dialogue |
| handoff_packet | 6,000 | Multi-agent handoff |
| reserve | 8,800 | Headroom |
| **Total** | **65,000** | |

## Performance Targets

| Metric | Target |
|--------|--------|
| Fast-path ACB | p95 ≤ 150ms |
| Retrieval-path ACB | p95 ≤ 500ms |
| Cold-cache recovery | ≤ 1500ms |
| Candidate pool | ≤ 2000 chunks |
| Retrieved chunks | ≤ 200 chunks |

## Documentation

- `PRD.md` - Complete product requirements
- `IMPLEMENTATION_GUIDE.md` - Practical guide with code examples
- `SYSTEM_OVERVIEW.md` - Visual diagrams and quick reference
- `CLAUDE.md` - Architecture guidance for AI assistants

## License

MIT
