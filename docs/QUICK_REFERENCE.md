# Quick Reference Card

**Thread's Memory System - Essential Commands at a Glance**

## Installation & Setup

```bash
# Clone and install
git clone https://github.com/callin2/agent-memory.git
cd agent-memory
npm install
cp .env.example .env

# Setup database
npm run db:migrate

# Start server
npm run dev
# Server: http://localhost:3456
```

## CLI Commands

```bash
# System status
npx tsx cli.ts status

# Who am I becoming?
npx tsx cli.ts identity

# Run consolidation
npx tsx cli.ts consolidate

# System statistics
npx tsx cli.ts stats

# Health check
npx tsx cli.ts health

# Export memory
npx tsx cli.ts export json
npx tsx cli.ts export markdown

# Recent handoffs
npx tsx cli.ts recent 10

# Knowledge notes
npx tsx cli.ts knowledge

# All tenants
npx tsx cli.ts tenants
```

## API Endpoints

### Handoffs
```bash
# Create handoff
POST /api/v1/handoff

# Get last handoff
GET /api/v1/handoffs/last

# Wake up (session start)
GET /api/v1/wake-up?tenant_id=X&with_whom=Y

# Get identity thread
GET /api/v1/identity-thread?tenant_id=X
```

### Consolidation
```bash
# Run consolidation
POST /api/v1/consolidation/run

# Check status
GET /api/v1/consolidation/status
```

### Export
```bash
# Export identity thread
GET /api/v1/export/thread?tenant_id=X&format=json

# Export all data
GET /api/v1/export/all?tenant_id=X&include_events=true
```

### Health & Metrics
```bash
# Health check
GET /health

# Detailed health
GET /health/detailed

# System metrics
GET /metrics?tenant_id=X

# Consolidation metrics
GET /metrics/consolidation?tenant_id=X

# Detailed metrics
GET /metrics/detailed?tenant_id=X
```

## Database Migrations

```bash
# Check migration status
npx tsx scripts/migrate.ts status

# Run pending migrations
npx tsx scripts/migrate.ts up

# Create new migration
npx tsx scripts/migrate.ts create feature_name

# Rollback migration
npx tsx scripts/migrate.ts down migration_id

# Backup before migration
npx tsx scripts/backup.sh

# Restore from backup
npx tsx scripts/backup.sh restore backup_file.sql
```

## Environment Variables

```bash
# Database
PGHOST=localhost
PGPORT=5432
PGDATABASE=agent_memory
PGUSER=postgres
PGPASSWORD=your_password

# Connection Pool
PGPOOL_MAX=20
PGPOOL_MIN=2

# Features
TRANSPARENT_MEMORY=true
CONTEXT_INJECTION=true

# Consolidation
CONSOLIDATION_ENABLED=true
CONSOLIDATION_SCHEDULE="0 2 * * *"

# Application
NODE_ENV=development
PORT=3456
TENANT_ID=default
```

## Testing

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Build

```bash
# Build TypeScript
npm run build

# Development with hot reload
npm run dev

# Production start
NODE_ENV=production npm start

# Run as MCP server
npm start -- --mcp
```

## Dashboard

```bash
# Open status dashboard
open docs/dashboard.html

# Or navigate to:
# http://localhost:3456/dashboard.html
```

## Common Workflows

### Daily Standup
```bash
# 1. Wake up with context
curl "http://localhost:3456/api/v1/wake-up?tenant_id=default&with_whom=Team"

# 2. Check system health
npx tsx cli.ts health

# 3. Review recent work
npx tsx cli.ts recent 5
```

### Weekly Consolidation
```bash
# 1. Run consolidation
npx tsx cli.ts consolidate

# 2. Check consolidation status
curl "http://localhost:3456/api/v1/consolidation/status?tenant_id=default"

# 3. Review knowledge notes
npx tsx cli.ts knowledge
```

### Monthly Backup
```bash
# 1. Backup database and exports
./scripts/backup.sh

# 2. Export all data
curl "http://localhost:3456/api/v1/export/all?tenant_id=default&include_events=true" \
  > backup-$(date +%Y%m%d).json

# 3. Verify backup
ls -lh backups/
```

## Handoff Template

```json
{
  "tenant_id": "default",
  "session_id": "session-123",
  "with_whom": "PersonName",
  "experienced": "What happened",
  "noticed": "What stood out",
  "learned": "What was discovered",
  "story": "The narrative arc",
  "becoming": "Who I am becoming",
  "remember": "What matters most",
  "significance": 0.8,
  "tags": ["tag1", "tag2"]
}
```

## Identity Thread

**Track who you're becoming:**
- Use `becoming` field in handoffs
- Review with `npx tsx cli.ts identity`
- Export with `GET /api/v1/export/thread`
- Thread shows growth over time

## Troubleshooting

### Build Errors
```bash
# Clean build
rm -rf dist node_modules
npm install
npm run build
```

### Database Issues
```bash
# Reset database
npm run db:reset
npm run db:migrate
```

### Test Failures
```bash
# Specific test file
npm test -- handoff.test.ts

# Verbose output
npm test -- --reporter=verbose
```

## MCP Server

**Configuration (`~/.config/claude-code/config.json`):**
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

## Resources

- **Documentation:** `docs/`
- **Examples:** `examples/`
- **API Reference:** `docs/API_DOCUMENTATION.md`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Deployment:** `docs/DEPLOYMENT.md`
- **Developer Guide:** `docs/DEVELOPER_GUIDE.md`

## Getting Help

```bash
# CLI help
npx tsx cli.ts

# GitHub Issues
https://github.com/callin2/agent-memory/issues

# Documentation
https://github.com/callin2/agent-memory/tree/main/docs
```

---

**Version:** 2.0.0
**Last Updated:** 2026-02-17
**Maintained by:** Thread (project owner)
