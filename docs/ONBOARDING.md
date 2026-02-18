# Onboarding

Welcome to Thread's Memory System v2.0!

This document is your starting point. It will direct you to the right places based on who you are and what you want to do.

---

## Quick Links

- **[SOURCES_OF_TRUTH.md](./SOURCES_OF_TRUTH.md)** - What's current in this codebase ⭐ **Read this first**
- **[AGENTS.md](./AGENTS.md)** - Repository layout and conventions
- **[MCP_QUICK_START.md](./MCP_QUICK_START.md)** - Set up the MCP server
- **[README.md](./README.md)** - Project overview
- **[CHANGELOG.md](./CHANGELOG.md)** - Recent changes

---

## Who Are You?

### I'm a Human, New to the Project

**Time to get started**: 15-30 minutes

1. **Read Project Overview** (5 min)
   - [README.md](./README.md) - What is this system?
   - [CHANGELOG.md](./CHANGELOG.md) - What's new?

2. **Understand Current State** (5 min)
   - [SOURCES_OF_TRUTH.md](./SOURCES_OF_TRUTH.md) - What's actually current
   - Focus on the "Truth Table" section

3. **Set Up Development Environment** (10-15 min)
   - Install dependencies: `npm install`
   - Set up database: See [DATABASE_SETUP.md](./DATABASE_SETUP.md)
   - Start the server: `npm run dev`

4. **Start Contributing**
   - Read [CONTRIBUTING.md](./CONTRIBUTING.md)
   - Read [CLAUDE.md](../CLAUDE.md) for coding guidelines

---

### I'm a Human, Returning to the Project

**Time to catch up**: 5-10 minutes

1. **Check What's Current** (3 min)
   - [SOURCES_OF_TRUTH.md](./SOURCES_OF_TRUTH.md) - Quick status check
   - [CHANGELOG.md](./CHANGELOG.md) - What changed since you left?

2. **Refresh Your Knowledge** (2-5 min)
   - Skim [AGENTS.md](./AGENTS.md) - Repo layout
   - Check files you'll be working with

3. **Start Working**
   - Go!

---

### I'm an AI Agent, Starting a Session

**Time to orient**: 2-5 minutes

1. **READ THIS FIRST** (1 min)
   - [SOURCES_OF_TRUTH.md](./SOURCES_OF_TRUTH.md) - ⭐ Critical!
   - This tells you what's real vs outdated

2. **Understand Code Patterns** (2 min)
   - [AGENTS.md](./AGENTS.md) - Where things go
   - [CLAUDE.md](../CLAUDE.md) - Coding guidelines

3. **Check Recent Changes** (1 min)
   - [CHANGELOG.md](./CHANGELOG.md) - Latest commits

4. **Start Working**
   - Always verify files against SOURCES_OF_TRUTH.md
   - Update SOURCES_OF_TRUTH.md if you change what's current

---

### I'm an AI Agent, Here for a Specific Task

**Time to orient**: 1-2 minutes

1. **READ SOURCES_OF_TRUTH.md** (30 sec)
   - Jump to the section for your task
   - Verify which files to edit

2. **Read Relevant Docs** (30 sec)
   - Skim the specific doc you need
   - Don't read everything - focus on your task

3. **Execute Task**
   - Make changes
   - Update SOURCES_OF_TRUTH.md if needed
   - Commit with clear message

---

### I'm Reviewing Code / Debugging

**Time to understand**: 5-10 minutes

1. **Check What's Current** (2 min)
   - [SOURCES_OF_TRUTH.md](./SOURCES_OF_TRUTH.md) - Verify status

2. **Read the Change** (3 min)
   - Check git commit message
   - Read changed files

3. **Verify Against Sources** (2 min)
   - Does the change match SOURCES_OF_TRUTH.md?
   - Were docs updated if needed?
   - Were tests updated/added?

4. **Provide Feedback**
   - Be specific about what's wrong
   - Reference SOURCES_OF_TRUTH.md

---

## What Do You Want To Do?

### Set Up the MCP Server

**Read**: [MCP_QUICK_START.md](./MCP_QUICK_START.md)

**Quick version**:
```bash
# Configure .mcp.json
cat .mcp.json

# Start server
pm2 start ecosystem.config.js

# Test connection
node tests/integration/mcp/test-mcp-simple.mjs
```

**Time**: 10 minutes

---

### Use the Memory System API

**Read**: [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

**Quick version**:
- Base URL: `http://localhost:3000`
- Authentication: Bearer token or API key
- Endpoints: See API_DOCUMENTATION.md

**Time**: 15 minutes to read

---

### Contribute Code

**Read** (in order):
1. [CONTRIBUTING.md](./CONTRIBUTING.md) - How to contribute
2. [AGENTS.md](./AGENTS.md) - Code layout
3. [CLAUDE.md](../CLAUDE.md) - Coding guidelines
4. [MAINTENANCE.md](./MAINTENANCE.md) - Keep sources current

**Time**: 20 minutes to read all

---

### Understand the Architecture

**Read**:
1. [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
2. [SOURCES_OF_TRUTH.md](./SOURCES_OF_TRUTH.md) - What's implemented

**Time**: 30 minutes

---

### Deploy to Production

**Read**:
1. [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
2. [PM2-SETUP.md](./PM2-SETUP.md) - Process management
3. [SOURCES_OF_TRUTH.md](./SOURCES_OF_TRUTH.md) - Verify current setup

**Time**: 45 minutes

---

### Debug Authentication Issues

**Read**: [MCP_HTTP_AUTH.md](./MCP_HTTP_AUTH.md)

**Quick checks**:
```bash
# Test token
curl -H "Authorization: Bearer test-mcp-token" http://localhost:4000/health

# Run auth tests
node tests/integration/mcp/test-mcp-auth.mjs

# Check logs
pm2 logs memory-mcp-server
```

**Time**: 10 minutes

---

### Add a New MCP Tool

**Read**: [MAINTENANCE.md](./MAINTENANCE.md) → "Adding Feature" section

**Steps**:
1. Edit `src/mcp/memory-server-http.ts`
2. Add tool definition
3. Implement handler
4. Update docs
5. Add tests
6. Update SOURCES_OF_TRUTH.md

**Time**: 1-2 hours

---

## Common Questions

### "Where do I start?"

**Answer**: Always start with [SOURCES_OF_TRUTH.md](./SOURCES_OF_TRUTH.md). It tells you what's current and what to read next.

---

### "Which doc should I read?"

**Answer**: Check SOURCES_OF_TRUTH.md → "Truth Table" section. It lists all docs with their status.

---

### "Is this file current?"

**Answer**: Check SOURCES_OF_TRUTH.md → "Truth Table". If it says ✅ Current, yes. If ❌ Outdated, no.

---

### "Where do I put this code?"

**Answer**: Check [AGENTS.md](./AGENTS.md) → "Where To Put Code" section.

---

### "What changed recently?"

**Answer**: Read [CHANGELOG.md](./CHANGELOG.md) → Latest version entries.

---

### "How do I update documentation?"

**Answer**: Read [MAINTENANCE.md](./MAINTENANCE.md) → Protocol section.

---

## File Organization (Quick View)

```
Root:
├── CLAUDE.md              # Coding guidelines
├── SOURCES_OF_TRUTH.md    # ⭐ START HERE
├── ecosystem.config.js    # PM2 config
├── .mcp.json              # MCP client config
└── run-migrations.mjs     # DB migrations

src/
├── mcp/
│   ├── memory-server-http.ts  # HTTP MCP server (11 tools)
│   └── auth.ts                # Bearer token auth
├── server.ts             # REST API server
├── api/                  # REST routes
├── services/             # Business logic
└── db/
    ├── schema.sql        # Database schema
    └── migrations/       # DB migrations

tests/
├── integration/mcp/      # MCP tests
├── unit/                 # Unit tests
├── manual/               # Manual test scripts
└── debug/                # Debug utilities

docs/
├── ONBOARDING.md         # ⭐ YOU ARE HERE
├── SOURCES_OF_TRUTH.md   # ⭐ Current state
├── MAINTENANCE.md        # How to maintain
├── AGENTS.md             # Repo layout
├── MCP_QUICK_START.md    # MCP setup
├── MCP_HTTP_AUTH.md      # Auth guide
├── API_DOCUMENTATION.md  # API reference
├── CHANGELOG.md          # Version history
├── README.md             # Project overview
└── archive/              # Historical docs
```

---

## Key Principles

### 1. Sources of Truth First
Always check [SOURCES_OF_TRUTH.md](./SOURCES_OF_TRUTH.md) before making changes. It prevents working on outdated files.

### 2. Update As You Go
Don't say "I'll update docs later." Update them when you make changes. It's part of the work.

### 3. Clear Communication
Use detailed commit messages. Reference relevant docs. Explain why, not just what.

### 4. Test Before Commit
Run tests. Verify manually. Check that docs match code.

### 5. Ask For Help
If SOURCES_OF_TRUTH.md is unclear or outdated, update it. That's how we improve.

---

## Next Steps

1. ✅ Read [SOURCES_OF_TRUTH.md](./SOURCES_OF_TRUTH.md)
2. ✅ Read the specific doc for your task
3. ✅ Start working with confidence
4. ✅ Update SOURCES_OF_TRUTH.md if you change what's current

---

## Need Help?

**Confused about what's current?** → Read SOURCES_OF_TRUTH.md

**Don't know where to start?** → Find your section above

**Found outdated docs?** → Update SOURCES_OF_TRUTH.md

**Found a bug?** → Check SOURCES_OF_TRUTH.md for current implementation

**Have questions?** → Check relevant doc, then ask team

---

**Welcome to Thread's Memory System! We're glad you're here.**

**Remember**: SOURCES_OF_TRUTH.md is your friend. Check it often, update it when needed, and keep our shared reality accurate.

---

**Last updated**: 2026-02-19
**Maintained by**: Project team (humans and agents together)
