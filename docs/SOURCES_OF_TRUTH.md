# Sources of Truth

**Last updated**: 2026-02-19
**Maintainer**: Project team (humans and agents)
**Purpose**: Single source of truth for what is CURRENT in this codebase.

> **IMPORTANT**: This is the FIRST file to read when working on this project.
> If something is not listed here or marked as outdated, it should NOT be used.

---

## Quick Status

| Component | Status | Notes |
|-----------|--------|-------|
| MCP Server | ✅ HTTP (current) | Migrated from SSE, 14 tools available |
| Authentication | ✅ Bearer token (current) | HTTP header auth, n8n-style |
| WAL System | ✅ Operational | Fault tolerance for memory operations |
| Memory Client v2 | ✅ Current | Unified parameter handling + feedback loop |
| Quick Reference | ✅ Current | Fast documentation lookup via get_quick_reference |
| REST API | ✅ Running | Express.js on port 3000 |
| Database | ✅ PostgreSQL | Schema in `src/db/schema.sql` |
| Tests | ✅ Organized | Migrated to `tests/integration/`, `tests/manual/`, `tests/debug/` |
| Documentation | ✅ Current | See "Truth Table" below |

---

## Truth Table

### Configuration Files

| File | Purpose | Status | Last Updated |
|------|---------|--------|--------------|
| `.mcp.json` | MCP client configuration | ✅ Current | 2026-02-19 |
| `ecosystem.config.js` | PM2 process manager | ✅ Current | 2026-02-19 |
| `package.json` | Dependencies and scripts | ✅ Current | 2026-02-19 |
| `tsconfig.json` | TypeScript configuration | ✅ Current | 2024-02-17 |
| `.env.dev` | Development environment | ✅ Current | 2024-02-17 |

### Source Code

| File/Directory | Purpose | Status | Last Updated |
|----------------|---------|--------|--------------|
| `src/mcp/memory-server-http.ts` | HTTP MCP server | ✅ Current | 2026-02-19 |
| `src/mcp/auth.ts` | Bearer token authentication | ✅ Current | 2026-02-19 |
| `src/server.ts` | Main REST API server | ✅ Current | 2024-02-17 |
| `src/api/` | REST API route modules | ✅ Current | 2024-02-17 |
| `src/services/` | Business logic services | ✅ Current | 2024-02-17 |
| `src/db/schema.sql` | Database schema | ✅ Current | 2024-02-17 |

### Memory Fault Tolerance (WAL System)

| File | Purpose | Status | Last Updated |
|------|---------|--------|--------------|
| `src/utils/wal.js` | Write-Ahead Logging core | ✅ Current | 2026-02-19 |
| `src/utils/memory-client.js` | Memory client with WAL fallback | ✅ Current | 2026-02-19 |
| `src/utils/memory-client-v2.js` | Memory client v2 - unified params + feedback | ✅ Current | 2026-02-19 |
| `scripts/replay-wal.js` | Manual WAL replay script | ✅ Current | 2026-02-19 |
| `.memory-wal/operations.jsonl` | WAL log file (auto-created) | ✅ Current | 2026-02-19 |

**How WAL Works**:
1. **Normal operation**: Memory operations go directly to MCP server
2. **MCP down**: Operations automatically saved to `.memory-wal/operations.jsonl`
3. **MCP recovers**: WAL operations replayed automatically on wake_up
4. **Success**: WAL cleared after all operations replayed

**Usage**: Import `tryMemoryOperation` from `src/utils/wal.js` or use `MemoryClient` from `src/utils/memory-client.js`

### Quick Reference System

| File | Purpose | Status | Last Updated |
|------|---------|--------|--------------|
| `src/utils/quick-reference.ts` | Fast documentation lookup | ✅ Current | 2026-02-19 |

**Available Topics**: `mcp_tools`, `common_tasks`, `project_structure`, `troubleshooting`, `database_schema`

**Usage**: Call `get_quick_reference` tool with topic parameter. Much faster than reading entire SOURCES_OF_TRUTH.md.

### Removed Source Code

| File | Replaced By | Removed Date |
|------|-------------|--------------|
| `src/mcp/memory-server.ts` | `memory-server-http.ts` | 2026-02-19 |
| `src/mcp/context.ts` | HTTP-level auth | 2026-02-19 |

### MCP Tools (11 Total)

All tools available in `src/mcp/memory-server-http.ts`:

| Tool | Purpose | Status |
|------|---------|--------|
| `wake_up` | Load memories with identity-first approach | ✅ Current |
| `create_handoff` | Create session handoff | ✅ Current |
| `get_last_handoff` | Get most recent handoff | ✅ Current |
| `get_identity_thread` | Get identity evolution over time | ✅ Current |
| `list_handoffs` | List all handoffs with filters | ✅ Current |
| `create_knowledge_note` | Create quick knowledge note | ✅ Current |
| `get_knowledge_notes` | Get knowledge notes | ✅ Current |
| `list_semantic_principles` | List timeless learnings | ✅ Current |
| `create_capsule` | Create secure memory capsule | ✅ Current |
| `get_capsules` | List available capsules | ✅ Current |
| `get_compression_stats` | Get token savings statistics | ✅ Current |
| `agent_feedback` | Submit system feedback (friction, bugs, suggestions) | ✅ Current | 2026-02-19 |
| `get_agent_feedback` | Retrieve agent feedback | ✅ Current | 2026-02-19 |
| `update_agent_feedback` | Mark feedback as addressed/reviewed/rejected | ✅ Current | 2026-02-19 |
| `get_quick_reference` | Fast documentation lookup (5 topics available) | ✅ Current | 2026-02-19 |

### Documentation - Primary Sources

| File | Topic | Status | Last Updated |
|------|-------|--------|--------------|
| **[ONBOARDING.md](./ONBOARDING.md)** | Getting started guide | ✅ Current | 2026-02-19 |
| **[AGENTS.md](./AGENTS.md)** | Repo layout for agents | ✅ Current | 2026-02-19 |
| **[MCP_QUICK_START.md](./MCP_QUICK_START.md)** | MCP server setup | ✅ Current | 2026-02-19 |
| **[MCP_HTTP_AUTH.md](./MCP_HTTP_AUTH.md)** | Authentication guide | ✅ Current | 2026-02-19 |
| **[MAINTENANCE.md](./MAINTENANCE.md)** | Maintenance protocol | ✅ Current | 2026-02-19 |
| **[README.md](./README.md)** | Project overview | ✅ Current | 2024-02-17 |
| **[CLAUDE.md](../CLAUDE.md)** | Coding guidelines | ✅ Current | 2024-02-17 |
| **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** | REST API reference | ⚠️ Needs review | 2024-02-17 |
| **[CHANGELOG.md](./CHANGELOG.md)** | Version history | ✅ Current | 2026-02-19 |

### Documentation - Secondary Sources (Use with Caution)

| File | Topic | Status | Notes |
|------|-------|--------|-------|
| `AUTHENTICATION.md` | Auth overview | ⚠️ Partially outdated | Some sections may not reflect HTTP MCP |
| `ARCHITECTURE.md` | System architecture | ⚠️ Needs review | May not reflect current HTTP transport |
| `DEPLOYMENT.md` | Deployment guide | ⚠️ Needs review | Verify with current setup |
| `DEVELOPER_GUIDE.md` | Developer info | ⚠️ Needs review | Some sections outdated |
| `PM2-SETUP.md` | PM2 configuration | ✅ Mostly current | Cross-check with ecosystem.config.js |

### Documentation - Outdated (DO NOT USE)

| File | Topic | Replaced By |
|------|-------|-------------|
| `MCP_AUTHENTICATION.md` | Old SSE auth | `MCP_HTTP_AUTH.md` |
| `OAUTH_QUICK_REFERENCE.md` | OAuth guide | `AUTHENTICATION.md` (needs review) |
| `QUICK_REFERENCE.md` | General quick ref | See ONBOARDING.md |
| `QUICK-REFERENCE.md` | Duplicate quick ref | See ONBOARDING.md |

### Documentation - Archived (Historical Only)

Located in `docs/archive/`:

| Directory | Contents |
|-----------|----------|
| `archive/phases/` | Phase implementation reports (PHASE_1, PHASE_2, PHASE_3) |
| `archive/progress/` | Historical progress updates, test results |
| `archive/tests/` | Historical test summaries |

**Note**: These are kept for historical reference but do NOT reflect current state.

### Tests

| Location | Contents | Status |
|----------|----------|--------|
| `tests/integration/mcp/` | MCP server integration tests | ✅ Current |
| `tests/unit/` | Unit tests | ✅ Current |
| `tests/integration/` | Integration tests | ✅ Current |
| `tests/manual/` | Manual test scripts | ⚠️ Use with caution |
| `tests/debug/` | Debug utilities | ⚠️ For debugging only |

### Root Directory

| File | Purpose | Status |
|------|---------|--------|
| `run-migrations.mjs` | Database migrations | ✅ Keep in root |

---

## Common Tasks: What to Read

### Setting Up MCP Server
1. Read: [MCP_QUICK_START.md](./MCP_QUICK_START.md)
2. Configure: `.mcp.json`
3. Start: `pm2 start ecosystem.config.js`

### Adding a New MCP Tool
1. Edit: `src/mcp/memory-server-http.ts` (add to tool list and handler)
2. Update: `docs/MCP_QUICK_START.md` (add to tool list)
3. Update: This file (add to MCP Tools table)
4. Test: Create test in `tests/integration/mcp/`
5. Commit: All changes together

### Debugging Authentication
1. Read: [MCP_HTTP_AUTH.md](./MCP_HTTP_AUTH.md)
2. Check: Bearer token in Authorization header
3. Verify: Token exists in `mcp_tokens` table
4. Test: `node tests/integration/mcp/test-mcp-auth.mjs`

### Updating REST API
1. Edit: `src/api/*-routes.ts`
2. Update: `docs/API_DOCUMENTATION.md` (if needed)
3. Test: Add/update test in `tests/integration/`
4. Commit: All changes together

### Changing Database Schema
1. Create migration in `src/db/migrations/`
2. Update `src/db/schema.sql`
3. Run: `run-migrations.mjs`
4. Update: Any services affected
5. Update: Documentation if user-visible

---

## File Organization

```
agent_memory_v2/
├── CLAUDE.md                      # Coding guidelines
├── SOURCES_OF_TRUTH.md            # THIS FILE - start here
├── ecosystem.config.js            # PM2 configuration
├── .mcp.json                      # MCP client config
├── run-migrations.mjs             # Database migrations
│
├── src/
│   ├── mcp/
│   │   ├── memory-server-http.ts  # ✅ HTTP MCP server
│   │   └── auth.ts                # ✅ Bearer token auth
│   ├── server.ts                  # ✅ REST API server
│   ├── api/                       # ✅ REST routes
│   ├── services/                  # ✅ Business logic
│   └── db/
│       ├── schema.sql             # ✅ Database schema
│       └── migrations/            # ✅ Database migrations
│
├── tests/
│   ├── integration/mcp/           # ✅ MCP tests
│   ├── unit/                      # ✅ Unit tests
│   ├── integration/               # ✅ Integration tests
│   ├── manual/                    # ⚠️ Manual test scripts
│   └── debug/                     # ⚠️ Debug utilities
│
└── docs/
    ├── ONBOARDING.md              # ✅ Start here
    ├── SOURCES_OF_TRUTH.md        # ✅ THIS FILE
    ├── MAINTENANCE.md             # ✅ How to maintain
    ├── AGENTS.md                  # ✅ Repo layout
    ├── MCP_QUICK_START.md         # ✅ MCP setup
    ├── MCP_HTTP_AUTH.md           # ✅ Auth guide
    ├── API_DOCUMENTATION.md       # ⚠️ API reference
    ├── CHANGELOG.md               # ✅ Version history
    ├── README.md                  # ✅ Project overview
    └── archive/                   # 📦 Historical docs
        ├── phases/
        ├── progress/
        └── tests/
```

---

## Maintenance Protocol

When making changes:

1. **Read this file first** - Know what's current
2. **Make your changes** - Edit the appropriate files
3. **Update this file** - If you change what's "current"
4. **Test thoroughly** - Ensure nothing breaks
5. **Commit with clear message** - Reference related docs

See [MAINTENANCE.md](./MAINTENANCE.md) for detailed protocol.

---

## How to Use This File

### For Agents
```
Before ANY work:
1. Read the relevant section in this file
2. Identify the correct file to edit
3. Make changes
4. Update this file if status changed
5. Commit with detailed message
```

### For Humans
```
When joining:
1. Read ONBOARDING.md (5 minutes)
2. Read this file (5 minutes)
3. Read relevant source doc (10-20 minutes)
4. Start working with confidence

When reviewing:
1. Check if agent updated this file
2. Verify changes match this file
3. Update if agent missed something
```

### For Both
```
Weekly review:
1. Skim this file for accuracy
2. Check for stale "✅ Current" markers
3. Update if needed
4. Keep the truth alive
```

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Current | Actively maintained, reflects reality |
| ⚠️ Needs Review | Mostly accurate but may have outdated sections |
| ❌ Outdated | Do NOT use, see replacement |
| 📦 Archived | Historical reference only |

---

## Questions?

**"Is this doc current?"** → Check this file's Truth Table

**"Where do I start?"** → Read ONBOARDING.md

**"What changed?"** → Read CHANGELOG.md

**"How do I contribute?"** → Read MAINTENANCE.md

**"What's the architecture?"** → Read ARCHITECTURE.md (then cross-check with code)

---

**Remember**: This file is only as useful as we keep it accurate.
When in doubt, update this file. It's the foundation of our collaboration.

**Last reviewed by**: Human + Agent collaboration
**Next review date**: Weekly during team sync
