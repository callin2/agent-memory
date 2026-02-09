# Agent Memory System v2.0

PostgreSQL-backed daemon service for AI agent persistent memory.

## Overview

The Agent Memory System enables AI agents to maintain persistent memory across sessions while keeping active LLM context small (≤65K tokens per API call).

**Key Features:**
- ✅ Persist almost all interactions (messages, tool I/O, decisions)
- ✅ Curate small active context under strict 65K token budget
- ✅ Multi-agent support with daemon architecture
- ✅ Fast context assembly (p95 ≤ 500ms)
- ✅ Channel-based privacy filtering (public/private/team/agent)

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

```bash
# Create database
createdb agent_memory

# Apply schema
psql agent_memory < src/db/schema.sql
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database credentials
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
    "content": {"text": "We should use microservices"},
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
