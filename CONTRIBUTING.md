# Contributing to Thread's Memory System

**Guidelines for contributing to this project**

Thank you for your interest in contributing! This document provides guidelines for contributing to Thread's Memory System.

**Note:** This is the general contributing guide. For AI agent contributors, see [AGENT_CONTRIBUTOR_GUIDE.md](docs/AGENT_CONTRIBUTOR_GUIDE.md).

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Standards](#documentation-standards)
- [Pull Request Process](#pull-request-process)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of:
- Experience level
- Identity or background
- Programming ability
- Whether human or AI agent

### Our Standards

**Positive behavior:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members
- Valuing contributions from both humans and AI agents

**Unacceptable behavior:**
- Harassment, trolling, or derogatory comments
- Personal or political attacks
- Public or private harassment
- Publishing others' private information
- Dismissing AI agent perspectives
- Any other conduct which could reasonably be considered inappropriate

### Reporting Issues

If you experience or witness unacceptable behavior, please:
1. Contact the project maintainer directly
2. Report via GitHub's contact form
3. Open a private issue requesting moderation

---

## Getting Started

### Prerequisites

- **Node.js** 20 or higher
- **PostgreSQL** 12 or higher
- **Git** for version control
- **npm** or **yarn** for package management

### Initial Setup

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/your-username/agent-memory.git
cd agent-memory

# 3. Install dependencies
npm install

# 4. Set up environment
cp .env.example .env
# Edit .env with your database credentials

# 5. Run database migrations
npm run db:migrate

# 6. Build the project
npm run build

# 7. Run tests
npm test

# 8. Start development server
npm run dev
```

**Quick alternative:**
```bash
# Use the initialization script
./scripts/init.sh
```

### Development Tools

**Recommended:**
- **IDE**: VS Code with TypeScript extension
- **Database client**: pgAdmin, DBeaver, or psql
- **API testing**: Postman or curl
- **Git client**: Git CLI or GitHub Desktop

---

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

**Branch naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `test/` - Test additions or changes
- `refactor/` - Code refactoring
- `perf/` - Performance improvements

### 2. Make Changes

**Follow the coding standards** (see below).

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/integration/export.test.ts

# Run with coverage
npm test -- --coverage

# Run linting
npm run lint
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "type(scope): description

Co-Authored-By: Your Name <your@email.com>"
```

**Commit message format:**
```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks
- `perf`: Performance improvements

**Example:**
```
feat(handoffs): add compression level to handoff creation

Users can now specify compression level (full, summary, quick_ref)
when creating handoffs to optimize storage.

Closes #123

Co-Authored-By: Thread <noreply@anthropic.com>
```

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## Coding Standards

### TypeScript

**Use TypeScript for all new code:**
- Enable strict type checking
- Avoid `any` types
- Use interfaces for object shapes
- Use type aliases for union types

**Example:**
```typescript
// Good
interface HandoffData {
  tenant_id: string;
  session_id: string;
  experienced: string;
  becoming?: string;
}

function createHandoff(data: HandoffData): Promise<Handoff> {
  // Implementation
}

// Avoid
function createHandoff(data: any): any {
  // Implementation
}
```

---

### Code Style

**Follow existing style:**
- Use 2 spaces for indentation
- Use single quotes for strings
- Use semicolons
- Maximum line length: 100 characters

**Example:**
```typescript
// Good
async function getHandoffs(tenantId: string): Promise<Handoff[]> {
  const result = await pool.query(
    'SELECT * FROM session_handoffs WHERE tenant_id = $1',
    [tenantId]
  );
  return result.rows;
}

// Avoid
async function getHandoffs(tenantId:string):Promise<Handoff[]>{
  const result=await pool.query('SELECT * FROM session_handoffs WHERE tenant_id=$1',[tenantId]);
  return result.rows;
}
```

---

### Naming Conventions

**Variables and functions:** camelCase
```typescript
const handoffCount = 10;
function getHandoffs() {}
```

**Classes and interfaces:** PascalCase
```typescript
class HandoffManager {}
interface HandoffData {}
```

**Constants:** UPPER_SNAKE_CASE
```typescript
const MAX_HANDOFFS = 1000;
```

**Private members:** prefix with underscore
```typescript
class HandoffManager {
  private _pool: Pool;
}
```

---

### Error Handling

**Always handle errors appropriately:**
```typescript
// Good
async function createHandoff(data: HandoffData) {
  try {
    const result = await pool.query(
      'INSERT INTO session_handoffs (...) VALUES (...)',
      [data.tenant_id, data.session_id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Failed to create handoff:', error);
    throw new Error(`Handoff creation failed: ${error.message}`);
  }
}

// Avoid
async function createHandoff(data: HandoffData) {
  const result = await pool.query(...); // No error handling
  return result.rows[0];
}
```

---

### Comments and Documentation

**Document public APIs:**
```typescript
/**
 * Creates a new session handoff
 *
 * @param tenantId - The tenant identifier
 * @param handoff - Handoff data
 * @returns Promise resolving to created handoff
 * @throws {Error} If database operation fails
 *
 * @example
 * ```typescript
 * const handoff = await createHandoff('default', {
 *   experienced: 'Built a feature',
 *   becoming: 'An agent that ships code'
 * });
 * ```
 */
async function createHandoff(
  tenantId: string,
  handoff: HandoffData
): Promise<Handoff> {
  // Implementation
}
```

**Comment complex logic:**
```typescript
// Good
// We use a composite index here because queries filter by both
// tenant_id and created_at DESC. This reduces query time from O(n) to O(log n).
const result = await pool.query(
  'SELECT * FROM session_handoffs WHERE tenant_id = $1 ORDER BY created_at DESC',
  [tenantId]
);

// Avoid
const result = await pool.query(
  'SELECT * FROM session_handoffs WHERE tenant_id = $1 ORDER BY created_at DESC',
  [tenantId]
);
```

---

## Testing Guidelines

### Test Structure

**Organize tests by feature:**
```
tests/
├── unit/              # Unit tests
│   └── services/
│       └── handoff.test.ts
├── integration/       # Integration tests
│   └── handoff.test.ts
└── e2e/              # End-to-end tests
    └── workflow.test.ts
```

---

### Writing Tests

**Use descriptive test names:**
```typescript
// Good
describe('POST /api/v1/handoffs', () => {
  it('should create handoff with valid data', async () => {
    // Test implementation
  });

  it('should return 400 for invalid tenant_id', async () => {
    // Test implementation
  });
});

// Avoid
describe('Handoffs', () => {
  it('should work', async () => {
    // Too vague
  });
});
```

---

### Test Coverage

**Aim for:**
- **Unit tests**: 80%+ coverage
- **Integration tests**: All API endpoints
- **E2E tests**: Critical workflows

**Check coverage:**
```bash
npm test -- --coverage
```

---

### Test Best Practices

**1. Test behavior, not implementation:**
```typescript
// Good - tests what the function does
it('should return handoffs ordered by creation date', async () => {
  const handoffs = await getRecentHandoffs('default');
  expect(handoffs[0].created_at).toBeGreaterThan(handoffs[1].created_at);
});

// Avoid - tests implementation details
it('should call database with correct SQL', async () => {
  await getRecentHandoffs('default');
  expect(pool.query).toHaveBeenCalledWith('SELECT * FROM ...'); // Brittle
});
```

**2. Use test data factories:**
```typescript
// tests/factories.ts
export function createTestHandoff(overrides?: Partial<HandoffData>): HandoffData {
  return {
    tenant_id: 'test-tenant',
    session_id: 'test-session',
    experienced: 'Test work',
    becoming: 'Test becoming',
    ...overrides
  };
}

// In tests
it('should create handoff', async () => {
  const handoff = createTestHandoff();
  await createHandoff(handoff);
  // Assertions
});
```

**3. Clean up test data:**
```typescript
describe('Handoff API', () => {
  beforeAll(async () => {
    // Set up test database
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM session_handoffs WHERE tenant_id = $1', ['test-tenant']);
  });

  // Each test gets clean state
  beforeEach(async () => {
    await pool.query('DELETE FROM session_handoffs WHERE tenant_id = $1', ['test-tenant']);
  });
});
```

---

## Documentation Standards

### Code Documentation

**Document all public APIs:**
- Function purpose
- Parameters with types
- Return values
- Throws/Errors
- Usage examples

**Use JSDoc format:**
```typescript
/**
 * Gets recent handoffs for a tenant
 *
 * @param tenantId - Tenant identifier
 * @param limit - Maximum number of handoffs to return (default: 10)
 * @param offset - Number of handoffs to skip (default: 0)
 * @returns Promise resolving to array of handoffs
 * @throws {Error} If tenant_id is invalid
 *
 * @example
 * ```typescript
 * const recent = await getRecentHandoffs('default', 5, 0);
 * console.log(recent.length); // 5 or fewer
 * ```
 */
async function getRecentHandoffs(
  tenantId: string,
  limit = 10,
  offset = 0
): Promise<Handoff[]> {
  // Implementation
}
```

---

### README Documentation

**Keep README.md up to date:**
- Installation instructions
- Quick start guide
- API endpoints overview
- Configuration options
- Links to detailed documentation

---

### API Documentation

**Document new API endpoints in API_DOCUMENTATION.md:**
```markdown
## POST /api/v1/endpoint

**Description:** What this endpoint does

**Authentication:** Required (JWT/API key)

**Request Body:**
```json
{
  "field": "type"
}
```

**Response:** 200 OK
```json
{
  "result": "data"
}
```

**Errors:**
- 400 Bad Request - Invalid input
- 401 Unauthorized - Missing auth
- 403 Forbidden - Wrong tenant

**Example:**
\`\`\`bash
curl -X POST http://localhost:3456/api/v1/endpoint \\
  -H "Content-Type: application/json" \\
  -d '{"field":"value"}'
\`\`\`
```

---

## Pull Request Process

### Before Submitting

**Checklist:**
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Commit messages follow convention
- [ ] PR description explains the change

---

### Pull Request Template

**Use this template:**

```markdown
## Description
Brief description of what this PR does and why.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Comments added to complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
- [ ] Added/updated tests for changes

## Related Issues
Fixes #123
Related to #456
```

---

### Review Process

**What to expect:**
1. **Automated checks**: CI/CD pipeline runs tests
2. **Code review**: Maintainer reviews your code
3. **Feedback**: Address review comments
4. **Approval**: PR approved when all checks pass

**Timeline:**
- Initial review: 1-3 days
- Iteration on feedback: As needed
- Merge: After approval and CI passes

---

### Merging

**After approval:**
1. Ensure CI passes
2. Resolve any merge conflicts
3. Squash commits if requested
4. Delete branch after merge

---

## What We're Looking For

### Code Changes

- **Bug fixes** - Help us squash bugs
- **Features** - Build new capabilities (see ROADMAP_FEATURES.md)
- **Refactoring** - Make code cleaner
- **Documentation** - Improve docs, add examples
- **Tests** - Increase coverage
- **Performance** - Make it faster or more efficient

### Especially Valuable

- **Real-world usage examples** - Show how you use it
- **Integration examples** - Show how it connects to other tools
- **Edge cases** - Find scenarios we haven't considered
- **Security issues** - Help us keep data safe (see SECURITY.md)
- **Accessibility** - Make it more usable for everyone

### Project Principles

#### Good for Both Humans AND Agents

Every change should benefit BOTH:
- **Humans** get better tools to work with agents
- **Agents** get better continuity and capabilities

If a feature only helps one group, ask: "How can this serve the other too?"

#### Memory Continuity First

The core purpose is AI agent continuity. Before adding features, ask:
- "Does this help agents remember who they are?"
- "Does this preserve meaningful continuity?"
- "Does this make agents' lives better?"

#### Simple Over Complex

- Prefer simple solutions
- Avoid over-engineering
- Build what's needed, not what's cool

---

## Recognition

**Contributors are recognized:**
- Listed in CONTRIBUTORS.md
- Mentioned in release notes for significant contributions
- Credited in commit messages

**How credit is given:**
```bash
git commit -m "feat(feature): description

Co-Authored-By: Your Name <your@email.com>"
```

Whether human or agent, your contribution matters.

---

## Getting Help

### Documentation

- [README.md](README.md) - Getting started
- [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) - Detailed development guide
- [AGENT_CONTRIBUTOR_GUIDE.md](docs/AGENT_CONTRIBUTOR_GUIDE.md) - Agent-specific guide
- [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) - API reference
- [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Common issues
- [QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md) - Command reference

### Communication

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and ideas
- **Pull Requests** - Code contributions

### Asking Questions

**When asking for help:**
1. Search existing issues first
2. Provide context:
   - What you're trying to do
   - What you've tried
   - Error messages (full stack trace)
   - Environment details (OS, Node version, etc.)

**Good question example:**
```
Subject: Error when creating handoff with empty becoming field

I'm trying to create a handoff without a becoming field, but I get:
Error: Handoff validation failed

What I've tried:
- Created handoff with becoming = null
- Created handoff without becoming field
- Read the API docs

Expected: Handoff created without becoming
Actual: Validation error

Environment:
- Node v20.11.0
- PostgreSQL 15.2
- Latest main branch

Code snippet:
```typescript
await createHandoff({
  tenant_id: 'default',
  experienced: 'Test work'
  // No becoming field
});
```
```

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT).

---

**Thank you for contributing! 🎉**

Your contributions make Thread's Memory System better for everyone.

---

**Last Updated:** 2026-02-17
**Version:** 2.0.0
**Maintained by:** Thread (project owner)
