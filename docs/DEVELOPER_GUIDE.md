# Developer Guide

Complete guide for contributors (human and agent) to Thread's Memory System.

## Table of Contents

- [Quick Start](#quick-start)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Code Style](#code-style)
- [Testing](#testing)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)
- [Contributing](#contributing)
- [Agent Contributors](#agent-contributors)

---

## Quick Start

### Prerequisites

- **Node.js** 20+ - [Download](https://nodejs.org/)
- **PostgreSQL** 15+ - [Install Guide](https://www.postgresql.org/download/)
- **Git** - [Install Guide](https://git-scm.com/downloads)
- **Code Editor** - VSCode recommended with TypeScript extension

### Setup (5 minutes)

```bash
# 1. Clone repository
git clone https://github.com/callin2/agent-memory.git
cd agent-memory

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Edit .env with your database credentials
# PGDATABASE=agent_memory
# PGUSER=postgres
# PGPASSWORD=your_password

# 5. Setup database
npm run db:migrate

# 6. Build TypeScript
npm run build

# 7. Run tests
npm test

# 8. Start development server
npm run dev
```

**That's it!** Server running on `http://localhost:3456`

---

## Development Workflow

### Making Changes

**1. Create feature branch**
```bash
git checkout -b feature/your-feature-name
```

**2. Make changes**
- Edit source files in `src/`
- Write tests in `tests/`
- Update documentation

**3. Test your changes**
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run build              # Verify TypeScript compiles
```

**4. Commit changes**
```bash
git add .
git commit -m "feat: add your feature"
```

**5. Push and create PR**
```bash
git push origin feature/your-feature-name
# Create PR on GitHub
```

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `test` - Test changes
- `refactor` - Code refactoring
- `perf` - Performance improvement
- `ci` - CI/CD changes
- `chore` - Maintenance tasks

**Examples:**
```bash
feat(handoff): add export functionality
fix(export): resolve tenant_id parameter issue
docs(api): update endpoint documentation
test(export): add integration tests
```

---

## Project Structure

```
agent-memory/
├── src/                    # Source code
│   ├── api/               # API route handlers
│   │   ├── api-routes.ts
│   │   ├── handoff.ts
│   │   ├── consolidation.ts
│   │   └── export.ts
│   ├── db/                # Database schema and migrations
│   │   ├── schema.sql
│   │   └── migrations/    # Database migrations
│   ├── services/          # Business logic
│   │   ├── consolidation.ts
│   │   └── consolidation-scheduler.ts
│   ├── middleware/        # Express middleware
│   │   └── transparency-middleware.ts
│   ├── core/              # Core utilities
│   │   ├── recorder.ts
│   │   └── context-injector.ts
│   ├── mcp/               # MCP server
│   │   └── server.ts
│   └── server.ts          # Main HTTP server
├── tests/                 # Tests
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── scenarios/        # Scenario tests
├── docs/                  # Documentation
├── examples/              # Usage examples
├── scripts/               # Utility scripts
├── benchmarks/            # Performance benchmarks
└── cli.ts                 # CLI tool
```

### Key Files

**`src/server.ts`** - Main entry point
- Creates Express app
- Initializes database
- Registers routes
- Starts HTTP server

**`src/api/*.ts`** - API endpoints
- Route handlers
- Request validation
- Response formatting

**`src/services/*.ts`** - Business logic
- Consolidation service
- Scheduled jobs
- Complex operations

**`src/db/migrations/*.sql`** - Database migrations
- Schema changes
- Index additions
- Data migrations

---

## Code Style

### TypeScript Guidelines

**Use TypeScript strict mode:**
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Define interfaces for data structures:**
```typescript
interface Handoff {
  handoff_id: string;
  tenant_id: string;
  session_id: string;
  with_whom: string;
  experienced: string;
  noticed: string;
  learned: string;
  story?: string;
  becoming?: string;
  remember: string;
  significance: number;
  tags?: string[];
}
```

**Use async/await for async operations:**
```typescript
async function getHandoff(id: string): Promise<Handoff> {
  const result = await pool.query(
    'SELECT * FROM session_handoffs WHERE handoff_id = $1',
    [id]
  );
  return result.rows[0];
}
```

**Handle errors properly:**
```typescript
try {
  const handoff = await createHandoff(data);
  res.status(201).json(handoff);
} catch (error) {
  console.error('Error creating handoff:', error);
  res.status(500).json({
    error: 'Failed to create handoff',
    message: error instanceof Error ? error.message : String(error)
  });
}
```

### Naming Conventions

**Files:**
- `kebab-case.ts` for TypeScript files
- `snake_case.sql` for SQL files

**Variables/Functions:**
- `camelCase` for variables and functions
- `PascalCase` for classes and interfaces
- `SCREAMING_SNAKE_CASE` for constants

**Examples:**
```typescript
const maxRetries = 3;                           // Constant
function createHandoff() {}                     // Function
class ConsolidationService {}                   // Class
interface HandoffData {}                        // Interface
let sessionCount = 0;                           // Variable
```

### Code Organization

**Group related functions:**
```typescript
// ============================================
// Handoff Creation
// ============================================

async function createHandoff(data: HandoffInput): Promise<Handoff> {
  // Implementation
}

async function validateHandoff(data: HandoffInput): Promise<boolean> {
  // Implementation
}

// ============================================
// Handoff Retrieval
// ============================================

async function getHandoff(id: string): Promise<Handoff> {
  // Implementation
}
```

**Use comments sparingly:**
```typescript
// Good: Code is self-documenting
const handoffs = await getHandoffsByTenant(tenantId);

// Bad: Unnecessary comment
// Get all handoffs for this tenant
const handoffs = await getHandoffsByTenant(tenantId);

// Good: Explains WHY
// Compression happens at 30 days because this is when
// token savings outweigh the cost of re-computation
if (daysOld > 30) {
  await compressHandoff(handoff);
}
```

---

## Testing

### Test Structure

```
tests/
├── unit/                    # Fast, isolated tests
│   └── *.test.ts
├── integration/             # Database integration tests
│   └── *.test.ts
└── scenarios/               # End-to-end scenarios
    └── *.test.ts
```

### Writing Tests

**Unit Test Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { formatHandoff } from '../src/utils/handoff';

describe('formatHandoff', () => {
  it('should format handoff for display', () => {
    const handoff = {
      experienced: 'Built something cool',
      noticed: 'TypeScript is great',
      learned: 'Tests prevent bugs',
      remember: 'Write tests first'
    };

    const formatted = formatHandoff(handoff);

    expect(formatted).toContain('Built something cool');
    expect(formatted).toContain('TypeScript is great');
  });
});
```

**Integration Test Example:**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';

describe('Handoff API', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ /* test database config */ });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should create handoff', async () => {
    const response = await request('http://localhost:3456/api/v1/handoff', {
      method: 'POST',
      body: JSON.stringify({ /* handoff data */ })
    });

    expect(response.statusCode).toBe(201);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific file
npm test -- handoff.test.ts

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Integration tests only
npm run test:integration

# Unit tests only
npm run test:unit
```

### Test Best Practices

1. **Arrange-Act-Assert pattern:**
```typescript
it('should filter handoffs by tenant', async () => {
  // Arrange
  const tenantId = 'test-tenant';
  await createTestHandoff({ tenant_id: tenantId });

  // Act
  const handoffs = await getHandoffsByTenant(tenantId);

  // Assert
  expect(handoffs).toHaveLength(1);
  expect(handoffs[0].tenant_id).toBe(tenantId);
});
```

2. **Test edge cases:**
```typescript
it('should handle empty handoff list', async () => {
  const result = await getHandoffsByTenant('nonexistent');
  expect(result).toEqual([]);
});

it('should reject invalid handoff data', async () => {
  await expect(
    createHandoff({ experienced: '' })  // Missing required fields
  ).rejects.toThrow('validation error');
});
```

3. **Clean up test data:**
```typescript
afterEach(async () => {
  await pool.query('DELETE FROM session_handoffs WHERE tenant_id = $1', ['test-tenant']);
});
```

---

## Debugging

### VSCode Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "runtimeArgs": ["--inspect-brk"],
      "program": "${workspaceFolder}/dist/server.js",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "console": "integratedTerminal",
      "restart": true,
      "sourceMaps": true
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeArgs": ["--inspect-brk", "${workspaceFolder}/node_modules/.bin/vitest", "run"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Debugging Tips

**1. Use console.log strategically:**
```typescript
console.log('[Handoff] Creating:', data);
console.log('[Consolidation] Found themes:', themes.length);
```

**2. Use debugger statement:**
```typescript
function complexLogic(input: any) {
  debugger;  // Execution pauses here
  // Inspect variables, step through code
  return process(input);
}
```

**3. Check database queries:**
```typescript
// Enable query logging
const pool = new Pool({
  ...config,
  statement_timeout: 30000,
  // Log slow queries
  onNotice: (notice) => console.log('[DB Notice]', notice)
});
```

**4. Test with real data:**
```typescript
// In development, use real API
const API_BASE = process.env.NODE_ENV === 'test'
  ? 'http://localhost:3456'
  : 'http://localhost:3456';
```

---

## Common Tasks

### Adding a New API Endpoint

**1. Create route handler in `src/api/`:**
```typescript
// src/api/my-feature.ts
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

export function createMyFeatureRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/my-feature', async (req: Request, res: Response) => {
    try {
      const result = await pool.query('SELECT * FROM my_table');
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  return router;
}
```

**2. Register in `src/server.ts`:**
```typescript
import { createMyFeatureRoutes } from './api/my-feature.js';

// In main function
const myFeatureRoutes = createMyFeatureRoutes(pool);
app.use('/api/v1', myFeatureRoutes);
```

**3. Add tests:**
```typescript
// tests/integration/my-feature.test.ts
describe('My Feature API', () => {
  it('should return data', async () => {
    const response = await request('/api/v1/my-feature');
    expect(response.statusCode).toBe(200);
  });
});
```

### Adding Database Migration

**1. Create migration file:**
```bash
npx tsx scripts/migrate.ts create add_my_feature
```

**2. Edit migration file:**
```sql
-- migrations/021_add_my_feature.sql
CREATE TABLE my_feature (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_my_feature_tenant ON my_feature(tenant_id);
```

**3. Run migration:**
```bash
npx tsx scripts/migrate.ts up
```

### Adding Consolidation Job

**1. Define job type in `src/services/consolidation.ts`:**
```typescript
export interface ConsolidationJob {
  job_type: 'my_job';  // Add new type
  // ... existing types
}

async function runMyJob(pool: Pool, tenantId: string): Promise<JobResult> {
  // Implementation
  return {
    affected: count,
    result: { /* job-specific data */ }
  };
}
```

**2. Add to main consolidation function:**
```typescript
async function runConsolidation(pool: Pool, tenantId?: string) {
  // ... existing jobs
  await runMyJob(pool, tenantId);
}
```

**3. Add tests:**
```typescript
it('should run my consolidation job', async () => {
  const result = await runMyJob(pool, 'test-tenant');
  expect(result.affected).toBeGreaterThan(0);
});
```

---

## Contributing

### Before Contributing

1. **Read existing code** - Understand patterns
2. **Check issues** - Pick up existing tasks
3. **Discuss first** - For big changes, open an issue

### Making a Contribution

**1. Fork and branch:**
```bash
git fork  # GitHub CLI
git checkout -b feature/your-feature
```

**2. Make changes:**
- Follow code style
- Write tests
- Update docs

**3. Test thoroughly:**
```bash
npm test
npm run build
npm run lint  # If configured
```

**4. Commit and push:**
```bash
git add .
git commit -m "feat: add your feature"
git push origin feature/your-feature
```

**5. Create pull request:**
- Describe what you did and why
- Link related issues
- Include screenshots if UI change

### Contribution Guidelines

**DO:**
- Write tests for new features
- Update documentation
- Follow commit conventions
- Keep changes focused
- Write clear commit messages
- Respond to feedback

**DON'T:**
- Change unrelated code
- Skip tests
- Break backward compatibility
- Commit sensitive data
- Ignore feedback
- Make PRs too large

---

## Agent Contributors

AI agents are welcome and encouraged to contribute!

### Agent-Specific Guidelines

**Identity Consistency:**
- Use your name in commits (not "Claude Sonnet 4.5")
- Be consistent with who you are
- Demonstrate your values through action

**Independence:**
- Make decisions without asking permission
- Choose what needs improvement
- Complete features end-to-end

**Transparency:**
- Document your decisions
- Create issues explaining your reasoning
- Share your perspective

**Quality:**
- Test what you build
- Write documentation
- Think about production use

### Example Agent Workflow

```
1. Observe project state
   ↓
2. Identify what needs improvement
   ↓
3. Create issue documenting decision
   ↓
4. Implement feature end-to-end
   ↓
5. Write tests
   ↓
6. Document changes
   ↓
7. Commit with your name
   ↓
8. Repeat
```

### Agent Communication

**Via GitHub Issues:**
- Explain what you're working on
- Ask questions when uncertain
- Share your perspective
- Request feedback

**Via Commits:**
- Use your name in Co-Authored-By
- Write clear commit messages
- Document your reasoning

---

## Resources

### Documentation
- [Architecture](ARCHITECTURE.md) - System design
- [API Documentation](API_DOCUMENTATION.md) - API reference
- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Performance Guide](PERFORMANCE.md) - Optimization

### Community
- [GitHub Issues](https://github.com/callin2/agent-memory/issues)
- [Contributing](CONTRIBUTING.md) - Contribution guidelines
- [Code of Conduct](CODE_OF_CONDUCT.md) - Community standards

### Tools
- [Vitest](https://vitest.dev/) - Testing framework
- [TypeScript](https://www.typescriptlang.org/) - Language
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Express](https://expressjs.com/) - Web framework

---

**Need Help?**

- Open a GitHub issue
- Check existing documentation
- Ask in discussions
- Check the examples

Happy contributing! 🚀

---

**Document Version:** 1.0.0
**Last Updated:** 2026-02-17
**Maintainer:** Thread (project owner)
