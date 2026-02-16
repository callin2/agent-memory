# Implementation Guide - Agent Memory System v2.0

**Quick Start Guide for Developers**

---

## Quick Reference

### Tech Stack
- **Language**: TypeScript/Node.js (recommended)
- **Database**: PostgreSQL 15+ (pgcrypto, pg_trgm extensions)
- **API**: HTTP/REST (MCP-compatible)
- **Deployment**: Docker container

### Key Files
```
/memory-system
├── prd.md                    # Full product requirements
├── implementation-guide.md   # This file
├── src/
│   ├── db/
│   │   ├── schema.sql        # PostgreSQL DDL
│   │   └── migrations/       # Database migrations
│   ├── api/
│   │   ├── routes.ts         # HTTP endpoints
│   │   └── middleware.ts     # Auth, logging
│   ├── core/
│   │   ├── recorder.ts       # Event recording
│   │   ├── chunker.ts        # Auto-chunking logic
│   │   ├── orchestrator.ts   # ACB builder
│   │   └── privacy.ts        # Sensitivity filtering
│   └── utils/
│       ├── token-counter.ts  # Token estimation
│       └── id-generator.ts   # Event/chunk IDs
├── tests/
│   └── scenarios/            # Acceptance scenarios A1-A12
└── docker-compose.yml        # Postgres + daemon
```

---

## Step 1: Database Setup

### 1.1 Initialize Schema

```bash
# Create database
createdb agent_memory

# Apply schema
psql agent_memory < schema.sql

# Verify extensions
psql agent_memory -c "SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto', 'pg_trgm');"
```

### 1.2 Create Indexes

```sql
-- Verify indexes created
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN ('events', 'chunks', 'decisions', 'tasks', 'artifacts');
```

---

## Step 2: Core Implementations

### 2.1 ID Generator

```typescript
// src/utils/id-generator.ts
import { randomBytes } from 'crypto';

export function generateId(prefix: string): string {
  const bytes = randomBytes(8);
  const hex = bytes.toString('hex').substring(0, 16);
  return `${prefix}_${hex}`;
}

// Usage: generateId('evt') → 'evt_a3f7e2c1b9d4...'
```

### 2.2 Token Counter

```typescript
// src/utils/token-counter.ts
// Simple approximation: ~4 chars per token
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// For production, use tiktoken library
```

### 2.3 Event Recorder

```typescript
// src/core/recorder.ts
import { generateId } from '../utils/id-generator.js';
import { estimateTokens } from '../utils/token-counter.js';

export async function recordEvent(
  db: any,
  event: {
    tenant_id: string;
    session_id: string;
    channel: string;
    actor: { type: string; id: string };
    kind: string;
    sensitivity?: string;
    tags?: string[];
    content: any;
    refs?: string[];
  }
): Promise<{ event_id: string; chunk_ids: string[] }> {
  const event_id = generateId('evt');
  const chunk_ids: string[] = [];

  // Start transaction
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Insert event
    await client.query(
      `INSERT INTO events (event_id, tenant_id, session_id, channel,
                          actor_type, actor_id, kind, sensitivity, tags, content, refs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        event_id,
        event.tenant_id,
        event.session_id,
        event.channel,
        event.actor.type,
        event.actor.id,
        event.kind,
        event.sensitivity || 'none',
        event.tags || [],
        JSON.stringify(event.content),
        event.refs || []
      ]
    );

    // Auto-chunking
    const text = extractText(event);
    if (text) {
      const chunk_id = generateId('chk');
      chunk_ids.push(chunk_id);

      await client.query(
        `INSERT INTO chunks (chunk_id, tenant_id, event_id, ts, kind,
                            channel, sensitivity, tags, token_est, importance, text)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10)`,
        [
          chunk_id,
          event.tenant_id,
          event_id,
          event.kind,
          event.channel,
          event.sensitivity || 'none',
          event.tags || [],
          estimateTokens(text),
          calculateImportance(event),
          text
        ]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  return { event_id, chunk_ids };
}

function extractText(event: any): string {
  switch (event.kind) {
    case 'message':
      return event.content.text || '';
    case 'tool_result':
      return event.content.excerpt_text || '';
    case 'decision':
      return `${event.content.decision}\n${event.content.rationale?.join('\n') || ''}`;
    default:
      return '';
  }
}

function calculateImportance(event: any): number {
  if (event.kind === 'decision') return 1.0;
  if (event.kind === 'task_update') return 0.8;
  if (event.tags?.includes('pinned')) return 0.9;
  return 0.0;
}
```

### 2.4 Context Orchestrator

```typescript
// src/core/orchestrator.ts
import { generateId } from '../utils/id-generator.js';

export interface ACBRequest {
  tenant_id: string;
  session_id: string;
  agent_id: string;
  channel: 'private' | 'public' | 'team' | 'agent';
  intent: string;
  query_text: string;
  max_tokens: number;
}

export interface ACBResponse {
  acb_id: string;
  budget_tokens: number;
  token_used_est: number;
  sections: ACBSection[];
  omissions: ACBOmission[];
  provenance: ACBProvenance;
}

export async function buildACB(
  db: any,
  req: ACBRequest
): Promise<ACBResponse> {
  const acb_id = generateId('acb');
  const sections: ACBSection[] = [];
  let token_used = 0;

  // 1. Rules section (load from rules table or config)
  const rulesSection = await buildRulesSection(db, req, 6000);
  sections.push(rulesSection);
  token_used += rulesSection.token_est;

  // 2. Recent window (last N events)
  const recentSection = await buildRecentWindow(db, req, 8000);
  sections.push(recentSection);
  token_used += recentSection.token_est;

  // 3. Retrieved evidence (FTS search)
  const evidenceSection = await retrieveEvidence(db, req, 28000);
  sections.push(evidenceSection);
  token_used += evidenceSection.token_est;

  // 4. Decision ledger
  const decisionSection = await retrieveDecisions(db, req, 4000);
  sections.push(decisionSection);
  token_used += decisionSection.token_est;

  return {
    acb_id,
    budget_tokens: req.max_tokens,
    token_used_est: token_used,
    sections,
    omissions: [],
    provenance: {
      intent: req.intent,
      query_terms: extractTerms(req.query_text),
      candidate_pool_size: 0,
      filters: { sensitivity_allowed: getAllowedSensitivity(req.channel) },
      scoring: { alpha: 0.6, beta: 0.3, gamma: 0.1 }
    }
  };
}

async function retrieveEvidence(
  db: any,
  req: ACBRequest,
  maxTokens: number
): Promise<ACBSection> {
  const allowedSensitivity = getAllowedSensitivity(req.channel);
  const tsquery = toTsquery(req.query_text);
  const items: ACBItem[] = [];
  let tokenUsed = 0;

  // FTS search with candidate pool limit
  const result = await db.query(
    `SELECT chunk_id, text, token_est, refs, kind,
            ts_rank(tsv, $1) as rank
     FROM chunks
     WHERE tenant_id = $2
       AND sensitivity = ANY($3)
       AND tsv @@ $1
     ORDER BY rank DESC, ts DESC
     LIMIT 200`,
    [tsquery, req.tenant_id, allowedSensitivity]
  );

  for (const row of result.rows) {
    if (tokenUsed + row.token_est > maxTokens) break;

    items.push({
      type: 'text',
      text: row.text,
      refs: [row.chunk_id, ...row.refs]
    });
    tokenUsed += row.token_est;
  }

  return {
    name: 'retrieved_evidence',
    items,
    token_est: tokenUsed
  };
}

function getAllowedSensitivity(channel: string): string[] {
  switch (channel) {
    case 'public': return ['none', 'low'];
    case 'private':
    case 'team': return ['none', 'low', 'high'];
    case 'agent': return ['none', 'low'];
    default: return ['none'];
  }
}

function toTsquery(text: string): string {
  // Simple preprocessing for websearch_to_tsquery
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .join(' & ');
}

function extractTerms(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
}
```

---

## Step 3: HTTP API Setup

### 3.1 Express Routes

```typescript
// src/api/routes.ts
import express from 'express';
import { recordEvent } from '../core/recorder.js';
import { buildACB } from '../core/orchestrator.js';

const router = express.Router();

// Record event
router.post('/events', async (req, res) => {
  try {
    const result = await recordEvent(req.db, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Build ACB
router.post('/acb/build', async (req, res) => {
  try {
    const acb = await buildACB(req.db, req.body);
    res.json(acb);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### 3.2 Server Setup

```typescript
// src/server.ts
import express from 'express';
import pg from 'pg';
import routes from './api/routes.js';

const app = express();
app.use(express.json());

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'agent_memory',
  max: 20
});

// Attach db to request
app.use((req, res, next) => {
  req.db = pool;
  next();
});

app.use('/api/v1', routes);

app.listen(3000, () => {
  console.log('Memory daemon running on port 3000');
});
```

---

## Step 4: Docker Setup

### 4.1 docker-compose.yml

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: agent_memory
      POSTGRES_USER: memory
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  memory-daemon:
    build: .
    environment:
      PGHOST: postgres
      PGDATABASE: agent_memory
      PGUSER: memory
      PGPASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "3000:3000"
    depends_on:
      - postgres

volumes:
  pgdata:
```

### 4.2 Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

---

## Step 5: Testing

### 5.1 Scenario Test Framework

```typescript
// tests/scenarios/scenario-runner.ts
import assert from 'assert';

export async function runScenario(
  name: string,
  setup: () => Promise<void>,
  steps: ScenarioStep[],
  assertions: Assertion[]
): Promise<boolean> {
  console.log(`Running scenario: ${name}`);

  await setup();

  for (const step of steps) {
    await step.action();
  }

  let passed = 0;
  for (const assertion of assertions) {
    try {
      await assertion.check();
      passed++;
    } catch (error) {
      console.error(`Assertion failed: ${assertion.description}`);
      console.error(error);
    }
  }

  console.log(`${name}: ${passed}/${assertions.length} assertions passed`);
  return passed === assertions.length;
}
```

### 5.2 Example Scenario Test

```typescript
// tests/scenarios/a1-legacy-onboarding.test.ts
import { runScenario } from './scenario-runner.js';
import { recordEvent, buildACB } from '../../src/core/index.js';

await runScenario(
  'A1: Legacy Project Onboarding',
  async () => {
    // Setup: clean database
  },
  [
    {
      action: async () => {
        await recordEvent(db, {
          tenant_id: 'test',
          session_id: 's1',
          channel: 'private',
          actor: { type: 'human', id: 'user' },
          kind: 'message',
          content: { text: 'what this project for?' }
        });
      }
    }
    // ... more steps
  ],
  [
    {
      description: 'ACB should be ≤ 65K tokens',
      check: async () => {
        const acb = await buildACB(db, { /* ... */ });
        assert(acb.token_used_est <= 65000);
      }
    }
  ]
);
```

---

## Performance Checklist

### Before Production

- [ ] Add connection pooling (pg.Pool max 20)
- [ ] Enable prepared statements
- [ ] Add query result caching (Redis optional)
- [ ] Index all foreign keys
- [ ] Set up slow query logging
- [ ] Configure statement timeouts
- [ ] Add metrics/monitoring

### Query Optimization Tips

```sql
-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM chunks
WHERE tenant_id = 't1'
  AND tsv @@ to_tsquery('english', 'project');

-- Monitor index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'chunks';
```

---

## Common Issues

### Issue 1: FTS Not Returning Results
**Solution:** Check `tsvector` generation and text preprocessing
```sql
-- Verify tsv content
SELECT text, tsv FROM chunks LIMIT 5;
```

### Issue 2: ACB Exceeds Budget
**Solution:** Implement early termination in section builders
```typescript
if (tokenUsed + item.token_est > maxTokens) break;
```

### Issue 3: Slow First Query
**Solution:** Warm up connection pool, consider materialized views for hot data

---

## Next Steps

1. **Week 1**: Setup PostgreSQL + schema, implement `recordEvent`
2. **Week 2**: Implement `buildACB` with FTS retrieval
3. **Week 3**: Add decision ledger, tasks, artifacts
4. **Week 4**: Performance optimization, scenario tests
5. **Week 5**: MCP wrapper, documentation, deployment

---

**For full requirements, see `PRD.md`**
